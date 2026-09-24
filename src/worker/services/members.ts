import { and, eq, sql } from 'drizzle-orm'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { HttpError } from '../lib/errors'
import { runBatch } from '../lib/batch'

export interface ChangeRoleArgs {
  workspaceId: string
  actorUserId: string
  targetUserId: string
  newRole: 'owner' | 'editor' | 'viewer'
}

export interface RemoveMemberArgs {
  workspaceId: string
  actorUserId: string
  targetUserId: string
}

export async function changeRole(db: DB, args: ChangeRoleArgs): Promise<void> {
  const [targetMember] = await db
    .select()
    .from(t.members)
    .where(
      and(
        eq(t.members.workspaceId, args.workspaceId),
        eq(t.members.userId, args.targetUserId),
      ),
    )

  if (!targetMember) {
    throw new HttpError(404, 'not_found', 'Member not found')
  }

  if (targetMember.role === 'owner' && args.newRole !== 'owner') {
    // Check if target is the last owner
    const owners = await db
      .select({ userId: t.members.userId })
      .from(t.members)
      .where(
        and(
          eq(t.members.workspaceId, args.workspaceId),
          eq(t.members.role, 'owner'),
        ),
      )
    if (owners.length <= 1) {
      throw new HttpError(
        400,
        'cannot_demote_last_owner',
        'Cannot demote the last owner of the workspace',
      )
    }
  }

  await db
    .update(t.members)
    .set({ role: args.newRole })
    .where(
      and(
        eq(t.members.workspaceId, args.workspaceId),
        eq(t.members.userId, args.targetUserId),
      ),
    )
}

export async function removeMember(
  db: DB,
  args: RemoveMemberArgs,
): Promise<void> {
  const [targetMember] = await db
    .select()
    .from(t.members)
    .where(
      and(
        eq(t.members.workspaceId, args.workspaceId),
        eq(t.members.userId, args.targetUserId),
      ),
    )

  if (!targetMember) {
    throw new HttpError(404, 'not_found', 'Member not found')
  }

  if (targetMember.role === 'owner') {
    const owners = await db
      .select({ userId: t.members.userId })
      .from(t.members)
      .where(
        and(
          eq(t.members.workspaceId, args.workspaceId),
          eq(t.members.role, 'owner'),
        ),
      )
    if (owners.length <= 1) {
      throw new HttpError(
        400,
        'cannot_remove_last_owner',
        'Cannot remove the last owner of the workspace',
      )
    }
  }

  // Invariant I10: Removing a member deletes that member's card_assignees rows in the same batch
  await runBatch(db, [
    db.run(sql`
      DELETE FROM card_assignees
      WHERE user_id = ${args.targetUserId}
        AND card_id IN (
          SELECT c.id FROM cards c
          INNER JOIN boards b ON b.id = c.board_id
          WHERE b.workspace_id = ${args.workspaceId}
        )
    `),
    db
      .delete(t.members)
      .where(
        and(
          eq(t.members.workspaceId, args.workspaceId),
          eq(t.members.userId, args.targetUserId),
        ),
      ),
    db.delete(t.session).where(eq(t.session.userId, args.targetUserId)),
  ])
}
