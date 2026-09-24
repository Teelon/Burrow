import type { IMemberRepository, Member } from '../infrastructure/types';
export interface ChangeRoleArgs {
    workspaceId: string;
    actorUserId: string;
    targetUserId: string;
    newRole: 'owner' | 'editor' | 'viewer';
}
export interface RemoveMemberArgs {
    workspaceId: string;
    actorUserId: string;
    targetUserId: string;
}
export declare class MemberService {
    private readonly repos;
    constructor(repos: {
        members: IMemberRepository;
    });
    listMembers(workspaceId: string): Promise<Member[]>;
    changeRole(args: ChangeRoleArgs): Promise<void>;
    removeMember(args: RemoveMemberArgs): Promise<void>;
}
