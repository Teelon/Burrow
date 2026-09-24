import type { DB } from '../client';
import * as t from '../schema';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { runBatch } from '../lib/batch';
import { chunkByParamBudget, chunkInList } from '../lib/chunk';
import type { INotificationRepository, Notification } from '../../../../infrastructure/types';

export function createNotificationRepository(db: DB): INotificationRepository {
  return {
    async listByUser(
      userId: string,
      workspaceId: string,
      unreadOnly: boolean,
    ): Promise<Notification[]> {
      const rows = await db
        .select({
          id: t.notifications.id,
          workspaceId: t.notifications.workspaceId,
          userId: t.notifications.userId,
          type: t.notifications.type,
          actorId: t.notifications.actorId,
          actorName: t.user.name,
          notepadId: t.notifications.notepadId,
          cardId: t.notifications.cardId,
          readAt: t.notifications.readAt,
          createdAt: t.notifications.createdAt,
        })
        .from(t.notifications)
        .innerJoin(t.user, eq(t.user.id, t.notifications.actorId))
        .where(
          and(
            eq(t.notifications.userId, userId),
            eq(t.notifications.workspaceId, workspaceId),
            unreadOnly ? isNull(t.notifications.readAt) : undefined,
          ),
        )
        .orderBy(desc(t.notifications.createdAt))
        .limit(50);
      return rows.map(mapNotification);
    },

    async markRead(userId: string, notificationIds: string[]): Promise<void> {
      const now = Date.now();
      if (notificationIds.length === 0) {
        await db
          .update(t.notifications)
          .set({ readAt: now })
          .where(and(eq(t.notifications.userId, userId), isNull(t.notifications.readAt)));
        return;
      }
      const statements: BatchItem<'sqlite'>[] = [];
      for (const chunk of chunkInList(notificationIds, 2)) {
        statements.push(
          db
            .update(t.notifications)
            .set({ readAt: now })
            .where(and(eq(t.notifications.userId, userId), inArray(t.notifications.id, chunk))),
        );
      }
      await runBatch(db, statements);
    },

    async markAllRead(userId: string): Promise<void> {
      const now = Date.now();
      await db
        .update(t.notifications)
        .set({ readAt: now })
        .where(and(eq(t.notifications.userId, userId), isNull(t.notifications.readAt)));
    },

    async createMentions(args: {
      workspaceId: string;
      notepadId: string;
      cardId: string | null;
      actorId: string;
      userIds: string[];
      now: number;
    }): Promise<void> {
      const { workspaceId, notepadId, cardId, actorId, userIds, now } = args;
      const statements: BatchItem<'sqlite'>[] = [];
      for (const chunk of chunkByParamBudget(userIds, 9, 0)) {
        const values = chunk.map((userId) => ({
          id: crypto.randomUUID(), // Using crypto.randomUUID() for unique IDs
          workspaceId,
          userId,
          type: 'mention' as const,
          actorId,
          notepadId,
          cardId,
          readAt: null,
          createdAt: now,
        }));
        statements.push(db.insert(t.notifications).values(values));
      }
      if (statements.length > 0) await runBatch(db, statements);
    },
  };
}

function mapNotification(row: {
  id: string;
  workspaceId: string;
  userId: string;
  type: 'mention' | 'assigned';
  actorId: string;
  actorName: string | null;
  notepadId: string | null;
  cardId: string | null;
  readAt: number | null;
  createdAt: number;
}): Notification {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    type: row.type,
    actorId: row.actorId,
    actorName: row.actorName,
    notepadId: row.notepadId,
    cardId: row.cardId,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
  };
}
