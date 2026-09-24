import type { DB } from '../client';
import * as t from '../schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { runBatch } from '../lib/batch';
import { positionAfterLast } from '../lib/ordering';
import {
  ftsDeleteStmt,
  ftsInsertStmt,
  ftsInsertNowStmt,
  liveContentCond,
  LIVE_CONTENT_COND_PARAMS,
} from '../lib/search';
import {
  diffLinks,
  filterWorkspaceTargets,
  linkDeleteStatements,
  linkInsertStatements,
  mentionNotificationStatements,
  type StoredLink,
} from '../lib/links';
import { getDescendantIds } from '../lib/tree';
import { chunkByParamBudget } from '../lib/chunk';
import { extractPlainText } from '../../../../shared/extract';
import type {
  INotepadRepository,
  Notepad,
  CreateNotepadData,
  UpdateNotepadData,
  NotepadContent,
  RestoredNotepad,
  HardDeletedNotepad,
  EditLock,
  MentionNotificationArgs,
} from '../../../../infrastructure/types';

export const MAX_NOTEPAD_DEPTH = 8;
export const MAX_CONTENT_BYTES = 1_500_000;

export function createNotepadRepository(db: DB): INotepadRepository {
  return {
    async listByProject(projectId: string): Promise<Notepad[]> {
      const rows = await db
        .select()
        .from(t.notepads)
        .where(eq(t.notepads.projectId, projectId))
        .orderBy(asc(t.notepads.position));
      return rows.map(mapNotepad);
    },

    async findById(id: string): Promise<Notepad | null> {
      const [row] = await db.select().from(t.notepads).where(eq(t.notepads.id, id));
      return row ? mapNotepad(row) : null;
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Notepad | null> {
      const [row] = await db
        .select()
        .from(t.notepads)
        .where(and(eq(t.notepads.id, id), eq(t.notepads.workspaceId, workspaceId)));
      return row ? mapNotepad(row) : null;
    },

    async create(data: CreateNotepadData): Promise<Notepad> {
      await db.insert(t.notepads).values(data);
      return {
        id: data.id,
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        parentId: data.parentId ?? null,
        kind: data.kind,
        title: data.title,
        icon: null,
        coverKey: null,
        content: data.content,
        version: data.version,
        position: data.position,
        isFavorite: data.isFavorite,
        deletedAt: null,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    },

    async update(id: string, data: UpdateNotepadData): Promise<void> {
      await db.update(t.notepads).set(data).where(eq(t.notepads.id, id));
    },

    async move(id: string, parentId: string | null, position: string): Promise<void> {
      await db
        .update(t.notepads)
        .set({ parentId, position, updatedAt: Date.now() })
        .where(eq(t.notepads.id, id));
    },

    async softDelete(id: string, deletedAt: number): Promise<void> {
      const descendants = await getDescendantIds(db, id);
      const allIds = [id, ...descendants];
      const now = deletedAt;

      const statements: BatchItem<'sqlite'>[] = [];
      for (const chunk of chunkByParamBudget(allIds, 1, 1)) {
        statements.push(
          db
            .update(t.notepads)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(inArray(t.notepads.id, chunk), isNull(t.notepads.deletedAt))),
        );
      }

      for (const chunk of chunkByParamBudget(allIds, 1, 0)) {
        statements.push(db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`));
      }

      await runBatch(db, statements);
    },

    async restore(id: string, deleteTimestamp: number): Promise<RestoredNotepad[]> {
      const [notepad] = await db.select().from(t.notepads).where(eq(t.notepads.id, id));
      if (!notepad) throw new Error('Notepad not found');

      const matchingNotepads = await db
        .select({
          id: t.notepads.id,
          parentId: t.notepads.parentId,
          title: t.notepads.title,
          content: t.notepads.content,
          projectId: t.notepads.projectId,
        })
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.projectId, notepad.projectId),
            eq(t.notepads.deletedAt, deleteTimestamp),
          ),
        );

      let newParentId = notepad.parentId;
      let newPosition: string | null = null;
      if (notepad.parentId) {
        const [parent] = await db
          .select({ id: t.notepads.id, deletedAt: t.notepads.deletedAt })
          .from(t.notepads)
          .where(eq(t.notepads.id, notepad.parentId));
        if (!parent || parent.deletedAt !== null) {
          newParentId = null;
          newPosition = await lastRootPosition(db, notepad.projectId);
        }
      }

      const now = Date.now();
      const matchingIds = matchingNotepads.map((n) => n.id);

      const statements: BatchItem<'sqlite'>[] = [];
      for (const chunk of chunkByParamBudget(matchingIds, 1, 1)) {
        statements.push(
          db
            .update(t.notepads)
            .set({ deletedAt: null, updatedAt: now })
            .where(inArray(t.notepads.id, chunk)),
        );
      }

      if (newParentId !== notepad.parentId || newPosition) {
        statements.push(
          db
            .update(t.notepads)
            .set({
              parentId: newParentId,
              position: newPosition ?? notepad.position,
              updatedAt: now,
            })
            .where(eq(t.notepads.id, id)),
        );
      }

      for (const item of matchingNotepads) {
        statements.push(
          db.run(ftsInsertNowStmt(item.id, item.title, extractPlainText(item.content))),
        );
      }

      await runBatch(db, statements);

      return matchingNotepads.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        title: n.title,
        content: n.content,
        projectId: n.projectId,
      }));
    },

    async hardDelete(id: string): Promise<HardDeletedNotepad[]> {
      const [notepad] = await db.select().from(t.notepads).where(eq(t.notepads.id, id));
      if (!notepad) throw new Error('Notepad not found');

      const descendants = await getDescendantIds(db, id);
      const allIds = [id, ...descendants];

      const allRows = await db
        .select({ id: t.notepads.id, coverKey: t.notepads.coverKey })
        .from(t.notepads)
        .where(inArray(t.notepads.id, allIds));

      const statements: BatchItem<'sqlite'>[] = [];
      for (const chunk of chunkByParamBudget(allIds, 1, 0)) {
        statements.push(
          db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`),
          db.run(sql`DELETE FROM notepad_links WHERE target_id IN ${chunk}`),
          db.delete(t.notepads).where(inArray(t.notepads.id, chunk)),
        );
      }

      await runBatch(db, statements);

      return allRows.map((r) => ({ id: r.id, coverKey: r.coverKey }));
    },

    // Content & versioning
    async getContent(id: string): Promise<NotepadContent | null> {
      const [row] = await db
        .select({
          id: t.notepads.id,
          workspaceId: t.notepads.workspaceId,
          title: t.notepads.title,
          content: t.notepads.content,
          version: t.notepads.version,
        })
        .from(t.notepads)
        .where(eq(t.notepads.id, id));
      if (!row) return null;
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        title: row.title,
        content: row.content,
        version: row.version,
      };
    },

    async saveContent(id: string, content: string, expectedVersion: number): Promise<number> {
      if (byteLength(content) > MAX_CONTENT_BYTES) {
        throw new Error('content_too_large');
      }

      const [row] = await db.select().from(t.notepads).where(eq(t.notepads.id, id));
      if (!row) throw new Error('not_found');

      // Version check is done by the conditional update
      const now = Date.now();
      const newVersion = expectedVersion + 1;
      const cond = liveContentCond(id, newVersion, content);
      const plain = extractPlainText(content);

      const extraction = await extractAndFilterLinks(db, row.workspaceId, content);
      const validLinks = extraction.validLinks;
      const previousLinks = await db
        .select({ targetType: t.notepadLinks.targetType, targetId: t.notepadLinks.targetId })
        .from(t.notepadLinks)
        .where(eq(t.notepadLinks.sourceId, id));

      const { added, removed } = diffLinks(previousLinks, validLinks);

      // Use variables to satisfy TypeScript (they are passed to buildSaveContentStatements)
      void cond;
      void plain;
      void added;
      void removed;

      const statements = buildSaveContentStatements(db, {
        row: { id: row.id, workspaceId: row.workspaceId, title: row.title },
        content,
        baseVersion: expectedVersion,
        actorId: '', // Not used in repo
        validLinks,
        previousLinks,
        now,
      });

      await runBatch(db, statements);

      const [after] = await db
        .select({ content: t.notepads.content, version: t.notepads.version })
        .from(t.notepads)
        .where(eq(t.notepads.id, id));
      if (!after || after.content !== content) {
        throw new Error('version_conflict');
      }
      return after.version;
    },

    // Tree navigation
    async getChildren(parentIds: string[]): Promise<{ id: string; parentId: string | null }[]> {
      if (parentIds.length === 0) return [];
      const rows = await db
        .select({ id: t.notepads.id, parentId: t.notepads.parentId })
        .from(t.notepads)
        .where(and(inArray(t.notepads.parentId, parentIds), isNull(t.notepads.deletedAt)));
      return rows.map((r) => ({ id: r.id, parentId: r.parentId }));
    },

    async getParent(id: string): Promise<{ id: string; parentId: string | null } | null> {
      const [row] = await db
        .select({ id: t.notepads.id, parentId: t.notepads.parentId })
        .from(t.notepads)
        .where(eq(t.notepads.id, id));
      return row ? { id: row.id, parentId: row.parentId } : null;
    },

    // Link validation
    async isValidLink(link: { targetType: string; targetId: string }): Promise<boolean> {
      // Simplified: just check if target exists
      if (link.targetType === 'notepad') {
        const [row] = await db
          .select({ id: t.notepads.id })
          .from(t.notepads)
          .where(eq(t.notepads.id, link.targetId));
        return !!row;
      }
      if (link.targetType === 'card') {
        const [row] = await db
          .select({ id: t.cards.id })
          .from(t.cards)
          .where(eq(t.cards.id, link.targetId));
        return !!row;
      }
      if (link.targetType === 'board') {
        const [row] = await db
          .select({ id: t.boards.id })
          .from(t.boards)
          .where(eq(t.boards.id, link.targetId));
        return !!row;
      }
      if (link.targetType === 'user') {
        const [row] = await db
          .select({ id: t.user.id })
          .from(t.user)
          .where(eq(t.user.id, link.targetId));
        return !!row;
      }
      return false;
    },

    // Tags
    async listTagIds(notepadId: string): Promise<string[]> {
      const rows = await db
        .select({ tagId: t.notepadTags.tagId })
        .from(t.notepadTags)
        .where(eq(t.notepadTags.notepadId, notepadId));
      return rows.map((r) => r.tagId);
    },

    async setTagIds(notepadId: string, tagIds: string[]): Promise<void> {
      const uniqueTagIds = [...new Set(tagIds)];
      const statements: BatchItem<'sqlite'>[] = [
        db.delete(t.notepadTags).where(eq(t.notepadTags.notepadId, notepadId)),
      ];
      if (uniqueTagIds.length > 0) {
        for (const chunk of chunkByParamBudget(uniqueTagIds, 2, 0)) {
          statements.push(
            db.insert(t.notepadTags).values(chunk.map((tagId) => ({ notepadId, tagId }))),
          );
        }
      }
      await runBatch(db, statements);
    },

    // Locks
    async getLock(notepadId: string): Promise<EditLock | null> {
      const [row] = await db.select().from(t.editLocks).where(eq(t.editLocks.notepadId, notepadId));
      return row
        ? {
            notepadId: row.notepadId,
            userId: row.userId,
            clientId: row.clientId,
            expiresAt: row.expiresAt,
          }
        : null;
    },

    // FTS
    async deleteFts(notepadId: string): Promise<void> {
      await db.run(sql`DELETE FROM notepads_fts WHERE notepad_id = ${notepadId}`);
    },

    async insertFts(notepadId: string, title: string, body: string): Promise<void> {
      await db.run(ftsInsertNowStmt(notepadId, title, body));
    },

    async insertFtsConditional(
      notepadId: string,
      title: string,
      body: string,
      version: number,
      content: string,
    ): Promise<void> {
      const cond = liveContentCond(notepadId, version, content);
      await db.run(ftsDeleteStmt(notepadId, cond));
      await db.run(ftsInsertStmt(notepadId, title, body, cond));
    },

    // Links
    async listLinks(sourceId: string): Promise<StoredLink[]> {
      const rows = await db
        .select({ targetType: t.notepadLinks.targetType, targetId: t.notepadLinks.targetId })
        .from(t.notepadLinks)
        .where(eq(t.notepadLinks.sourceId, sourceId));
      return rows.map((r) => ({
        targetType: r.targetType as StoredLink['targetType'],
        targetId: r.targetId,
      }));
    },

    async replaceLinks(
      sourceId: string,
      added: StoredLink[],
      removed: StoredLink[],
      version: number,
      content: string,
    ): Promise<void> {
      const cond = liveContentCond(sourceId, version, content);
      const statements: BatchItem<'sqlite'>[] = [
        ...linkDeleteStatements(db, {
          sourceId,
          removed,
          cond,
          condParams: LIVE_CONTENT_COND_PARAMS,
        }),
        ...linkInsertStatements(db, {
          sourceId,
          added,
          cond,
          condParams: LIVE_CONTENT_COND_PARAMS,
        }),
      ];
      if (statements.length > 0) await runBatch(db, statements);
    },

    // Mentions
    async insertMentions(args: MentionNotificationArgs): Promise<void> {
      const statements = mentionNotificationStatements(db, {
        workspaceId: args.workspaceId,
        notepadId: args.notepadId,
        actorId: args.actorId,
        addedUserIds: args.addedUserIds,
        cond: sql`1=1`, // Unconditional for notifications
        condParams: 0,
        now: args.now,
      });
      if (statements.length > 0) await runBatch(db, statements);
    },

    // Position helpers
    async getLastChildPosition(parentId: string): Promise<string | null> {
      const [last] = await db
        .select({ position: t.notepads.position })
        .from(t.notepads)
        .where(and(eq(t.notepads.parentId, parentId), isNull(t.notepads.deletedAt)))
        .orderBy(desc(t.notepads.position))
        .limit(1);
      return last ? positionAfterLast(last.position) : null;
    },

    async getLastRootPosition(projectId: string): Promise<string | null> {
      const [last] = await db
        .select({ position: t.notepads.position })
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.projectId, projectId),
            isNull(t.notepads.parentId),
            isNull(t.notepads.deletedAt),
            eq(t.notepads.kind, 'notepad'),
          ),
        )
        .orderBy(desc(t.notepads.position))
        .limit(1);
      return last ? positionAfterLast(last.position) : null;
    },

    async getLastRootNotepadPosition(projectId: string): Promise<string> {
      const [last] = await db
        .select({ position: t.notepads.position })
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.projectId, projectId),
            isNull(t.notepads.parentId),
            isNull(t.notepads.deletedAt),
            eq(t.notepads.kind, 'notepad'),
          ),
        )
        .orderBy(desc(t.notepads.position))
        .limit(1);
      return positionAfterLast(last?.position ?? null);
    },

    // Search/suggest
    async findByPattern(
      projectId: string,
      pattern: string,
      limit: number,
    ): Promise<{ id: string; title: string; icon: string | null }[]> {
      const searchPattern = `%${pattern}%`;
      const rows = await db
        .select({ id: t.notepads.id, title: t.notepads.title, icon: t.notepads.icon })
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.projectId, projectId),
            isNull(t.notepads.deletedAt),
            sql`${t.notepads.title} LIKE ${searchPattern}`,
          ),
        )
        .orderBy(asc(t.notepads.title))
        .limit(limit);
      return rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon }));
    },

    // Trash
    async listDeletedByProject(projectId: string): Promise<Notepad[]> {
      const rows = await db
        .select()
        .from(t.notepads)
        .where(and(eq(t.notepads.projectId, projectId), sql`${t.notepads.deletedAt} IS NOT NULL`))
        .orderBy(desc(t.notepads.deletedAt));
      return rows.map(mapNotepad);
    },
  };
}

