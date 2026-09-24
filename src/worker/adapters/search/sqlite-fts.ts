import { sql } from 'drizzle-orm'
import type { DB } from '../../db/client'
import { ftsDeleteAllStmt, ftsInsertNowStmt } from '../../lib/search'
import type { ISearchAdapter, SearchHit, SearchIndexDoc, SearchQuery } from './types'

export class SqliteFtsSearchAdapter implements ISearchAdapter {
  constructor(private db: DB) {}

  async indexDocument(doc: SearchIndexDoc): Promise<void> {
    await this.db.run(ftsInsertNowStmt(doc.id, doc.title, doc.body))
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.run(ftsDeleteAllStmt(id))
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.db.run(sql`DELETE FROM notepads_fts WHERE project_id = ${projectId}`)
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const trimmed = (q.text ?? '').trim()
    if (!trimmed) {
      return []
    }

    // Sanitize query terms for FTS5 prefix matching (identical to former route logic)
    const words = trimmed
      .replace(/["*(){}:^]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0)

    if (words.length === 0) {
      return []
    }

    const ftsQuery = words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ')
    const limit = Math.min(q.limit ?? 25, 50)

    try {
      if (q.projectId) {
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
            AND n.workspace_id = ${q.workspaceId}
            AND n.deleted_at IS NULL
            AND n.project_id = ${q.projectId}
          ORDER BY rank
          LIMIT ${limit}
        `
        return await this.db.all<SearchHit>(query)
      }

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
          AND n.workspace_id = ${q.workspaceId}
          AND n.deleted_at IS NULL
        ORDER BY rank
        LIMIT ${limit}
      `
      return await this.db.all<SearchHit>(query)
    } catch (err) {
      console.warn('FTS5 search error:', err)
      return []
    }
  }
}
