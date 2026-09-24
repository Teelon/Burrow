import type {
  INotificationRepository,
  Notification,
} from '../../../../infrastructure/types'
import { eq, and, inArray, desc, isNull } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import { notifications, user } from '../schema'

export class PostgresNotificationRepository implements INotificationRepository {
  constructor(private db: PostgresDb) {}

  async listByUser(userId: string, workspaceId: string, unreadOnly: boolean): Promise<Notification[]> {
    const whereConditions = [eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId)]
    if (unreadOnly) {
      whereConditions.push(isNull(notifications.readAt))
    }
    return this.db
      .select({
        id: notifications.id,
        workspaceId: notifications.workspaceId,
        userId: notifications.userId,
        type: notifications.type,
        actorId: notifications.actorId,
        actorName: user.name,
        notepadId: notifications.notepadId,
        cardId: notifications.cardId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .innerJoin(user, eq(user.id, notifications.actorId))
      .where(and(...whereConditions))
      .orderBy(desc(notifications.createdAt))
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return
    await this.db
      .update(notifications)
      .set({ readAt: Date.now() })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, notificationIds)))
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: Date.now() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  }

  async createMentions(args: {
    workspaceId: string
    notepadId: string
    cardId: string | null
    actorId: string
    userIds: string[]
    now: number
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
    }))
    if (values.length > 0) {
      await this.db.insert(notifications).values(values)
    }
  }
}