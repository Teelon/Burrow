import type { INotificationRepository, Notification } from '../infrastructure/types';

export class NotificationService {
  constructor(private readonly repos: { notifications: INotificationRepository }) {}

  async listNotifications(
    userId: string,
    workspaceId: string,
    unreadOnly: boolean,
  ): Promise<Notification[]> {
    return this.repos.notifications.listByUser(userId, workspaceId, unreadOnly);
  }

  async markRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length > 0) {
      await this.repos.notifications.markRead(userId, notificationIds);
    } else {
      await this.repos.notifications.markAllRead(userId);
    }
  }
}
