import type { IInviteRepository, IMemberRepository, IWorkspaceRepository, Invite } from '../infrastructure/types';
export declare class InviteService {
    private readonly repos;
    constructor(repos: {
        invites: IInviteRepository;
        members: IMemberRepository;
        workspaces: IWorkspaceRepository;
    });
    createInvite(workspaceId: string, userId: string, email: string, role: 'editor' | 'viewer'): Promise<{
        invite: Invite;
        token: string;
        url: string;
    }>;
    listPendingInvites(workspaceId: string): Promise<Invite[]>;
    getInviteInfo(token: string): Promise<Invite & {
        workspaceName: string;
    }>;
    deleteInvite(workspaceId: string, inviteId: string): Promise<void>;
    acceptInvite(userId: string, token: string): Promise<{
        workspaceId: string;
        role: 'editor' | 'viewer';
    }>;
}
