import { nanoid } from 'nanoid';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { DB } from '../db/client';
import * as t from '../db/schema';
import { HttpError } from '../lib/errors';
import { runBatch } from '../lib/batch';
import { chunkByParamBudget } from '../lib/chunk';

/**
 * Comment bodies are plain text/markdown. Mentions use the markdown-link
 * shape produced by the composer: `@[Display Name](userId)`.
 */
const MENTION_RE = /@\[[^\]]*\]\(([A-Za-z0-9_-]+)\)/g;

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>();
  for (const match of content.matchAll(MENTION_RE)) {
    if (match[1]) ids.add(match[1]);
  }
  return [...ids];
}

async function requireCardForWorkspace(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({ id: t.cards.id, notepadId: t.cards.notepadId })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    );
  if (!card) throw new HttpError(404, 'not_found', 'Card not found');
  return card;
}

export async function listComments(db: DB, workspaceId: string, cardId: string) {
  await requireCardForWorkspace(db, workspaceId, cardId);

  return db
    .select({
      id: t.cardComments.id,
      cardId: t.cardComments.cardId,
      userId: t.cardComments.userId,
      content: t.cardComments.content,
      createdAt: t.cardComments.createdAt,
      updatedAt: t.cardComments.updatedAt,
      name: t.user.name,
      image: t.user.image,
    })
    .from(t.cardComments)
    .innerJoin(t.user, eq(t.user.id, t.cardComments.userId))
    .where(eq(t.cardComments.cardId, cardId))
    .orderBy(asc(t.cardComments.createdAt));
}

export interface CreateCommentResult {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  image: string | null;
  mentionedUserIds: string[];
}

/**
 * Insert a comment and dispatch `mention` notifications for @mentioned
 * workspace members (actor excluded). Notifications reference both the card
 * and its notepad so the bell can deep-link either way.
 */
export async function createComment(
  db: DB,
  workspaceId: string,
  cardId: string,
  actorId: string,
  content: string,
): Promise<CreateCommentResult> {
  const card = await requireCardForWorkspace(db, workspaceId, cardId);
  const trimmed = content.trim();
  if (!trimmed) throw new HttpError(400, 'invalid_content', 'Comment cannot be empty');

  const mentioned = extractMentionedUserIds(trimmed).filter((id) => id !== actorId);
  let mentionedUserIds: string[] = [];
  if (mentioned.length > 0) {
    const valid = new Set<string>();
    for (const chunk of chunkByParamBudget(mentioned, 1, 1)) {
      const rows = await db
        .select({ userId: t.members.userId })
        .from(t.members)
        .where(and(eq(t.members.workspaceId, workspaceId), inArray(t.members.userId, chunk)));
      for (const r of rows) valid.add(r.userId);
    }
    // Mentions of non-members are dropped: no link rows, no notifications.
    mentionedUserIds = mentioned.filter((id) => valid.has(id));
  }

  const now = Date.now();
  const row = {
    id: nanoid(),
    cardId,
    userId: actorId,
    content: trimmed,
    createdAt: now,
    updatedAt: now,
  };

  const statements: BatchItem<'sqlite'>[] = [db.insert(t.cardComments).values(row)];

  if (mentionedUserIds.length > 0) {
    // 9 bound params per notification row.
    for (const chunk of chunkByParamBudget(mentionedUserIds, 9, 0)) {
      const values = chunk.map((userId) => ({
        id: nanoid(),
        workspaceId,
        userId,
        type: 'mention' as const,
        actorId,
        notepadId: card.notepadId,
        cardId,
        readAt: null,
        createdAt: now,
      }));
      statements.push(db.insert(t.notifications).values(values));
    }
  }

  await runBatch(db, statements);

  const [author] = await db
    .select({ name: t.user.name, image: t.user.image })
    .from(t.user)
    .where(eq(t.user.id, actorId));

  return {
    ...row,
    name: author?.name || 'Someone',
    image: author?.image ?? null,
    mentionedUserIds,
  };
}

export async function deleteComment(
  db: DB,
  workspaceId: string,
  cardId: string,
  commentId: string,
  actor: { userId: string; isOwner: boolean },
) {
  await requireCardForWorkspace(db, workspaceId, cardId);

  const [comment] = await db
    .select({ id: t.cardComments.id, userId: t.cardComments.userId })
    .from(t.cardComments)
    .where(and(eq(t.cardComments.id, commentId), eq(t.cardComments.cardId, cardId)));
  if (!comment) throw new HttpError(404, 'not_found', 'Comment not found');
  if (comment.userId !== actor.userId && !actor.isOwner) {
    throw new HttpError(403, 'forbidden', 'You can only delete your own comments');
  }

  await db.delete(t.cardComments).where(eq(t.cardComments.id, commentId));
  return { ok: true, commentId };
}
