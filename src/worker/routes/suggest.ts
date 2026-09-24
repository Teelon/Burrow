import { Hono } from 'hono'
import { and, eq, isNull, like, or } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../env'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import { requireSession } from '../middleware/session'
import { zValidator } from '../middleware/validator'

const suggestQuerySchema = z.object({
  type: z.enum(['user', 'notepad', 'card', 'tag']),
  q: z.string().optional().default(''),
  projectId: z.string().optional(),
})

export const suggestRoutes = new Hono<Env>()
  .get(
    '/api/suggest',
    requireSession,
    zValidator('query', suggestQuerySchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const { type, q, projectId } = c.req.valid('query')
      const searchPattern = `%${q.trim()}%`

      if (type === 'user') {
        const rows = await db
          .select({
            id: t.user.id,
            label: t.user.name,
            email: t.user.email,
            image: t.user.image,
          })
          .from(t.members)
          .innerJoin(t.user, eq(t.user.id, t.members.userId))
          .where(
            and(
              eq(t.members.workspaceId, workspaceId),
              q.trim()
                ? or(
                    like(t.user.name, searchPattern),
                    like(t.user.email, searchPattern),
                  )
                : undefined,
            ),
          )
          .limit(8)

        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.label,
            description: r.email,
            image: r.image,
            kind: 'user' as const,
          })),
        )
      }

      if (type === 'notepad') {
        if (!projectId) return c.json([])

        const rows = await db
          .select({
            id: t.notepads.id,
            label: t.notepads.title,
            icon: t.notepads.icon,
          })
          .from(t.notepads)
          .where(
            and(
              eq(t.notepads.workspaceId, workspaceId),
              eq(t.notepads.projectId, projectId),
              eq(t.notepads.kind, 'notepad'),
              isNull(t.notepads.deletedAt),
              q.trim() ? like(t.notepads.title, searchPattern) : undefined,
            ),
          )
          .limit(8)

        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.label,
            icon: r.icon,
            kind: 'notepad' as const,
          })),
        )
      }

      if (type === 'card') {
        if (!projectId) return c.json([])

        const rows = await db
          .select({
            id: t.cards.id,
            label: t.notepads.title,
            boardName: t.boards.name,
            priority: t.cards.priority,
          })
          .from(t.cards)
          .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
          .innerJoin(t.boards, eq(t.boards.id, t.cards.boardId))
          .where(
            and(
              eq(t.boards.workspaceId, workspaceId),
              eq(t.boards.projectId, projectId),
              isNull(t.notepads.deletedAt),
              q.trim() ? like(t.notepads.title, searchPattern) : undefined,
            ),
          )
          .limit(8)

        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.label,
            description: r.boardName,
            priority: r.priority,
            kind: 'card' as const,
          })),
        )
      }

      if (type === 'tag') {
        if (!projectId) return c.json([])

        const rows = await db
          .select({
            id: t.tags.id,
            label: t.tags.name,
            color: t.tags.color,
          })
          .from(t.tags)
          .where(
            and(
              eq(t.tags.projectId, projectId),
              q.trim() ? like(t.tags.name, searchPattern) : undefined,
            ),
          )
          .limit(8)

        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.label,
            color: r.color,
            kind: 'tag' as const,
          })),
        )
      }

      return c.json([])
    },
  )
