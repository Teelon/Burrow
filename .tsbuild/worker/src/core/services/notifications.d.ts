import type { INotificationRepository, Notification } from '../infrastructure/types';
export declare class NotificationService {
    private readonly repos;
    constructor(repos: {
        notifications: INotificationRepository;
    });
    listNotifications(userId: string, workspaceId: string, unreadOnly: boolean): Promise<Notification[]>;
    markRead(userId: string, notificationIds: string[]): Promise<void>;
}
