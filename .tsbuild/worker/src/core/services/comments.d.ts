import type { ICardRepository, INotepadRepository } from '../infrastructure/types';
export declare function extractMentionedUserIds(content: string): string[];
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
export declare class CommentService {
    private readonly repos;
    constructor(repos: {
        cards: ICardRepository;
        notepads: INotepadRepository;
        members: {
            findByUserIds: (workspaceId: string, userIds: string[]) => Promise<{
                userId: string;
            }[]>;
        };
        notifications: {
            createMentions: (args: any) => Promise<void>;
        };
    });
    listComments(workspaceId: string, cardId: string): Promise<import("..").Comment[]>;
    createComment(workspaceId: string, cardId: string, actorId: string, content: string): Promise<CreateCommentResult>;
    deleteComment(workspaceId: string, cardId: string, commentId: string, actor: {
        userId: string;
        isOwner: boolean;
    }): Promise<{
        ok: true;
        commentId: string;
    }>;
    private requireCardForWorkspace;
    private getUser;
}
