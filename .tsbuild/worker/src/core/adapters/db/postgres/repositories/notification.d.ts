import type { INotificationRepository, Notification } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresNotificationRepository implements INotificationRepository {
    private db;
    constructor(db: PostgresDb);
    listByUser(userId: string, workspaceId: string, unreadOnly: boolean): Promise<Notification[]>;
    markRead(userId: string, notificationIds: string[]): Promise<void>;
    markAllRead(userId: string): Promise<void>;
    createMentions(args: {
        workspaceId: string;
        notepadId: string;
        cardId: string | null;
        actorId: string;
        userIds: string[];
        now: number;
    }): Promise<void>;
    createAssignments(args: {
        workspaceId: string;
        notepadId: string;
        cardId: string;
        actorId: string;
        userIds: string[];
        now: number;
    }): Promise<void>;
}
