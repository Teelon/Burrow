/**
 * Notification entity and input types
 * Pure TypeScript — zero runtime dependencies
 */
export type NotificationType = 'mention' | 'assigned';
export interface Notification {
    id: string;
    workspaceId: string;
    userId: string;
    type: NotificationType;
    actorId: string;
    notepadId: string | null;
    cardId: string | null;
    readAt: Date | null;
    createdAt: Date;
}
export interface CreateNotificationInput {
    id: string;
    workspaceId: string;
    userId: string;
    type: NotificationType;
    actorId: string;
    notepadId?: string | null;
    cardId?: string | null;
    createdAt: Date;
}
export interface MarkNotificationReadInput {
    notificationId: string;
    userId: string;
    readAt: Date;
}
