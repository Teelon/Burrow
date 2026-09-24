import { type SQL } from 'drizzle-orm';
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
export declare function liveContentCond(notepadId: string, version: number, content: string): SQL;
export declare const LIVE_CONTENT_COND_PARAMS = 4;
export declare function ftsDeleteStmt(notepadId: string, cond: SQL): SQL;
export declare function ftsInsertStmt(notepadId: string, title: string, body: string, cond: SQL): SQL;
/** Index a freshly created (necessarily live) notepad. */
export declare function ftsInsertNowStmt(notepadId: string, title: string, body: string): SQL;
/** Drop every FTS row for a notepad (soft delete / permanent delete). */
export declare function ftsDeleteAllStmt(notepadId: string): SQL;
