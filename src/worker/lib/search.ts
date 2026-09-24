import { sql, type SQL } from 'drizzle-orm'

/**
 * FTS5 statements. Drizzle does not understand virtual tables, so these are raw
 * `sql` literals executed with `db.run(...)` inside the same db.batch() as the
 * notepad write (FTS must never silently diverge from content).
 */

/**
 * Conditional index write: only fires when the notepad row currently holds the
 * exact content this save just wrote (and is live). A stale save therefore
 * touches neither the content row nor its FTS row.
 * Costs 4 bound parameters (id, version, content).
 */
export function liveContentCond(notepadId: string, version: number, content: string): SQL {
  return sql`EXISTS (SELECT 1 FROM notepads WHERE id = ${notepadId} AND version = ${version} AND content = ${content} AND deleted_at IS NULL)`
}

export const LIVE_CONTENT_COND_PARAMS = 4

export function ftsDeleteStmt(notepadId: string, cond: SQL): SQL {
  return sql`DELETE FROM notepads_fts WHERE notepad_id = ${notepadId} AND (${cond})`
}

export function ftsInsertStmt(notepadId: string, title: string, body: string, cond: SQL): SQL {
  return sql`INSERT INTO notepads_fts (notepad_id, project_id, title, body)
    SELECT id, project_id, ${title}, ${body} FROM notepads WHERE id = ${notepadId} AND (${cond})`
}

/** Index a freshly created (necessarily live) notepad. */
export function ftsInsertNowStmt(notepadId: string, title: string, body: string): SQL {
  return sql`INSERT INTO notepads_fts (notepad_id, project_id, title, body)
    SELECT id, project_id, ${title}, ${body} FROM notepads WHERE id = ${notepadId} AND deleted_at IS NULL`
}

/** Drop every FTS row for a notepad (soft delete / permanent delete). */
export function ftsDeleteAllStmt(notepadId: string): SQL {
  return sql`DELETE FROM notepads_fts WHERE notepad_id = ${notepadId}`
}
