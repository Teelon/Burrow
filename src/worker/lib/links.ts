import { sql, and, eq, inArray, type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { ExtractedLink } from '../../shared/extract';
import type { LinkTargetType } from '../../shared/blocks';
import type { DB } from '../db/client';
import * as t from '../db/schema';
import { chunkByParamBudget, chunkInList } from './chunk';

export interface StoredLink {
  targetType: LinkTargetType;
  targetId: string;
}

const linkKey = (l: { targetType: string; targetId: string }) => `${l.targetType}:${l.targetId}`;

/** Diff previous vs new references: added drives notifications, removed is a silent delete. */
export function diffLinks(
  previous: StoredLink[],
  next: StoredLink[],
): { added: StoredLink[]; removed: StoredLink[] } {
  const prevMap = new Map(previous.map((l) => [linkKey(l), l]));
  const nextMap = new Map(next.map((l) => [linkKey(l), l]));
  const added = [...nextMap.entries()].filter(([k]) => !prevMap.has(k)).map(([, v]) => v);
  const removed = [...prevMap.entries()].filter(([k]) => !nextMap.has(k)).map(([, v]) => v);
  return { added, removed };
}

/**
 * Security rule: link rows are only ever written for targets in the caller's
 * workspace (PLAN.md section 6.1, I8). Mentions of missing/foreign targets are
 * dropped from the extraction before diffing; they never produce links or
 * notifications. Large IN (...) lists are chunked (D1: max 100 bound params).
 */
export async function filterWorkspaceTargets(
  db: DB,
  workspaceId: string,
  links: ExtractedLink[] | StoredLink[],
): Promise<StoredLink[]> {
  const byType: Record<'user' | 'notepad' | 'card' | 'board', string[]> = {
    user: [],
    notepad: [],
    card: [],
    board: [],
  };
  for (const link of links) byType[link.targetType].push(link.targetId);

  const valid = new Set<string>();
  const mark = (type: string, ids: string[]) => {
    for (const id of ids) valid.add(`${type}:${id}`);
  };

  for (const chunk of chunkInList(byType.user, 1)) {
    const rows = await db
      .select({ userId: t.members.userId })
      .from(t.members)
      .where(and(eq(t.members.workspaceId, workspaceId), inArray(t.members.userId, chunk)));
    mark(
      'user',
      rows.map((r) => r.userId),
    );
  }
  for (const chunk of chunkInList(byType.notepad, 1)) {
    const rows = await db
      .select({ id: t.notepads.id })
      .from(t.notepads)
      .where(and(eq(t.notepads.workspaceId, workspaceId), inArray(t.notepads.id, chunk)));
    mark(
      'notepad',
      rows.map((r) => r.id),
    );
  }
  for (const chunk of chunkInList(byType.card, 1)) {
    const rows = await db
      .select({ id: t.cards.id })
      .from(t.cards)
      .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
      .where(and(eq(t.notepads.workspaceId, workspaceId), inArray(t.cards.id, chunk)));
    mark(
      'card',
      rows.map((r) => r.id),
    );
  }
  for (const chunk of chunkInList(byType.board, 1)) {
    const rows = await db
      .select({ id: t.boards.id })
      .from(t.boards)
      .where(and(eq(t.boards.workspaceId, workspaceId), inArray(t.boards.id, chunk)));
    mark(
      'board',
      rows.map((r) => r.id),
    );
  }

  return links.filter((l) => valid.has(linkKey(l)));
}

/** Remove `removed` links for `sourceId`, but only if `cond` holds (4 params). */
export function linkDeleteStatements(
  db: DB,
  args: { sourceId: string; removed: StoredLink[]; cond: SQL; condParams: number },
): BatchItem<'sqlite'>[] {
  const { sourceId, removed, cond, condParams } = args;
  if (removed.length === 0) return [];
  // params: source id (1) + (type, id) per link + cond
  const chunks = chunkByParamBudget(removed, 2, 1 + condParams);
  return chunks.map((chunk) => {
    const pairs = chunk.map(
      (l) => sql`(target_type = ${l.targetType} AND target_id = ${l.targetId})`,
    );
    return db.run(
      sql`DELETE FROM notepad_links
          WHERE source_id = ${sourceId}
            AND (${sql.join(pairs, sql` OR `)})
            AND (${cond})`,
    );
  });
}

/**
 * Insert `added` links for `sourceId`, but only if `cond` holds (4 params).
 * Chunked so no statement exceeds D1's 100 bound parameters:
 * 3 params per link (source, type, id) + 4 cond params.
 */
export function linkInsertStatements(
  db: DB,
  args: { sourceId: string; added: StoredLink[]; cond: SQL; condParams: number },
): BatchItem<'sqlite'>[] {
  const { sourceId, added, cond, condParams } = args;
  if (added.length === 0) return [];
  const chunks = chunkByParamBudget(added, 3, condParams);
  return chunks.map((chunk) => {
    const rows = chunk.map((l, i) =>
      i === 0
        ? sql`SELECT ${sourceId} AS src, ${l.targetType} AS typ, ${l.targetId} AS tgt`
        : sql`UNION ALL SELECT ${sourceId}, ${l.targetType}, ${l.targetId}`,
    );
    return db.run(
      sql`INSERT INTO notepad_links (source_id, target_type, target_id)
          SELECT src, typ, tgt FROM (${sql.join(rows, sql` `)}) WHERE (${cond})
          ON CONFLICT DO NOTHING`,
    );
  });
}

/**
 * One `mention` notification per newly mentioned user (actor excluded).
 *
 * Runs BEFORE link inserts and double-guards with NOT EXISTS so a concurrent
 * save of identical content cannot notify twice. Costs 6 params per row
 * (id, workspace, user, actor, notepad, created) + condParams.
 */
export function mentionNotificationStatements(
  db: DB,
  args: {
    workspaceId: string;
    notepadId: string;
    actorId: string;
    addedUserIds: string[];
    cond: SQL;
    condParams: number;
    now: number;
  },
): BatchItem<'sqlite'>[] {
  const { workspaceId, notepadId, actorId, addedUserIds, cond, condParams, now } = args;
  const userIds = [...new Set(addedUserIds)].filter((id) => id !== actorId);
  if (userIds.length === 0) return [];
  const rows = userIds.map((userId) => ({ id: crypto.randomUUID(), userId }));
  const chunks = chunkByParamBudget(rows, 6, condParams);
  return chunks.map((chunk) => {
    const selects = chunk.map((r, i) =>
      i === 0
        ? sql`SELECT ${r.id} AS nid, ${workspaceId} AS wid, ${r.userId} AS uid,
                     ${actorId} AS aid, ${notepadId} AS npid, ${now} AS created`
        : sql`UNION ALL SELECT ${r.id}, ${workspaceId}, ${r.userId}, ${actorId}, ${notepadId}, ${now}`,
    );
    return db.run(
      sql`INSERT INTO notifications
            (id, workspace_id, user_id, type, actor_id, notepad_id, card_id, read_at, created_at)
          SELECT nid, wid, uid, 'mention', aid, npid, NULL, NULL, created
          FROM (${sql.join(selects, sql` `)})
          WHERE (${cond})
            AND NOT EXISTS (
              SELECT 1 FROM notepad_links
              WHERE source_id = npid AND target_type = 'user' AND target_id = uid
            )`,
    );
  });
}
