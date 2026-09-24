import type { DB } from '../db/client';
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
export declare function changeRole(db: DB, args: ChangeRoleArgs): Promise<void>;
export declare function removeMember(db: DB, args: RemoveMemberArgs): Promise<void>;
