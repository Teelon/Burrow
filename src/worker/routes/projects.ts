import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env'
import { createDb } from '../db/client'
import { requireRole, requireSession } from '../middleware/session'
import { zValidator } from '../middleware/validator'
import {
  createProject,
  listProjects,
  moveProject,
  permanentDeleteProject,
  updateProject,
} from '../services/projects'

const createProjectSchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  archived: z.boolean().optional(),
})

const moveProjectSchema = z.object({
  afterId: z.string().optional().nullable(),
})

const deleteProjectQuerySchema = z.object({
  confirm: z.string().min(1),
})

export const projectsRoutes = new Hono<Env>()
  .get('/api/projects', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const projects = await listProjects(db, workspaceId)
    return c.json(projects)
  })
  .post(
    '/api/projects',
    requireSession,
    requireRole('editor'),
    zValidator('json', createProjectSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const body = c.req.valid('json')

      const result = await createProject(db, {
        workspaceId,
        name: body.name,
        icon: body.icon,
        color: body.color,
      })

      return c.json(result, 201)
    },
  )
  .patch(
    '/api/projects/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateProjectSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const body = c.req.valid('json')

      await updateProject(db, {
        workspaceId,
        projectId,
        name: body.name,
        icon: body.icon,
        color: body.color,
        archived: body.archived,
      })

      return c.json({ ok: true, projectId })
    },
  )
  .post(
    '/api/projects/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveProjectSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const body = c.req.valid('json')

      const result = await moveProject(db, {
        workspaceId,
        projectId,
        afterId: body.afterId,
      })

      return c.json({ ok: true, projectId, position: result.position })
    },
  )
  .delete(
    '/api/projects/:id',
    requireSession,
    requireRole('owner'),
    zValidator('query', deleteProjectQuerySchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const { confirm: confirmName } = c.req.valid('query')

      await permanentDeleteProject(db, {
        workspaceId,
        projectId,
        confirmName,
        filesBucket: c.env.FILES,
      })

      return c.json({ ok: true, deletedProjectId: projectId })
    },
  )