async function extractAndFilterLinks(
  db: DB,
  workspaceId: string,
  content: string,
): Promise<{ validLinks: StoredLink[] }> {
  const { extractFromContent } = await import('../../../../shared/extract');
  const extraction = extractFromContent(content);
  const validLinks = await filterWorkspaceTargets(
    db,
    workspaceId,
    extraction.links as StoredLink[],
  );
  return { validLinks };
}

function buildSaveContentStatements(
  db: DB,
  args: {
    row: { id: string; workspaceId: string; title: string };
    content: string;
    baseVersion: number;
    actorId: string;
    validLinks: StoredLink[];
    previousLinks: StoredLink[];
    now: number;
  },
): BatchItem<'sqlite'>[] {
  const { row, content, baseVersion, actorId, validLinks, previousLinks, now } = args;
  const newVersion = baseVersion + 1;
  const cond = liveContentCond(row.id, newVersion, content);
  const plain = extractPlainText(content);
  const { added, removed } = diffLinks(previousLinks, validLinks);

  // Use variables to satisfy TypeScript (they are used in the returned array)
  void cond;
  void plain;
  void added;
  void removed;

  return [
    db
      .update(t.notepads)
      .set({ content, version: sql`${t.notepads.version} + 1`, updatedAt: now })
      .where(and(eq(t.notepads.id, row.id), eq(t.notepads.version, baseVersion))),
    db.run(ftsDeleteStmt(row.id, cond)),
    db.run(ftsInsertStmt(row.id, row.title, plain, cond)),
    ...mentionNotificationStatements(db, {
      workspaceId: row.workspaceId,
      notepadId: row.id,
      actorId,
      addedUserIds: added.filter((l) => l.targetType === 'user').map((l) => l.targetId),
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
      now,
    }),
    ...linkDeleteStatements(db, {
      sourceId: row.id,
      removed,
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
    }),
    ...linkInsertStatements(db, {
      sourceId: row.id,
      added,
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
    }),
  ];
}

function mapNotepad(row: typeof t.notepads.$inferSelect): Notepad {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    parentId: row.parentId,
    kind: row.kind,
    title: row.title,
    icon: row.icon,
    coverKey: row.coverKey,
    content: row.content,
    version: row.version,
    position: row.position,
    isFavorite: row.isFavorite,
    deletedAt: row.deletedAt ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

async function lastRootPosition(db: DB, projectId: string): Promise<string> {
  const [last] = await db
    .select({ position: t.notepads.position })
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.projectId, projectId),
        isNull(t.notepads.parentId),
        isNull(t.notepads.deletedAt),
        eq(t.notepads.kind, 'notepad'),
      ),
    )
    .orderBy(desc(t.notepads.position))
    .limit(1);
  return positionAfterLast(last?.position ?? null);
}
