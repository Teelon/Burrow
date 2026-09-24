/**
 * Member entity and input types
 * Pure TypeScript — zero runtime dependencies
 */
export type MemberRole = 'owner' | 'editor' | 'viewer';
export interface Member {
    workspaceId: string;
    userId: string;
    role: MemberRole;
    joinedAt: Date;
}
export interface AddMemberInput {
    workspaceId: string;
    userId: string;
    role: MemberRole;
    joinedAt: Date;
}
export interface ChangeRoleInput {
    workspaceId: string;
    targetUserId: string;
    newRole: MemberRole;
}
export interface RemoveMemberInput {
    workspaceId: string;
    targetUserId: string;
}
