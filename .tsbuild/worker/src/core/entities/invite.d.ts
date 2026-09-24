/**
 * Invite entity and input types
 * Pure TypeScript — zero runtime dependencies
 */
export type InviteRole = 'editor' | 'viewer';
export interface Invite {
    id: string;
    workspaceId: string;
    email: string;
    role: InviteRole;
    token: string;
    expiresAt: Date;
    createdAt: Date;
    acceptedAt: Date | null;
    invitedBy: string;
}
export interface CreateInviteInput {
    id: string;
    workspaceId: string;
    email: string;
    role: InviteRole;
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
    createdAt: Date;
}
export interface AcceptInviteInput {
    token: string;
    userId: string;
    acceptedAt: Date;
}
