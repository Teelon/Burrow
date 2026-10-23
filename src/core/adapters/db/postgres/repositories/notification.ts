import type { INotificationRepository, Notification } from '../../../../infrastructure/types';
import { eq, and, inArray, desc, isNull } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import { notifications, user, notepads, cards } from '../schema';

export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private db: PostgresDb) {}

  async listByUser(
    userId: string,
    workspaceId: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    const whereConditions = [
      eq(notifications.userId, userId),
      eq(notifications.workspaceId, workspaceId),
    ];
    if (unreadOnly) {
      whereConditions.push(isNull(notifications.readAt));
    }
    const rows = await this.db
      .select({
        id: notifications.id,
        workspaceId: notifications.workspaceId,
        userId: notifications.userId,
        type: notifications.type,
        actorId: notifications.actorId,
        actorName: user.name,
        actorImage: user.image,
        notepadId: notifications.notepadId,
        cardId: notifications.cardId,
        notepadTitle: notepads.title,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .innerJoin(user, eq(user.id, notifications.actorId))
      .leftJoin(notepads, eq(notepads.id, notifications.notepadId))
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const missingCardIds = rows.filter((r) => !r.notepadTitle && r.cardId).map((r) => r.cardId!);
    const cardTitles = new Map<string, string>();
    if (missingCardIds.length > 0) {
      const cardRows = await this.db
        .select({ cardId: cards.id, title: notepads.title })
        .from(cards)
        .innerJoin(notepads, eq(notepads.id, cards.notepadId))
        .where(inArray(cards.id, missingCardIds));
      for (const cr of cardRows) {
        cardTitles.set(cr.cardId, cr.title);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      userId: r.userId,
      type: r.type,
      actorId: r.actorId,
      actorName: r.actorName,
      actorImage: r.actorImage ?? null,
      targetTitle: r.notepadTitle ?? (r.cardId ? cardTitles.get(r.cardId) : null) ?? null,
      notepadId: r.notepadId,
      cardId: r.cardId,
      readAt: r.readAt ?? null,
      createdAt: r.createdAt,
    })) as any;
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    await this.db
      .update(notifications)
      .set({ readAt: Date.now() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, notificationIds)));
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: Date.now() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }

  async createMentions(args: {
    workspaceId: string;
    notepadId: string;
    cardId: string | null;
    actorId: string;
    userIds: string[];
    now: number;
  }): Promise<void> {
    const values = args.userIds.map((userId) => ({
      id: `notif_${args.now}_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: args.workspaceId,
      userId,
      type: 'mention' as const,
      actorId: args.actorId,
      notepadId: args.notepadId,
      cardId: args.cardId,
      readAt: null,
      createdAt: args.now,
    }));
    if (values.length > 0) {
      await this.db.insert(notifications).values(values);
    }
  }

  async createAssignments(args: {
    workspaceId: string;
    notepadId: string;
    cardId: string;
    actorId: string;
    userIds: string[];
    now: number;
  }): Promise<void> {
    const values = args.userIds.map((userId) => ({
      id: `notif_${args.now}_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: args.workspaceId,
      userId,
      type: 'assigned' as const,
      actorId: args.actorId,
      notepadId: args.notepadId,
      cardId: args.cardId,
      readAt: null,
      createdAt: args.now,
    }));
    if (values.length > 0) {
      await this.db.insert(notifications).values(values);
    }
  }
}
