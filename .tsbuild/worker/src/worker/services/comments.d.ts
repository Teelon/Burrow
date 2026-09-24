import type { DB } from '../db/client';
export declare function extractMentionedUserIds(content: string): string[];
export declare function listComments(db: DB, workspaceId: string, cardId: string): Promise<{
    id: string;
    cardId: string;
    userId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    name: string;
    image: string | null;
}[]>;
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
export declare function createComment(db: DB, workspaceId: string, cardId: string, actorId: string, content: string): Promise<CreateCommentResult>;
export declare function deleteComment(db: DB, workspaceId: string, cardId: string, commentId: string, actor: {
    userId: string;
    isOwner: boolean;
}): Promise<{
    ok: boolean;
    commentId: string;
}>;
