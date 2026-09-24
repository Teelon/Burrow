import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { and, asc, eq } from 'drizzle-orm'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import type { Env } from '../env'
import { requireRole, requireSession } from '../middleware/session'
import { HttpError } from '../lib/errors'

const createTagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().optional(),
})

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().optional(),
})

export const tagsRoutes = new Hono<Env>()
  .get(
    '/api/projects/:pid/tags',
    requireSession,
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('pid')

      const [project] = await db
        .select({ id: t.projects.id })
        .from(t.projects)
        .where(
          and(
            eq(t.projects.id, projectId),
            eq(t.projects.workspaceId, workspaceId),
          ),
        )
      if (!project) throw new HttpError(404, 'not_found', 'Project not found')

      const projectTags = await db
        .select()
        .from(t.tags)
        .where(eq(t.tags.projectId, projectId))
        .orderBy(asc(t.tags.name))

      return c.json(projectTags)
    },
  )
  .post(
    '/api/projects/:pid/tags',
    requireSession,
    requireRole('editor'),
    zValidator('json', createTagSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('pid')
      const { name, color } = c.req.valid('json')

      const [project] = await db
        .select({ id: t.projects.id })
        .from(t.projects)
        .where(
          and(
            eq(t.projects.id, projectId),
            eq(t.projects.workspaceId, workspaceId),
          ),
        )
      if (!project) throw new HttpError(404, 'not_found', 'Project not found')

      // Check if tag already exists for this project
      const [existing] = await db
        .select()
        .from(t.tags)
        .where(
          and(
            eq(t.tags.projectId, projectId),
            eq(t.tags.name, name),
          ),
        )
      if (existing) {
        return c.json(existing, 200)
      }

      const id = nanoid()
      const newTag = {
        id,
        projectId,
        name,
        color: color ?? null,
      }

      await db.insert(t.tags).values(newTag)
      return c.json(newTag, 201)
    },
  )
  .patch(
    '/api/tags/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateTagSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const tagId = c.req.param('id')
      const updates = c.req.valid('json')

      // Verify tag belongs to a project in caller's workspace
      const [tagWithProject] = await db
        .select({
          tag: t.tags,
          projectWorkspaceId: t.projects.workspaceId,
        })
        .from(t.tags)
        .innerJoin(t.projects, eq(t.tags.projectId, t.projects.id))
        .where(eq(t.tags.id, tagId))

      if (!tagWithProject || tagWithProject.projectWorkspaceId !== workspaceId) {
        throw new HttpError(404, 'not_found', 'Tag not found')
      }

      await db
        .update(t.tags)
        .set({
          name: updates.name ? updates.name : undefined,
          color: updates.color !== undefined ? updates.color : undefined,
        })
        .where(eq(t.tags.id, tagId))

      const [updated] = await db
        .select()
        .from(t.tags)
        .where(eq(t.tags.id, tagId))

      return c.json(updated)
    },
  )
  .delete(
    '/api/tags/:id',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const tagId = c.req.param('id')

      const [tagWithProject] = await db
        .select({
          tagId: t.tags.id,
          projectWorkspaceId: t.projects.workspaceId,
        })
        .from(t.tags)
        .innerJoin(t.projects, eq(t.tags.projectId, t.projects.id))
        .where(eq(t.tags.id, tagId))

      if (!tagWithProject || tagWithProject.projectWorkspaceId !== workspaceId) {
        throw new HttpError(404, 'not_found', 'Tag not found')
      }

      await db.delete(t.tags).where(eq(t.tags.id, tagId))
      return c.json({ ok: true })
    },
  )
