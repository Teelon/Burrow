import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Env } from '../env';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import { requireRole, requireSession } from '../middleware/session';
import { zValidator } from '../middleware/validator';
import {
  createCard,
  createSubtask,
  deleteCard,
  deleteSubtask,
  getCard,
  getCardsSummary,
  getMyTasks,
  moveCard,
  permanentDeleteCard,
  restoreCard,
  updateCard,
  updateSubtask,
} from '../services/cards';
import { createComment, deleteComment, listComments } from '../services/comments';
import { HttpError } from '../lib/errors';

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
});

const updateCardSchema = z.object({
  title: z.string().min(1).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
  dueDate: z.number().int().optional().nullable(),
  assigneeIds: z.array(z.string()).optional(),
  tagIds: z.array(z.string()).optional(),
});

const moveCardSchema = z.object({
  columnId: z.string().min(1),
  afterId: z.string().optional().nullable(),
});

const createSubtaskSchema = z.object({
  title: z.string().min(1),
});

const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  completed: z.boolean().optional(),
  afterId: z.string().optional().nullable(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(10_000),
});

const myTasksQuerySchema = z.object({
  status: z.enum(['all', 'open', 'completed']).optional(),
  projectId: z.string().optional(),
});

export const cardsRoutes = new Hono<Env>()
  .get('/api/my-tasks', requireSession, zValidator('query', myTasksQuerySchema), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const userId = c.get('userId');
    const { status, projectId } = c.req.valid('query');

    const tasks = await getMyTasks(db, workspaceId, userId, {
      status: status ?? 'all',
      projectId: projectId || undefined,
    });
    return c.json(tasks);
  })
  .get('/api/cards/summary', requireSession, async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const idsParam = c.req.query('ids') || '';
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const summaries = await getCardsSummary(db, workspaceId, ids);
    return c.json(summaries);
  })
  .post(
    '/api/columns/:id/cards',
    requireSession,
    requireRole('editor'),
    zValidator('json', quickAddCardSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const actorId = c.get('userId');
      const columnId = c.req.param('id');
      const body = c.req.valid('json');

      // Look up column to find boardId
      const [col] = await db
        .select({ id: t.boardColumns.id, boardId: t.boardColumns.boardId })
        .from(t.boardColumns)
        .where(eq(t.boardColumns.id, columnId));

      if (!col) {
        throw new HttpError(404, 'not_found', 'Column not found');
      }

      const result = await createCard(db, {
        workspaceId,
        actorId,
        boardId: col.boardId,
        columnId,
        title: body.title,
        priority: body.priority,
        dueDate: body.dueDate,
        assigneeIds: body.assigneeIds,
        tagIds: body.tagIds,
        notepad: body.notepad,
      });

      return c.json(result, 201);
    },
  )
  .get('/api/cards/:id', requireSession, async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const cardId = c.req.param('id');

    const card = await getCard(db, workspaceId, cardId);
    return c.json(card);
  })
  .patch(
    '/api/cards/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateCardSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const actorId = c.get('userId');
      const cardId = c.req.param('id');
      const body = c.req.valid('json');

      const result = await updateCard(db, workspaceId, cardId, body, actorId);
      return c.json(result);
    },
  )
  .post(
    '/api/cards/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveCardSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const cardId = c.req.param('id');
      const body = c.req.valid('json');

      const result = await moveCard(db, workspaceId, cardId, body.columnId, body.afterId);
      return c.json(result);
    },
  )
  .delete('/api/cards/:id', requireSession, requireRole('editor'), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const cardId = c.req.param('id');

    await deleteCard(db, workspaceId, cardId);
    return c.json({ ok: true, deletedId: cardId });
  })
  .post('/api/cards/:id/restore', requireSession, requireRole('editor'), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const cardId = c.req.param('id');

    await restoreCard(db, workspaceId, cardId);
    return c.json({ ok: true, restoredId: cardId });
  })
  .delete('/api/cards/:id/permanent', requireSession, requireRole('owner'), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const cardId = c.req.param('id');

    await permanentDeleteCard(db, workspaceId, cardId);
    return c.json({ ok: true, permanentlyDeletedId: cardId });
  })
  // --- Subtasks (checklists) ---
  .post(
    '/api/cards/:id/subtasks',
    requireSession,
    requireRole('editor'),
    zValidator('json', createSubtaskSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const cardId = c.req.param('id');
      const { title } = c.req.valid('json');

      const result = await createSubtask(db, workspaceId, cardId, title);
      return c.json(result, 201);
    },
  )
  .patch(
    '/api/cards/:id/subtasks/:subtaskId',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateSubtaskSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const cardId = c.req.param('id');
      const subtaskId = c.req.param('subtaskId');
      const body = c.req.valid('json');

      const result = await updateSubtask(db, workspaceId, cardId, subtaskId, body);
      return c.json(result);
    },
  )
  .delete(
    '/api/cards/:id/subtasks/:subtaskId',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const cardId = c.req.param('id');
      const subtaskId = c.req.param('subtaskId');

      const result = await deleteSubtask(db, workspaceId, cardId, subtaskId);
      return c.json(result);
    },
  )
  // --- Comments (discussion thread) ---
  .get('/api/cards/:id/comments', requireSession, async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const cardId = c.req.param('id');

    const comments = await listComments(db, workspaceId, cardId);
    return c.json(comments);
  })
  .post(
    '/api/cards/:id/comments',
    requireSession,
    requireRole('editor'),
    zValidator('json', createCommentSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const actorId = c.get('userId');
      const cardId = c.req.param('id');
      const { content } = c.req.valid('json');

      const result = await createComment(db, workspaceId, cardId, actorId, content);
      return c.json(result, 201);
    },
  )
  .delete(
    '/api/cards/:id/comments/:commentId',
    requireSession,
    requireRole('editor'),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const cardId = c.req.param('id');
      const commentId = c.req.param('commentId');

      const result = await deleteComment(db, workspaceId, cardId, commentId, {
        userId: c.get('userId'),
        isOwner: c.get('role') === 'owner',
      });
      return c.json(result);
    },
  );
