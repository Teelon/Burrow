import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import type { Env } from '../env';
import { requireSession } from '../middleware/session';
import { HttpError } from '../lib/errors';
import { SqliteFtsSearchAdapter } from '../adapters/search/sqlite-fts';
import type { SearchHit } from '../adapters/search/types';

const searchSchema = z.object({
  q: z.string().default(''),
  projectId: z.string().optional(),
  scope: z.enum(['project', 'all']).default('project'),
});

export type SearchResult = SearchHit;

export const searchRoutes = new Hono<Env>().get(
  '/api/search',
  requireSession,
  zValidator('query', searchSchema),
  async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const { q, projectId, scope } = c.req.valid('query');

    const trimmedQ = q.trim();
    if (!trimmedQ) {
      return c.json([]);
    }

    // If scope is project, verify project belongs to workspace
    if (scope === 'project' && projectId) {
      const [project] = await db
        .select({ id: t.projects.id })
        .from(t.projects)
        .where(and(eq(t.projects.id, projectId), eq(t.projects.workspaceId, workspaceId)));
      if (!project) throw new HttpError(404, 'not_found', 'Project not found');
    }

    const adapter = new SqliteFtsSearchAdapter(db);
    const results = await adapter.search({
      workspaceId,
      projectId: scope === 'project' ? projectId : undefined,
      text: trimmedQ,
      limit: 25,
    });

    return c.json(results);
  },
);
