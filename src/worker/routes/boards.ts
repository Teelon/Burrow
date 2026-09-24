import { Hono } from 'hono'
import { z } from 'zod'
import type { Env } from '../env'
import { createDb } from '../db/client'
import { requireRole, requireSession } from '../middleware/session'
import { zValidator } from '../middleware/validator'
import {
  createBoard,
  getBoard,
  listBoards,
  permanentDeleteBoard,
  restoreBoard,
  softDeleteBoard,
  updateBoard,
} from '../services/boards'

const createBoardSchema = z.object({
  name: z.string().min(1),
  icon: z.string().optional().nullable(),
})

const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  icon: z.string().optional().nullable(),
})

export const boardsRoutes = new Hono<Env>()
  .get('/api/projects/:pid/boards', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')

    const boards = await listBoards(db, workspaceId, projectId)
    return c.json(boards)
  })
  .post(
    '/api/projects/:pid/boards',
    requireSession,
    requireRole('editor'),
    zValidator('json', createBoardSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('pid')
      const body = c.req.valid('json')

      const result = await createBoard(db, {
        workspaceId,
        projectId,
        name: body.name,
        icon: body.icon,
      })

      return c.json(result, 201)
    },
  )
  .get('/api/boards/:id', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')

    const board = await getBoard(db, workspaceId, boardId)
    return c.json(board)
  })
  .patch(
    '/api/boards/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateBoardSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const boardId = c.req.param('id')
      const body = c.req.valid('json')

      await updateBoard(db, workspaceId, boardId, body)
      return c.json({ ok: true, boardId })
    },
  )
  .delete('/api/boards/:id', requireSession, requireRole('editor'), async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')

    await softDeleteBoard(db, workspaceId, boardId)
    return c.json({ ok: true, deletedId: boardId })
  })
  .post('/api/boards/:id/restore', requireSession, requireRole('editor'), async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')

    await restoreBoard(db, workspaceId, boardId)
    return c.json({ ok: true, restoredId: boardId })
  })
  .delete('/api/boards/:id/permanent', requireSession, requireRole('owner'), async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')

    await permanentDeleteBoard(db, workspaceId, boardId)
    return c.json({ ok: true, permanentlyDeletedId: boardId })
  })
