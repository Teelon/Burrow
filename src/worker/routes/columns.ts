import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { createDb } from '../db/client';
import { requireRole, requireSession } from '../middleware/session';
import { zValidator } from '../middleware/validator';
import { createColumn, deleteColumn, moveColumn, updateColumn } from '../services/boards';

const createColumnSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional().nullable(),
});

const updateColumnSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional().nullable(),
  wipLimit: z.number().int().min(0).max(999).optional().nullable(),
});

const moveColumnSchema = z.object({
  afterId: z.string().optional().nullable(),
});

export const columnsRoutes = new Hono<Env>()
  .post(
    '/api/boards/:id/columns',
    requireSession,
    requireRole('editor'),
    zValidator('json', createColumnSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const boardId = c.req.param('id');
      const body = c.req.valid('json');

      const result = await createColumn(db, workspaceId, boardId, body.name, body.color);

      return c.json(result, 201);
    },
  )
  .patch(
    '/api/columns/:id',
    requireSession,
    requireRole('editor'),
    zValidator('json', updateColumnSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const columnId = c.req.param('id');
      const body = c.req.valid('json');

      await updateColumn(db, workspaceId, columnId, body);
      return c.json({ ok: true, columnId });
    },
  )
  .post(
    '/api/columns/:id/move',
    requireSession,
    requireRole('editor'),
    zValidator('json', moveColumnSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const columnId = c.req.param('id');
      const body = c.req.valid('json');

      const result = await moveColumn(db, workspaceId, columnId, body.afterId);
      return c.json(result);
    },
  )
  .delete(
    '/api/columns/:id',
    requireSession,
    requireRole('editor'),
    zValidator('query', z.object({ moveTo: z.string().optional() })),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const columnId = c.req.param('id');
      const { moveTo } = c.req.valid('query');

      await deleteColumn(db, workspaceId, columnId, moveTo || null);
      return c.json({ ok: true, deletedId: columnId });
    },
  );
