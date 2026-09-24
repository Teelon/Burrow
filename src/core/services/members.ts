import type { IMemberRepository, Member } from '../infrastructure/types';
import { notFound, badRequest } from './errors';

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

export class MemberService {
  constructor(private readonly repos: { members: IMemberRepository }) {}

  async listMembers(workspaceId: string): Promise<Member[]> {
    return this.repos.members.listByWorkspace(workspaceId);
  }

  async changeRole(args: ChangeRoleArgs): Promise<void> {
    const targetMember = await this.repos.members.findByUserId(args.workspaceId, args.targetUserId);
    if (!targetMember) {
      throw notFound('not_found', 'Member not found');
    }

    if (targetMember.role === 'owner' && args.newRole !== 'owner') {
      // Check if target is the last owner
      const owners = await this.repos.members.listOwners(args.workspaceId);
      if (owners.length <= 1) {
        throw badRequest(
          'cannot_demote_last_owner',
          'Cannot demote the last owner of the workspace',
        );
      }
    }

    await this.repos.members.updateRole(args.workspaceId, args.targetUserId, args.newRole);
  }

  async removeMember(args: RemoveMemberArgs): Promise<void> {
    const targetMember = await this.repos.members.findByUserId(args.workspaceId, args.targetUserId);
    if (!targetMember) {
      throw notFound('not_found', 'Member not found');
    }

    if (targetMember.role === 'owner') {
      const owners = await this.repos.members.listOwners(args.workspaceId);
      if (owners.length <= 1) {
        throw badRequest(
          'cannot_remove_last_owner',
          'Cannot remove the last owner of the workspace',
        );
      }
    }

    // Invariant I10: Removing a member deletes that member's card_assignees rows in the same batch
    await this.repos.members.remove(args.workspaceId, args.targetUserId);
    await this.repos.members.deleteSessions(args.targetUserId);
  }
}
