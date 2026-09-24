import type { ISearchAdapter, SearchHit, SearchQuery, SearchIndexDoc } from '../../../adapters/search'
import { eq, sql } from 'drizzle-orm'
import type { PostgresDb } from './index'
import { notepads, projects } from './schema'

export class PostgresSearchAdapter implements ISearchAdapter {
  constructor(private db: PostgresDb) {}

  async indexDocument(doc: SearchIndexDoc): Promise<void> {
    // FTS is handled by generated column on notepads table
    // This is a no-op for Postgres since the search_vector is auto-generated
    await this.db
      .update(notepads)
      .set({ plainText: doc.body })
      .where(eq(notepads.id, doc.id))
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
    const query = sql`
      SELECT
        n.id,
        n.title,
        n.icon,
        n.kind,
        n.project_id as "projectId",
        p.name as "projectName",
        ts_headline('english', n.plain_text, websearch_to_tsquery('english', ${q.text}), 'MaxFragments=1, MinWords=5, MaxWords=20') as snippet,
        ts_rank_cd(n.search_vector, websearch_to_tsquery('english', ${q.text})) as rank
      FROM ${notepads} n
      INNER JOIN ${projects} p ON n.project_id = p.id
      WHERE n.search_vector @@ websearch_to_tsquery('english', ${q.text})
        AND n.workspace_id = ${q.workspaceId}
        AND n.deleted_at IS NULL
        ${q.projectId ? sql`AND n.project_id = ${q.projectId}` : sql``}
      ORDER BY rank DESC
      LIMIT ${q.limit ?? 20}
    `

    const result = await this.db.execute(query)
    return result.map((row: any) => ({
      id: row.id as string,
      title: row.title as string,
      icon: (row.icon as string) ?? null,
      kind: row.kind as 'notepad' | 'card',
      projectId: row.projectId as string,
      projectName: row.projectName as string,
      snippet: (row.snippet as string) ?? '',
    }))
  }
}