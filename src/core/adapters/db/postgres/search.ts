import type {
  ISearchAdapter,
  SearchHit,
  SearchQuery,
  SearchIndexDoc,
} from '../../../adapters/search';
import { eq, sql } from 'drizzle-orm';
import type { PostgresDb } from './index';
import { cards, notepads, notepadTags, projects, tags } from './schema';

export class PostgresSearchAdapter implements ISearchAdapter {
  constructor(private db: PostgresDb) {}

  async indexDocument(doc: SearchIndexDoc): Promise<void> {
    // FTS is handled by generated column on notepads table
    // This is a no-op for Postgres since the search_vector is auto-generated
    await this.db.update(notepads).set({ plainText: doc.body }).where(eq(notepads.id, doc.id));
  }

  async deleteDocument(_id: string): Promise<void> {
    // FTS is handled by generated column, deleting the notepad removes the FTS entry
    // This is a no-op for Postgres
  }

  async deleteByProject(_projectId: string): Promise<void> {
    // FTS entries are deleted when notepads are deleted
    // This is a no-op for Postgres
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
          SELECT
            n.id,
            ts_rank_cd(n.search_vector, websearch_to_tsquery('english', ${cleanText})) as rank,
            ts_headline('english', n.plain_text, websearch_to_tsquery('english', ${cleanText}), 'MaxFragments=1, MinWords=5, MaxWords=20') as snippet
          FROM ${notepads} n
          WHERE n.search_vector @@ websearch_to_tsquery('english', ${cleanText})
          UNION
          SELECT
            nt.notepad_id AS id,
            0.0 AS rank,
            ('Tag: #' || t.name) AS snippet
          FROM ${notepadTags} nt
          JOIN ${tags} t ON t.id = nt.tag_id
          JOIN ${projects} tp ON tp.id = t.project_id
          WHERE tp.workspace_id = ${q.workspaceId}
            AND (LOWER(t.name) = LOWER(${cleanText}) OR LOWER(t.name) LIKE LOWER(${likePattern}))
        `
        : sql`
          SELECT
            nt.notepad_id AS id,
            0.0 AS rank,
            ('Tag: #' || t.name) AS snippet
          FROM ${notepadTags} nt
          JOIN ${tags} t ON t.id = nt.tag_id
          JOIN ${projects} tp ON tp.id = t.project_id
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
        n.project_id as "projectId",
        p.name as "projectName",
        c.id as "cardId",
        c.board_id as "boardId",
        COALESCE(m.snippet, n.title) as snippet
      FROM matched_ids m
      JOIN ${notepads} n ON n.id = m.id
      JOIN ${projects} p ON p.id = n.project_id
      LEFT JOIN ${cards} c ON c.notepad_id = n.id
      WHERE n.workspace_id = ${q.workspaceId}
        AND n.deleted_at IS NULL
        ${q.projectId ? sql`AND n.project_id = ${q.projectId}` : sql``}
      ORDER BY m.rank DESC
      LIMIT ${limit}
    `;

    try {
      const result = await this.db.execute(query);
      const seen = new Set<string>();
      const hits: SearchHit[] = [];
      for (const row of result as any[]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        hits.push({
          id: row.id as string,
          title: row.title as string,
          icon: (row.icon as string) ?? null,
          kind: row.kind as 'notepad' | 'card',
          projectId: row.projectId as string,
          projectName: row.projectName as string,
          snippet: (row.snippet as string) ?? row.title,
          cardId: (row.cardId as string) || undefined,
          boardId: (row.boardId as string) || undefined,
        });
      }
      return hits;
    } catch (err) {
      console.warn('Postgres search error:', err);
      return [];
    }
  }
}
