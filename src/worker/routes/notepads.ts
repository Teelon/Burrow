import { Hono } from 'hono'
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import { z } from 'zod'
import type { Env } from '../env'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import { requireRole, requireSession } from '../middleware/session'
import { zValidator } from '../middleware/validator'
import {
  claimLock,
  createNotepad,
  moveNotepad,
  permanentDeleteNotepad,
  releaseLock,
  restoreNotepad,
  saveContent,
  setNotepadTags,
  softDeleteNotepad,
} from '../services/notepads'
import { HttpError } from '../lib/errors'

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

export const notepadsRoutes = new Hono<Env>()
  // Tree metadata only (excludes cards and deleted)
  .get('/api/projects/:pid/notepads', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')

    const rows = await db
      .select({
        id: t.notepads.id,
        parentId: t.notepads.parentId,
        title: t.notepads.title,
        icon: t.notepads.icon,
        position: t.notepads.position,
        isFavorite: t.notepads.isFavorite,
      })
      .from(t.notepads)
      .where(
        and(
          eq(t.notepads.projectId, projectId),
          eq(t.notepads.workspaceId, workspaceId),
          eq(t.notepads.kind, 'notepad'),
          isNull(t.notepads.deletedAt),
        ),
      )
      .orderBy(t.notepads.position)

    return c.json(rows)
  })
  .post(
    '/api/projects/:pid/notepads',
    requireSession,
    requireRole('editor'),
    zValidator('json', createNotepadSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const userId = c.get('userId')
      const projectId = c.req.param('pid')
      const body = c.req.valid('json')

      const result = await createNotepad(db, {
        workspaceId,
        projectId,
        parentId: body.parentId,
        title: body.title,
        createdBy: userId,
      })

      return c.json(result, 201)
    },
  )
  .get('/api/notepads/:id', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const notepadId = c.req.param('id')

    const [notepad] = await db
      .select()
      .from(t.notepads)
      .where(
        and(
          eq(t.notepads.id, notepadId),
          eq(t.notepads.workspaceId, workspaceId),
        ),
      )

    if (!notepad) throw new HttpError(404, 'not_found', 'Notepad not found')

    // Tags
    const tags = await db
      .select({
        id: t.tags.id,
        name: t.tags.name,
        color: t.tags.color,
      })
      .from(t.notepadTags)
      .innerJoin(t.tags, eq(t.tags.id, t.notepadTags.tagId))
      .where(eq(t.notepadTags.notepadId, notepadId))

    // Backlinks: source notepads linking here (excluding deleted sources)
    const backlinks = await db
      .select({
        id: t.notepads.id,
        title: t.notepads.title,
        icon: t.notepads.icon,
      })
      .from(t.notepadLinks)
      .innerJoin(t.notepads, eq(t.notepads.id, t.notepadLinks.sourceId))
      .where(
        and(
          eq(t.notepadLinks.targetType, notepad.kind),
          eq(t.notepadLinks.targetId, notepadId),
          isNull(t.notepads.deletedAt),
        ),
      )

    // Current lock state
    const now = Date.now()
    const [lockRow] = await db
      .select()
      .from(t.editLocks)
      .where(eq(t.editLocks.notepadId, notepadId))

    let lock: {
      userId: string
      clientId: string
      name: string
      expiresAt: number
      isMe: boolean
    } | null = null
    if (lockRow && lockRow.expiresAt > now) {
      const [holder] = await db
        .select({ name: t.user.name })
        .from(t.user)
        .where(eq(t.user.id, lockRow.userId))
      lock = {
        userId: lockRow.userId,
        clientId: lockRow.clientId,
        name: holder?.name || 'Someone',
        expiresAt: lockRow.expiresAt,
        isMe: lockRow.userId === c.get('userId'),
      }
    }

    return c.json({
      ...notepad,
      tags,
      backlinks,
      lock,
    })
  })
  .patch(
    '/api/notepads/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', patchNotepadSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const body = c.req.valid('json')

      const [notepad] = await db
        .select()
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.id, notepadId),
            eq(t.notepads.workspaceId, workspaceId),
          ),
        )
      if (!notepad) throw new HttpError(404, 'not_found', 'Notepad not found')

      const updates: Partial<typeof t.notepads.$inferInsert> = {
        updatedAt: Date.now(),
      }
      if (body.title !== undefined) updates.title = body.title.trim() || 'Untitled'
      if (body.icon !== undefined) updates.icon = body.icon
      if (body.coverKey !== undefined) updates.coverKey = body.coverKey
      if (body.isFavorite !== undefined) updates.isFavorite = body.isFavorite

      await db
        .update(t.notepads)
        .set(updates)
        .where(eq(t.notepads.id, notepadId))

      return c.json({ ok: true, notepadId })
    },
  )
  .put(
    '/api/notepads/:id/content',
    requireSession,
    requireRole('editor'),
    zValidator('json', saveContentSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const actorId = c.get('userId')
      const notepadId = c.req.param('id')
      const { content, baseVersion, clientId } = c.req.valid('json')

      const [notepad] = await db
        .select()
        .from(t.notepads)
        .where(
          and(
            eq(t.notepads.id, notepadId),
            eq(t.notepads.workspaceId, workspaceId),
          ),
        )
      if (!notepad) throw new HttpError(404, 'not_found', 'Notepad not found')

      try {
        const result = await saveContent(db, {
          notepadId,
          content,
          baseVersion,
          actorId,
          clientId,
        })
        return c.json(result)
      } catch (err: unknown) {
        if (err instanceof HttpError && err.code === 'locked') {
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
  .post(
    '/api/notepads/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveNotepadSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const { parentId, afterId } = c.req.valid('json')

      const result = await moveNotepad(db, {
        workspaceId,
        notepadId,
        parentId,
        afterId,
      })

      return c.json(result)
    },
  )
  .delete(
    '/api/notepads/:id',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')

      await softDeleteNotepad(db, { workspaceId, notepadId })
      return c.json({ ok: true, deletedId: notepadId })
    },
  )
  .post(
    '/api/notepads/:id/restore',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')

      await restoreNotepad(db, { workspaceId, notepadId })
      return c.json({ ok: true, restoredId: notepadId })
    },
  )
  .delete(
    '/api/notepads/:id/permanent',
    requireSession,
    requireRole('owner'),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')

      await permanentDeleteNotepad(db, {
        workspaceId,
        notepadId,
        filesBucket: c.env.FILES,
      })
      return c.json({ ok: true, permanentlyDeletedId: notepadId })
    },
  )
  .get('/api/projects/:pid/trash', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')

    const notepads = await db
      .select({
        id: t.notepads.id,
        kind: t.notepads.kind,
        title: t.notepads.title,
        icon: t.notepads.icon,
        deletedAt: t.notepads.deletedAt,
      })
      .from(t.notepads)
      .where(
        and(
          eq(t.notepads.projectId, projectId),
          eq(t.notepads.workspaceId, workspaceId),
          isNotNull(t.notepads.deletedAt),
        ),
      )
      .orderBy(desc(t.notepads.deletedAt))

    const boards = await db
      .select({
        id: t.boards.id,
        name: t.boards.name,
        icon: t.boards.icon,
        deletedAt: t.boards.deletedAt,
      })
      .from(t.boards)
      .where(
        and(
          eq(t.boards.projectId, projectId),
          eq(t.boards.workspaceId, workspaceId),
          isNotNull(t.boards.deletedAt),
        ),
      )
      .orderBy(desc(t.boards.deletedAt))

    return c.json({ notepads, boards })
  })
  .get('/api/projects/:pid/recent', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const workspaceId = c.get('workspaceId')
    const projectId = c.req.param('pid')

    const recent = await db
      .select({
        id: t.notepads.id,
        title: t.notepads.title,
        icon: t.notepads.icon,
        updatedAt: t.notepads.updatedAt,
      })
      .from(t.notepads)
      .where(
        and(
          eq(t.notepads.projectId, projectId),
          eq(t.notepads.workspaceId, workspaceId),
          eq(t.notepads.kind, 'notepad'),
          isNull(t.notepads.deletedAt),
        ),
      )
      .orderBy(desc(t.notepads.updatedAt))
      .limit(10)

    return c.json(recent)
  })
  .post(
    '/api/notepads/:id/lock',
    requireSession,
    requireRole('editor'),
    zValidator('json', lockSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const userId = c.get('userId')
      const notepadId = c.req.param('id')
      const { clientId, takeover } = c.req.valid('json')

      try {
        const result = await claimLock(db, {
          notepadId,
          userId,
          clientId,
          takeover,
        })
        return c.json(result)
      } catch (err: unknown) {
        if (err instanceof HttpError && err.code === 'locked') {
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
  .delete(
    '/api/notepads/:id/lock',
    requireSession,
    requireRole('editor'),
    zValidator('json', lockSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const userId = c.get('userId')
      const notepadId = c.req.param('id')
      const { clientId } = c.req.valid('json')

      await releaseLock(db, {
        notepadId,
        userId,
        clientId,
      })
      return c.json({ ok: true })
    },
  )
  .put(
    '/api/notepads/:id/tags',
    requireSession,
    requireRole('editor'),
    zValidator('json', tagsSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const notepadId = c.req.param('id')
      const { tagIds } = c.req.valid('json')

      await setNotepadTags(db, notepadId, tagIds, workspaceId)
      return c.json({ ok: true, notepadId, tagIds })
    },
  )
