import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import type { Infrastructure } from './infrastructure/types'
import { securityHeaders, bodyLimit } from './middleware/security'
import { createSessionMiddleware, requireSession, requireRole } from './middleware/session'
import { httpError, isHttpError } from './services/errors'
import { ProjectService } from './services/projects'
import { NotepadService } from './services/notepads'
import { BoardService } from './services/boards'
import { CardService } from './services/cards'
import { MemberService } from './services/members'
import { CommentService } from './services/comments'
import { NotificationService } from './services/notifications'
import { TagService } from './services/tags'
import { InviteService } from './services/invites'
import { nanoid } from 'nanoid'
import { hashToken } from './shared/crypto'

// Type for Hono context with our custom variables
interface Env {
  Variables: {
    userId: string
    workspaceId: string
    role: 'owner' | 'editor' | 'viewer'
  }
}

/**
 * Create the core Hono app with all routes registered.
 * This factory can be called from both Worker and Node entrypoints.
 */
export function createCoreApp(infra: Infrastructure) {
  const { repositories, storage, search, locks, auth, bootstrapToken } = infra
  const projects = new ProjectService({
    projects: repositories.projects,
    notepads: repositories.notepads,
    boards: repositories.boards,
    tags: repositories.tags,
  })
  const notepads = new NotepadService(
    { notepads: repositories.notepads, tags: repositories.tags },
    locks,
    storage,
  )
  const boards = new BoardService({
    boards: repositories.boards,
    cards: repositories.cards,
  })
  const cards = new CardService({
    cards: repositories.cards,
    notepads: repositories.notepads,
    tags: repositories.tags,
    boards: repositories.boards,
  })
  const members = new MemberService({ members: repositories.members })
  const comments = new CommentService({
    cards: repositories.cards,
    notepads: repositories.notepads,
    members: repositories.members,
    notifications: repositories.notifications,
  })
  const notifications = new NotificationService({ notifications: repositories.notifications })
  const tags = new TagService({ tags: repositories.tags })
  const invites = new InviteService({
    invites: repositories.invites,
    members: repositories.members,
    workspaces: repositories.workspaces,
  })

  // Build the app
  const app = new Hono<Env>()
    .use('*', securityHeaders)
    .use('/api/*', bodyLimit())
    .use('/api/*', createSessionMiddleware(auth, repositories.members))
    .get('/api/health', (c) => c.json({ ok: true, now: Date.now() }))

  // ---------------------------------------------------------------------------
  // Auth routes: custom bootstrap sign-up, then delegate to auth provider
  // ---------------------------------------------------------------------------
  const signUpSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    bootstrapToken: z.string().optional(),
    inviteToken: z.string().optional(),
  })

  app.post('/api/auth/sign-up/email', zValidator('json', signUpSchema), async (c) => {
    const body = c.req.valid('json')
    const providedBootstrapToken = body.bootstrapToken
    const inviteToken = body.inviteToken

    // Check if this is the first workspace
    const workspaceCount = await repositories.workspaces.count()
    const isFirstWorkspace = workspaceCount === 0

    let inviteToAccept: { id: string; workspaceId: string; role: 'owner' | 'editor' | 'viewer' } | null = null

    if (isFirstWorkspace) {
      if (
        !providedBootstrapToken ||
        typeof providedBootstrapToken !== 'string' ||
        providedBootstrapToken !== bootstrapToken
      ) {
        return c.json(
          {
            error: {
              code: 'invalid_bootstrap_token',
              message: 'Valid bootstrap token required for initial sign-up',
            },
          },
          403,
        )
      }
    } else {
      if (!inviteToken || typeof inviteToken !== 'string') {
        return c.json(
          {
            error: {
              code: 'invite_required',
              message: 'Invite token is required to register',
            },
          },
          403,
        )
      }

      const tokenHash = await hashToken(inviteToken)
      const now = Date.now()
      const invite = await repositories.invites.findByTokenHash(tokenHash)

      if (!invite || invite.acceptedAt !== null || invite.expiresAt <= now) {
        return c.json(
          {
            error: {
              code: 'invalid_invite',
              message: 'Invalid or expired invite token',
            },
          },
          403,
        )
      }

      inviteToAccept = {
        id: invite.id,
        workspaceId: invite.workspaceId,
        role: invite.role,
      }
    }

    // Forward sanitized request to Better Auth
    const { bootstrapToken: _b, inviteToken: _i, ...betterAuthBody } = body
    const forwardReq = new Request(c.req.url, {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify(betterAuthBody),
    })

    const authRes = await auth.handler(forwardReq)
    if (!authRes.ok) {
      return authRes
    }

    const authData = (await authRes.clone().json()) as { user?: { id: string } }
    const userId = authData.user?.id
    if (!userId) {
      return authRes
    }

    const now = Date.now()

    if (isFirstWorkspace) {
      const workspaceId = nanoid()
      const projectId = nanoid()

      await repositories.workspaces.create({
        id: workspaceId,
        name: 'My Workspace',
        createdBy: userId,
        createdAt: now,
      })
      await repositories.members.create({
        workspaceId,
        userId,
        role: 'owner',
        joinedAt: now,
      })
      await repositories.projects.create({
        id: projectId,
        workspaceId,
        name: 'My first project',
        icon: null,
        color: null,
        position: 'a0',
        createdAt: now,
        updatedAt: now,
      })
      const welcomeNotepadId = nanoid()
      await repositories.notepads.create({
        id: welcomeNotepadId,
        workspaceId,
        projectId,
        parentId: null,
        title: 'Welcome to Burrow',
        createdBy: userId,
        position: 'a0',
        kind: 'notepad',
        content: '[]',
        version: 1,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      })
      // Insert FTS row for the welcome notepad to satisfy invariant I7
      await repositories.notepads.insertFts(welcomeNotepadId, 'Welcome to Burrow', '')
    } else if (inviteToAccept) {
      await repositories.invites.accept(inviteToAccept.id)
      await repositories.members.create({
        workspaceId: inviteToAccept.workspaceId,
        userId,
        role: inviteToAccept.role,
        joinedAt: now,
      })
    }

    return authRes
  })

  // ---------------------------------------------------------------------------
  // Auth routes (delegated to auth provider handler)
  // ---------------------------------------------------------------------------
  app.all('/api/auth/*', async (c) => {
    return auth.handler(c.req.raw)
  })

  app.get('/api/me', requireSession, async (c) => {
    const userId = c.get('userId')
    const workspaceId = c.get('workspaceId')
    const role = c.get('role')

    // Get the first project for this workspace as the default/last project
    const projectsList = await repositories.projects.listByWorkspace(workspaceId)
    const lastProjectId = projectsList[0]?.id ?? null

    return c.json({
      user: { id: userId, name: '', email: '', image: null },
      workspace: { id: workspaceId, name: '' },
      role,
      lastProjectId,
    })
  })

  // ---------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------
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

  app.get('/api/projects', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const projectList = await projects.listProjects(workspaceId)
    return c.json(projectList)
  })

  app.post(
    '/api/projects',
    requireSession,
    requireRole('editor'),
    zValidator('json', createProjectSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const body = c.req.valid('json')
      const result = await projects.createProject({
        workspaceId,
        name: body.name,
        icon: body.icon,
        color: body.color,
      })
      return c.json(result, 201)
    },
  )

  app.patch(
    '/api/projects/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateProjectSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const body = c.req.valid('json')
      await projects.updateProject({
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

  app.post(
    '/api/projects/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveProjectSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const body = c.req.valid('json')
      const result = await projects.moveProject({
        workspaceId,
        projectId,
        afterId: body.afterId,
      })
      return c.json({ ok: true, projectId, position: result.position })
    },
  )

  app.delete(
    '/api/projects/:id',
    requireSession,
    requireRole('owner'),
    zValidator('query', deleteProjectQuerySchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('id')
      const { confirm: confirmName } = c.req.valid('query')
      await projects.permanentDeleteProject({
        workspaceId,
        projectId,
        confirmName,
      })
      return c.json({ ok: true, deletedProjectId: projectId })
    },
  )

  // ---------------------------------------------------------------------------
  // Notepads
  // ---------------------------------------------------------------------------
  const createNotepadSchema = z.object({
    parentId: z.string().optional().nullable(),
    title: z.string().optional(),
  })

  const patchNotepadSchema = z.object({
    title: z.string().optional(),
    icon: z.string().optional().nullable(),
    coverKey: z.string().optional().nullable(),
    isFavorite: z.boolean().optional(),
  })

  const saveContentSchema = z.object({
    content: z.string(),
    baseVersion: z.number().int().min(1),
    clientId: z.string().optional(),
  })

  const moveNotepadSchema = z.object({
    parentId: z.string().optional().nullable(),
    afterId: z.string().optional().nullable(),
  })

  const lockSchema = z.object({
    clientId: z.string().min(1),
    takeover: z.boolean().optional(),
  })

  const tagsSchema = z.object({
    tagIds: z.array(z.string()),
  })

  app.get('/api/projects/:pid/notepads', requireSession, async (c) => {
    const projectId = c.req.param('pid')
    const notepadList = await notepads.listByProject(projectId)
    return c.json(notepadList.map((n) => ({
      id: n.id,
      parentId: n.parentId,
      title: n.title,
      icon: n.icon,
      position: n.position,
      isFavorite: n.isFavorite,
    })))
  })

  app.post(
    '/api/projects/:pid/notepads',
    requireSession,
    requireRole('editor'),
    zValidator('json', createNotepadSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const userId = c.get('userId')
      const projectId = c.req.param('pid')
      const body = c.req.valid('json')
      const result = await notepads.createNotepad({
        workspaceId,
        projectId,
        parentId: body.parentId,
        title: body.title,
        createdBy: userId,
      })
      return c.json(result, 201)
    },
  )

  app.get('/api/notepads/:id', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const notepadId = c.req.param('id')
    const notepad = await repositories.notepads.findByIdAndWorkspace(notepadId, workspaceId)
    if (!notepad) throw httpError(404, 'not_found', 'Notepad not found')

    const tagIds = await repositories.notepads.listTagIds(notepadId)
    const tagList = await Promise.all(tagIds.map((id) => repositories.tags.findById(id)))
    const tags = tagList.filter((t): t is any => t !== null)

    const lock = await repositories.notepads.getLock(notepadId)
    let lockInfo = null
    if (lock && lock.expiresAt > Date.now()) {
      lockInfo = {
        userId: lock.userId,
        clientId: lock.clientId,
        name: 'Someone',
        expiresAt: lock.expiresAt,
        isMe: lock.userId === c.get('userId'),
      }
    }

    return c.json({
      ...notepad,
      tags,
      backlinks: [],
      lock: lockInfo,
    })
  })

  app.patch(
    '/api/notepads/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', patchNotepadSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const body = c.req.valid('json')

      const notepad = await repositories.notepads.findByIdAndWorkspace(notepadId, workspaceId)
      if (!notepad) throw httpError(404, 'not_found', 'Notepad not found')

      const updates: any = { updatedAt: Date.now() }
      if (body.title !== undefined) updates.title = body.title.trim() || 'Untitled'
      if (body.icon !== undefined) updates.icon = body.icon
      if (body.coverKey !== undefined) updates.coverKey = body.coverKey
      if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite

      await repositories.notepads.update(notepadId, updates)
      return c.json({ ok: true, notepadId })
    },
  )

  app.put(
    '/api/notepads/:id/content',
    requireSession,
    requireRole('editor'),
    zValidator('json', saveContentSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorId = c.get('userId')
      const notepadId = c.req.param('id')
      const { content, baseVersion, clientId } = c.req.valid('json')

      const notepad = await repositories.notepads.findByIdAndWorkspace(notepadId, workspaceId)
      if (!notepad) throw httpError(404, 'not_found', 'Notepad not found')

      try {
        const result = await notepads.saveContent({
          notepadId,
          content,
          baseVersion,
          actorId,
          clientId,
        })
        return c.json(result)
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && err.code === 'locked') {
          try {
            const parsed = JSON.parse(err.message)
            return c.json({ error: parsed }, 409)
          } catch {
            return c.json({ error: { code: 'locked', message: err.message } }, 409)
          }
        }
        throw err
      }
    },
  )

  app.post(
    '/api/notepads/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveNotepadSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const { parentId, afterId } = c.req.valid('json')
      const result = await notepads.moveNotepad({ workspaceId, notepadId, parentId, afterId })
      return c.json(result)
    },
  )

  app.delete(
    '/api/notepads/:id',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      await notepads.softDeleteNotepad({ workspaceId, notepadId })
      return c.json({ ok: true, deletedId: notepadId })
    },
  )

  app.post(
    '/api/notepads/:id/restore',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      await notepads.restoreNotepad({ workspaceId, notepadId })
      return c.json({ ok: true, restoredId: notepadId })
    },
  )

  app.delete(
    '/api/notepads/:id/permanent',
    requireSession,
    requireRole('owner'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      await notepads.permanentDeleteNotepad({ workspaceId, notepadId, storage })
      return c.json({ ok: true, permanentlyDeletedId: notepadId })
    },
  )

  app.get('/api/projects/:pid/trash', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')
    const project = await repositories.projects.findByIdAndWorkspace(projectId, workspaceId)
    if (!project) throw httpError(404, 'not_found', 'Project not found')

    const [notepads, boards] = await Promise.all([
      repositories.notepads.listDeletedByProject(projectId),
      repositories.boards.listDeletedByProject(projectId),
    ])
    return c.json({ notepads, boards })
  })

  app.get('/api/projects/:pid/recent', requireSession, async (c) => {
    return c.json([])
  })

  app.post(
    '/api/notepads/:id/lock',
    requireSession,
    requireRole('editor'),
    zValidator('json', lockSchema),
    async (c) => {
      const userId = c.get('userId')
      const notepadId = c.req.param('id')
      const { clientId, takeover } = c.req.valid('json')
      try {
        const result = await notepads.claimLock({ notepadId, userId, clientId, takeover })
        return c.json(result)
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && err.code === 'locked') {
          try {
            const parsed = JSON.parse(err.message)
            return c.json({ error: parsed }, 409)
          } catch {
            return c.json({ error: { code: 'locked', message: err.message } }, 409)
          }
        }
        throw err
      }
    },
  )

  app.delete(
    '/api/notepads/:id/lock',
    requireSession,
    requireRole('editor'),
    zValidator('json', lockSchema),
    async (c) => {
      const userId = c.get('userId')
      const notepadId = c.req.param('id')
      const { clientId } = c.req.valid('json')
      await notepads.releaseLock({ notepadId, userId, clientId })
      return c.json({ ok: true })
    },
  )

  app.put(
    '/api/notepads/:id/tags',
    requireSession,
    requireRole('editor'),
    zValidator('json', tagsSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const { tagIds } = c.req.valid('json')
      await notepads.setNotepadTags(notepadId, tagIds, workspaceId)
      return c.json({ ok: true, notepadId, tagIds })
    },
  )

  // ---------------------------------------------------------------------------
  // Boards
  // ---------------------------------------------------------------------------
  const createBoardSchema = z.object({
    name: z.string().min(1),
    icon: z.string().optional().nullable(),
  })

  const updateBoardSchema = z.object({
    name: z.string().min(1).optional(),
    icon: z.string().optional().nullable(),
  })

  app.get('/api/projects/:pid/boards', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')
    const boardList = await boards.listBoards(workspaceId, projectId)
    return c.json(boardList)
  })

  app.post(
    '/api/projects/:pid/boards',
    requireSession,
    requireRole('editor'),
    zValidator('json', createBoardSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('pid')
      const body = c.req.valid('json')
      const result = await boards.createBoard({ workspaceId, projectId, name: body.name, icon: body.icon })
      return c.json(result, 201)
    },
  )

  app.get('/api/boards/:id', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')
    const board = await boards.getBoard(workspaceId, boardId)
    return c.json(board)
  })

  app.patch(
    '/api/boards/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateBoardSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const boardId = c.req.param('id')
      const body = c.req.valid('json')
      await boards.updateBoard(workspaceId, boardId, body)
      return c.json({ ok: true, boardId })
    },
  )

  app.delete('/api/boards/:id', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')
    await boards.softDeleteBoard(workspaceId, boardId)
    return c.json({ ok: true, deletedId: boardId })
  })

  app.post('/api/boards/:id/restore', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')
    await boards.restoreBoard(workspaceId, boardId)
    return c.json({ ok: true, restoredId: boardId })
  })

  app.delete('/api/boards/:id/permanent', requireSession, requireRole('owner'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const boardId = c.req.param('id')
    await boards.permanentDeleteBoard(workspaceId, boardId)
    return c.json({ ok: true, permanentlyDeletedId: boardId })
  })

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------
  const createColumnSchema = z.object({
    name: z.string().min(1),
    color: z.string().optional().nullable(),
  })

  const updateColumnSchema = z.object({
    name: z.string().min(1).optional(),
    color: z.string().optional().nullable(),
    wipLimit: z.number().int().min(0).max(999).optional().nullable(),
  })

  const moveColumnSchema = z.object({
    afterId: z.string().optional().nullable(),
  })

  app.post(
    '/api/boards/:id/columns',
    requireSession,
    requireRole('editor'),
    zValidator('json', createColumnSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const boardId = c.req.param('id')
      const body = c.req.valid('json')
      const result = await boards.createColumn(workspaceId, boardId, body.name, body.color)
      return c.json(result, 201)
    },
  )

  app.patch(
    '/api/columns/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateColumnSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const columnId = c.req.param('id')
      const body = c.req.valid('json')
      await boards.updateColumn(workspaceId, columnId, body)
      return c.json({ ok: true, columnId })
    },
  )

  app.post(
    '/api/columns/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveColumnSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const columnId = c.req.param('id')
      const body = c.req.valid('json')
      const result = await boards.moveColumn(workspaceId, columnId, body.afterId)
      return c.json(result)
    },
  )

  app.delete(
    '/api/columns/:id',
    requireSession,
    requireRole('editor'),
    zValidator('query', z.object({ moveTo: z.string().optional() })),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const columnId = c.req.param('id')
      const { moveTo } = c.req.valid('query')
      await boards.deleteColumn(workspaceId, columnId, moveTo || null)
      return c.json({ ok: true, deletedId: columnId })
    },
  )

  // ---------------------------------------------------------------------------
  // Cards
  // ---------------------------------------------------------------------------
  const quickAddCardSchema = z.object({
    title: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
    dueDate: z.number().int().optional().nullable(),
    assigneeIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
    notepad: z
      .discriminatedUnion('mode', [
        z.object({ mode: z.literal('new') }),
        z.object({ mode: z.literal('existing'), id: z.string() }),
      ])
      .optional(),
  })

  const updateCardSchema = z.object({
    title: z.string().min(1).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
    dueDate: z.number().int().optional().nullable(),
    assigneeIds: z.array(z.string()).optional(),
    tagIds: z.array(z.string()).optional(),
  })

  const moveCardSchema = z.object({
    columnId: z.string().min(1),
    afterId: z.string().optional().nullable(),
  })

  const createSubtaskSchema = z.object({
    title: z.string().min(1),
  })

  const updateSubtaskSchema = z.object({
    title: z.string().min(1).optional(),
    completed: z.boolean().optional(),
    afterId: z.string().optional().nullable(),
  })

  const createCommentSchema = z.object({
    content: z.string().min(1).max(10_000),
  })

  const myTasksQuerySchema = z.object({
    status: z.enum(['all', 'open', 'completed']).optional(),
    projectId: z.string().optional(),
  })

  app.get('/api/my-tasks', requireSession, zValidator('query', myTasksQuerySchema), async (c) => {
    const workspaceId = c.get('workspaceId')
    const userId = c.get('userId')
    const { status, projectId } = c.req.valid('query')
    const tasks = await cards.getMyTasks(workspaceId, userId, {
      status: status ?? 'all',
      projectId: projectId || undefined,
    })
    return c.json(tasks)
  })

  app.get('/api/cards/summary', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const idsParam = c.req.query('ids') || ''
    const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean)
    const summaries = await cards.getCardsSummary(workspaceId, ids)
    return c.json(summaries)
  })

  app.post(
    '/api/columns/:id/cards',
    requireSession,
    requireRole('editor'),
    zValidator('json', quickAddCardSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorId = c.get('userId')
      const columnId = c.req.param('id')
      const body = c.req.valid('json')

      const column = await repositories.boards.findColumnByIdAndWorkspace(columnId, workspaceId)
      if (!column) throw httpError(404, 'not_found', 'Column not found')

      const result = await cards.createCard({
        workspaceId,
        actorId,
        boardId: column.boardId,
        columnId,
        title: body.title,
        priority: body.priority,
        dueDate: body.dueDate,
        assigneeIds: body.assigneeIds,
        tagIds: body.tagIds,
        notepad: body.notepad,
      })
      return c.json(result, 201)
    },
  )

  app.get('/api/cards/:id', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const cardId = c.req.param('id')
    const card = await cards.getCard(workspaceId, cardId)
    return c.json(card)
  })

  app.patch(
    '/api/cards/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateCardSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorId = c.get('userId')
      const cardId = c.req.param('id')
      const body = c.req.valid('json')
      const result = await cards.updateCard(workspaceId, cardId, body, actorId)
      return c.json(result)
    },
  )

  app.post(
    '/api/cards/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveCardSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const cardId = c.req.param('id')
      const body = c.req.valid('json')
      const result = await cards.moveCard(workspaceId, cardId, body.columnId, body.afterId)
      return c.json(result)
    },
  )

  app.delete('/api/cards/:id', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const cardId = c.req.param('id')
    await cards.deleteCard(workspaceId, cardId)
    return c.json({ ok: true, deletedId: cardId })
  })

  app.post('/api/cards/:id/restore', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const cardId = c.req.param('id')
    await cards.restoreCard(workspaceId, cardId)
    return c.json({ ok: true, restoredId: cardId })
  })

  app.delete('/api/cards/:id/permanent', requireSession, requireRole('owner'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const cardId = c.req.param('id')
    await cards.permanentDeleteCard(workspaceId, cardId)
    return c.json({ ok: true, permanentlyDeletedId: cardId })
  })

  // --- Subtasks ---
  app.post(
    '/api/cards/:id/subtasks',
    requireSession,
    requireRole('editor'),
    zValidator('json', createSubtaskSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const cardId = c.req.param('id')
      const { title } = c.req.valid('json')
      const result = await cards.createSubtask(workspaceId, cardId, title)
      return c.json(result, 201)
    },
  )

  app.patch(
    '/api/cards/:id/subtasks/:subtaskId',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateSubtaskSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const cardId = c.req.param('id')
      const subtaskId = c.req.param('subtaskId')
      const body = c.req.valid('json')
      const result = await cards.updateSubtask(workspaceId, cardId, subtaskId, body)
      return c.json(result)
    },
  )

  app.delete(
    '/api/cards/:id/subtasks/:subtaskId',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const cardId = c.req.param('id')
      const subtaskId = c.req.param('subtaskId')
      const result = await cards.deleteSubtask(workspaceId, cardId, subtaskId)
      return c.json(result)
    },
  )

  // --- Comments ---
  app.get('/api/cards/:id/comments', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const cardId = c.req.param('id')
    const commentsList = await comments.listComments(workspaceId, cardId)
    return c.json(commentsList)
  })

  app.post(
    '/api/cards/:id/comments',
    requireSession,
    requireRole('editor'),
    zValidator('json', createCommentSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorId = c.get('userId')
      const cardId = c.req.param('id')
      const { content } = c.req.valid('json')
      const result = await comments.createComment(workspaceId, cardId, actorId, content)
      return c.json(result, 201)
    },
  )

  app.delete(
    '/api/cards/:id/comments/:commentId',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const cardId = c.req.param('id')
      const commentId = c.req.param('commentId')
      const result = await comments.deleteComment(workspaceId, cardId, commentId, {
        userId: c.get('userId'),
        isOwner: c.get('role') === 'owner',
      })
      return c.json(result)
    },
  )

  // ---------------------------------------------------------------------------
  // Members
  // ---------------------------------------------------------------------------
  const updateRoleSchema = z.object({
    role: z.enum(['owner', 'editor', 'viewer']),
  })

  app.get('/api/members', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const rows = await members.listMembers(workspaceId)
    return c.json(rows)
  })

  app.patch(
    '/api/members/:userId',
    requireSession,
    requireRole('owner'),
    zValidator('json', updateRoleSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorUserId = c.get('userId')
      const targetUserId = c.req.param('userId')
      const { role } = c.req.valid('json')
      await members.changeRole({ workspaceId, actorUserId, targetUserId, newRole: role })
      return c.json({ ok: true, userId: targetUserId, role })
    },
  )

  app.delete(
    '/api/members/:userId',
    requireSession,
    requireRole('owner'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const actorUserId = c.get('userId')
      const targetUserId = c.req.param('userId')
      await members.removeMember({ workspaceId, actorUserId, targetUserId })
      return c.json({ ok: true, removedUserId: targetUserId })
    },
  )

  // ---------------------------------------------------------------------------
  // Invites
  // ---------------------------------------------------------------------------
  const createInviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['editor', 'viewer']),
  })

  const acceptInviteSchema = z.object({
    token: z.string().min(1),
  })

  app.post(
    '/api/invites',
    requireSession,
    requireRole('owner'),
    zValidator('json', createInviteSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const userId = c.get('userId')
      const { email, role } = c.req.valid('json')
      const result = await invites.createInvite(workspaceId, userId, email, role)
      const origin = new URL(c.req.url).origin
      return c.json({
        id: result.invite.id,
        email,
        role,
        token: result.token,
        expiresAt: result.invite.expiresAt,
        url: `${origin}/invite/${result.token}`,
      })
    },
  )

  app.get('/api/invites', requireSession, requireRole('owner'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const pending = await invites.listPendingInvites(workspaceId)
    return c.json(pending)
  })

  app.get('/api/invites/info/:token', async (c) => {
    const rawToken = c.req.param('token')
    if (!rawToken) throw httpError(400, 'invalid_token', 'Invite token is required')
    const info = await invites.getInviteInfo(rawToken)
    return c.json({
      valid: true,
      token: rawToken,
      email: info.email,
      role: info.role,
      workspaceName: info.workspaceName,
      expiresAt: info.expiresAt,
    })
  })

  app.delete('/api/invites/:id', requireSession, requireRole('owner'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const id = c.req.param('id')
    await invites.deleteInvite(workspaceId, id)
    return c.json({ ok: true, id })
  })

  app.post(
    '/api/invites/accept',
    requireSession,
    zValidator('json', acceptInviteSchema),
    async (c) => {
      const userId = c.get('userId')
      const { token } = c.req.valid('json')
      const result = await invites.acceptInvite(userId, token)
      return c.json({ ok: true, ...result })
    },
  )

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------
  const createTagSchema = z.object({
    name: z.string().trim().min(1).max(50),
    color: z.string().optional(),
  })

  const updateTagSchema = z.object({
    name: z.string().trim().min(1).max(50).optional(),
    color: z.string().optional(),
  })

  app.get('/api/projects/:pid/tags', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')
    const project = await repositories.projects.findByIdAndWorkspace(projectId, workspaceId)
    if (!project) throw httpError(404, 'not_found', 'Project not found')
    const projectTags = await tags.listTags(projectId)
    return c.json(projectTags)
  })

  app.post(
    '/api/projects/:pid/tags',
    requireSession,
    requireRole('editor'),
    zValidator('json', createTagSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const projectId = c.req.param('pid')
      const { name, color } = c.req.valid('json')
      const project = await repositories.projects.findByIdAndWorkspace(projectId, workspaceId)
      if (!project) throw httpError(404, 'not_found', 'Project not found')
      const newTag = await tags.createTag(workspaceId, projectId, name, color)
      return c.json(newTag, 201)
    },
  )

  app.patch(
    '/api/tags/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateTagSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const tagId = c.req.param('id')
      const updates = c.req.valid('json')
      const updated = await tags.updateTag(workspaceId, tagId, updates)
      return c.json(updated)
    },
  )

  app.delete(
    '/api/tags/:id',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const tagId = c.req.param('id')
      await tags.deleteTag(workspaceId, tagId)
      return c.json({ ok: true })
    },
  )

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------
  const markReadSchema = z.object({
    ids: z.array(z.string()).optional(),
  })

  app.get('/api/notifications', requireSession, async (c) => {
    const userId = c.get('userId')
    const workspaceId = c.get('workspaceId')
    const unreadOnly = c.req.query('unread') === '1'
    const rows = await notifications.listNotifications(userId, workspaceId, unreadOnly)
    return c.json(rows)
  })

  app.post(
    '/api/notifications/read',
    requireSession,
    zValidator('json', markReadSchema),
    async (c) => {
      const userId = c.get('userId')
      const body = c.req.valid('json')
      await notifications.markRead(userId, body.ids || [])
      return c.json({ ok: true })
    },
  )

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  const searchSchema = z.object({
    q: z.string().default(''),
    projectId: z.string().optional(),
    scope: z.enum(['project', 'all']).default('project'),
  })

  app.get(
    '/api/search',
    requireSession,
    zValidator('query', searchSchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const { q, projectId, scope } = c.req.valid('query')
      const trimmedQ = q.trim()
      if (!trimmedQ) return c.json([])

      if (scope === 'project' && projectId) {
        const project = await repositories.projects.findByIdAndWorkspace(projectId, workspaceId)
        if (!project) throw httpError(404, 'not_found', 'Project not found')
      }

      const results = await search.search({
        workspaceId,
        projectId: scope === 'project' ? projectId : undefined,
        text: trimmedQ,
        limit: 25,
      })
      return c.json(results)
    },
  )

  // ---------------------------------------------------------------------------
  // Suggest
  // ---------------------------------------------------------------------------
  const suggestQuerySchema = z.object({
    type: z.enum(['user', 'notepad', 'card', 'tag']),
    q: z.string().optional().default(''),
    projectId: z.string().optional(),
  })

  app.get(
    '/api/suggest',
    requireSession,
    zValidator('query', suggestQuerySchema),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const { type, q, projectId } = c.req.valid('query')
      const searchPattern = `%${q.trim()}%`

      if (type === 'user') {
        const rows = await repositories.members.findByPattern(workspaceId, searchPattern, 8)
        return c.json(
          rows.map((r) => ({
            id: r.userId,
            label: r.name,
            description: r.email,
            image: r.image,
            kind: 'user' as const,
          })),
        )
      }

      if (type === 'notepad') {
        if (!projectId) return c.json([])
        const rows = await repositories.notepads.findByPattern(projectId, searchPattern, 8)
        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.title,
            icon: r.icon,
            kind: 'notepad' as const,
          })),
        )
      }

      if (type === 'card') {
        if (!projectId) return c.json([])
        const rows = await repositories.cards.findByPattern(projectId, searchPattern, 8)
        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.title,
            description: r.boardName,
            priority: r.priority,
            kind: 'card' as const,
          })),
        )
      }

      if (type === 'tag') {
        if (!projectId) return c.json([])
        const rows = await repositories.tags.findByPattern(projectId, searchPattern, 8)
        return c.json(
          rows.map((r) => ({
            id: r.id,
            label: r.name,
            color: r.color,
            kind: 'tag' as const,
          })),
        )
      }

      return c.json([])
    },
  )

  // ---------------------------------------------------------------------------
  // Files (uploads)
  // ---------------------------------------------------------------------------
  const ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/svg+xml',
  ])
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
  const EXTENSION_MAP: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  }

  app.post('/api/uploads', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      throw httpError(400, 'invalid_file', 'No file provided in form field "file"')
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw httpError(400, 'invalid_mime_type', `File type ${file.type} not allowed`)
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw httpError(413, 'payload_too_large', 'Image exceeds 5 MB limit')
    }

    const ext = EXTENSION_MAP[file.type] || 'bin'
    const key = `${workspaceId}/${nanoid()}.${ext}`

    if (storage) {
      await storage.put(key, await file.arrayBuffer(), file.type)
    }

    const origin = new URL(c.req.url).origin
    return c.json({ key, url: `${origin}/api/files/${encodeURIComponent(key)}` })
  })

  app.get('/api/files/:key', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const key = decodeURIComponent(c.req.param('key'))

    if (!key.startsWith(`${workspaceId}/`)) {
      throw httpError(404, 'not_found', 'File not found')
    }

    if (!storage) {
      throw httpError(404, 'not_found', 'File storage not configured')
    }

    const object = await storage.get(key)
    if (!object) throw httpError(404, 'not_found', 'File not found')

    const headers = new Headers()
    headers.set('Content-Type', object.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')

    return new Response(object.body as any, { headers })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  app.onError((err, c) => {
    if (isHttpError(err)) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status as any,
      )
    }
    console.error('unhandled error', err)
    return c.json({ error: { code: 'internal_error', message: 'Internal server error' } }, 500)
  })

  app.notFound((c) =>
    c.json({ error: { code: 'not_found', message: 'Not found' } }, 404),
  )

  return app
}