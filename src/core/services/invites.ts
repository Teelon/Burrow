import { nanoid } from 'nanoid'
import type { IInviteRepository, IMemberRepository, IWorkspaceRepository, Invite, CreateInviteData } from '../infrastructure/types'
import { notFound, badRequest } from './errors'
import { hashToken } from '../shared/crypto'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export class InviteService {
  constructor(private readonly repos: { invites: IInviteRepository; members: IMemberRepository; workspaces: IWorkspaceRepository }) {}

  async createInvite(
    workspaceId: string,
    userId: string,
    email: string,
    role: 'editor' | 'viewer',
  ): Promise<{ invite: Invite; token: string; url: string }> {
    const rawToken = nanoid(32)
    const tokenHash = await hashToken(rawToken)
    const id = nanoid()
    const now = Date.now()
    const expiresAt = now + SEVEN_DAYS_MS

    const invite: CreateInviteData = {
      id,
      workspaceId,
      email,
      role,
      tokenHash,
      invitedBy: userId,
      expiresAt,
      createdAt: now,
    }

    await this.repos.invites.create(invite)

    return {
      invite: { ...invite, acceptedAt: null },
      token: rawToken,
      url: '', // URL constructed by caller with origin
    }
  }

  async listPendingInvites(workspaceId: string): Promise<Invite[]> {
    return this.repos.invites.listPending(workspaceId)
  }

  async getInviteInfo(token: string): Promise<Invite & { workspaceName: string }> {
    const tokenHash = await hashToken(token)
    const invite = await this.repos.invites.findByTokenHash(tokenHash)
    if (!invite) throw notFound('invalid_invite', 'Invalid or expired invite')

    const now = Date.now()
    if (invite.acceptedAt !== null) {
      throw badRequest('invite_already_accepted', 'This invite has already been accepted')
    }
    if (invite.expiresAt <= now) {
      throw badRequest('invite_expired', 'This invite has expired')
    }

    // Fetch workspace name from workspace repository
    const workspace = await this.repos.workspaces.findById(invite.workspaceId)
    const workspaceName = workspace?.name ?? 'Workspace'

    return { ...invite, workspaceName }
  }

  async deleteInvite(workspaceId: string, inviteId: string): Promise<void> {
    await this.repos.invites.delete(inviteId, workspaceId)
  }

  async acceptInvite(userId: string, token: string): Promise<{ workspaceId: string; role: 'editor' | 'viewer' }> {
    // Check if user already belongs to a workspace - we need to check all workspaces
    // For now, we'll use a workaround since findByUserId requires workspaceId
    const tokenHash = await hashToken(token)
    const now = Date.now()

    const invite = await this.repos.invites.findByTokenHash(tokenHash)
    if (!invite || invite.acceptedAt !== null || invite.expiresAt <= now) {
      throw badRequest('invalid_invite', 'Invalid or expired invite')
    }

    // Check if user is already a member of the invite's workspace
    const existingMember = await this.repos.members.findByUserId(invite.workspaceId, userId)
    if (existingMember) {
      throw badRequest('already_in_workspace', 'You already belong to a workspace')
    }

    await this.repos.invites.accept(invite.id)
    await this.repos.members.create({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      joinedAt: now,
    })

    return { workspaceId: invite.workspaceId, role: invite.role }
  }
}