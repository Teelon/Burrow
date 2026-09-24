import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import type { Env } from '../env'
import { requireSession } from '../middleware/session'
import { HttpError } from '../lib/errors'

const searchSchema = z.object({
  q: z.string().default(''),
  projectId: z.string().optional(),
  scope: z.enum(['project', 'all']).default('project'),
})

export interface SearchResult {
  id: string
  title: string
  icon?: string | null
  kind: 'notepad' | 'card'
  projectId: string
  projectName: string
  snippet: string
}

export const searchRoutes = new Hono<Env>()
  .get(
    '/api/search',
    requireSession,
    zValidator('query', searchSchema),
    async (c) => {
      const db = createDb(c.env.DB)
      const workspaceId = c.get('workspaceId')
      const { q, projectId, scope } = c.req.valid('query')

      const trimmedQ = q.trim()
      if (!trimmedQ) {
        return c.json([])
      }

      // If scope is project, verify project belongs to workspace
      if (scope === 'project' && projectId) {
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
      }

      // Sanitize query terms for FTS5 prefix matching
      const words = trimmedQ
        .replace(/["*(){}:^]/g, ' ')
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 0)

      if (words.length === 0) {
        return c.json([])
      }

      const ftsQuery = words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ')

      let results: SearchResult[]

      try {
        if (scope === 'project' && projectId) {
          const query = sql`
            SELECT
              n.id,
              n.title,
              n.icon,
              n.kind,
              n.project_id AS projectId,
              p.name AS projectName,
              snippet(notepads_fts, -1, '<mark>', '</mark>', '...', 15) AS snippet
            FROM notepads_fts
            JOIN notepads n ON n.id = notepads_fts.notepad_id
            JOIN projects p ON p.id = n.project_id
            WHERE notepads_fts MATCH ${ftsQuery}
              AND n.workspace_id = ${workspaceId}
              AND n.deleted_at IS NULL
              AND n.project_id = ${projectId}
            ORDER BY rank
            LIMIT 25
          `
          const rows = await db.all<SearchResult>(query)
          results = rows
        } else {
          const query = sql`
            SELECT
              n.id,
              n.title,
              n.icon,
              n.kind,
              n.project_id AS projectId,
              p.name AS projectName,
              snippet(notepads_fts, -1, '<mark>', '</mark>', '...', 15) AS snippet
            FROM notepads_fts
            JOIN notepads n ON n.id = notepads_fts.notepad_id
            JOIN projects p ON p.id = n.project_id
            WHERE notepads_fts MATCH ${ftsQuery}
              AND n.workspace_id = ${workspaceId}
              AND n.deleted_at IS NULL
            ORDER BY rank
            LIMIT 25
          `
          const rows = await db.all<SearchResult>(query)
          results = rows
        }
      } catch (err) {
        console.warn('FTS5 search error:', err)
        return c.json([])
      }

      return c.json(results)
    },
  )
