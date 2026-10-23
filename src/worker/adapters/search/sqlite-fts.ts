import { sql } from 'drizzle-orm';
import type { DB } from '../../db/client';
import { ftsDeleteAllStmt, ftsInsertNowStmt } from '../../lib/search';
import type { ISearchAdapter, SearchHit, SearchIndexDoc, SearchQuery } from './types';

export class SqliteFtsSearchAdapter implements ISearchAdapter {
  constructor(private db: DB) {}

  async indexDocument(doc: SearchIndexDoc): Promise<void> {
    await this.db.run(ftsInsertNowStmt(doc.id, doc.title, doc.body));
  }

  async deleteDocument(id: string): Promise<void> {
    await this.db.run(ftsDeleteAllStmt(id));
  }

  async deleteByProject(projectId: string): Promise<void> {
    await this.db.run(sql`DELETE FROM notepads_fts WHERE project_id = ${projectId}`);
  }

  async search(q: SearchQuery): Promise<SearchHit[]> {
    const trimmed = (q.text ?? '').trim();
    if (!trimmed) {
      return [];
    }

    const cleanText = trimmed.replace(/^[#]/, '').trim();
    if (!cleanText) {
      return [];
    }

    // Sanitize query terms for FTS5 prefix matching
    const words = cleanText
      .replace(/["*(){}:^#]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    const limit = Math.min(q.limit ?? 25, 50);
    const likePattern = `%${cleanText}%`;

    const matchedIdsCte =
      words.length > 0
        ? sql`
          SELECT notepad_id AS id, rank, snippet(notepads_fts, -1, '<mark>', '</mark>', '...', 15) AS snippet
          FROM notepads_fts
          WHERE notepads_fts MATCH ${words.map((w) => `"${w.replace(/"/g, '""')}"*`).join(' ')}
          UNION
          SELECT nt.notepad_id AS id, 0 AS rank, ('Tag: #' || t.name) AS snippet
          FROM notepad_tags nt
          JOIN tags t ON t.id = nt.tag_id
          JOIN projects tp ON tp.id = t.project_id
          WHERE tp.workspace_id = ${q.workspaceId}
            AND (LOWER(t.name) = LOWER(${cleanText}) OR LOWER(t.name) LIKE LOWER(${likePattern}))
        `
        : sql`
          SELECT nt.notepad_id AS id, 0 AS rank, ('Tag: #' || t.name) AS snippet
          FROM notepad_tags nt
          JOIN tags t ON t.id = nt.tag_id
          JOIN projects tp ON tp.id = t.project_id
          WHERE tp.workspace_id = ${q.workspaceId}
            AND (LOWER(t.name) = LOWER(${cleanText}) OR LOWER(t.name) LIKE LOWER(${likePattern}))
        `;

    const query = sql`
      WITH matched_ids AS (
        ${matchedIdsCte}
      )
      SELECT
        n.id,
        n.title,
        n.icon,
        n.kind,
        n.project_id AS projectId,
        p.name AS projectName,
        c.id AS cardId,
        c.board_id AS boardId,
        COALESCE(m.snippet, n.title) AS snippet
      FROM matched_ids m
      JOIN notepads n ON n.id = m.id
      JOIN projects p ON p.id = n.project_id
      LEFT JOIN cards c ON c.notepad_id = n.id
      WHERE n.workspace_id = ${q.workspaceId}
        AND n.deleted_at IS NULL
        ${q.projectId ? sql`AND n.project_id = ${q.projectId}` : sql``}
      ORDER BY m.rank
      LIMIT ${limit}
    `;

    try {
      const rows = await this.db.all<any>(query);
      const seen = new Set<string>();
      const hits: SearchHit[] = [];
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        hits.push({
          id: row.id,
          title: row.title,
          icon: row.icon ?? null,
          kind: row.kind,
          projectId: row.projectId,
          projectName: row.projectName,
          snippet: row.snippet ?? row.title,
          cardId: row.cardId || undefined,
          boardId: row.boardId || undefined,
        });
      }
      return hits;
    } catch (err) {
      console.warn('FTS5 search error:', err);
      return [];
    }
  }
}
