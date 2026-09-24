import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../env'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import { requireRole, requireSession } from '../middleware/session'
import { zValidator } from '../middleware/validator'
import { changeRole, removeMember } from '../services/members'

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'editor', 'viewer']),
})

export const membersRoutes = new Hono<Env>()
  .get('/api/members', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')

    const rows = await db
      .select({
        userId: t.members.userId,
        name: t.user.name,
        email: t.user.email,
        image: t.user.image,
        role: t.members.role,
        joinedAt: t.members.joinedAt,
      })
      .from(t.members)
      .innerJoin(t.user, eq(t.user.id, t.members.userId))
      .where(eq(t.members.workspaceId, workspaceId))

    return c.json(rows)
  })
  .patch(
    '/api/members/:userId',
    requireSession,
    requireRole('owner'),
    zValidator('json', updateRoleSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const actorUserId = c.get('userId')
      const targetUserId = c.req.param('userId')
      const { role } = c.req.valid('json')

      await changeRole(db, {
        workspaceId,
        actorUserId,
        targetUserId,
        newRole: role,
      })

      return c.json({ ok: true, userId: targetUserId, role })
    },
  )
  .delete(
    '/api/members/:userId',
    requireSession,
    requireRole('owner'),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const actorUserId = c.get('userId')
      const targetUserId = c.req.param('userId')

      await removeMember(db, {
        workspaceId,
        actorUserId,
        targetUserId,
      })

      return c.json({ ok: true, removedUserId: targetUserId })
    },
  )
