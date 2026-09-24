import type { BatchItem } from 'drizzle-orm/batch';
import type { DB } from '../db/client';
import { type StoredLink } from '../lib/links';
/** Root notepads are depth 1; reject anything deeper than 8 (PLAN.md section 6). */
export declare const MAX_NOTEPAD_DEPTH = 8;
/** D1 rows are limited to ~2MB; reject oversized content with 413. */
export declare const MAX_CONTENT_BYTES = 1500000;
export interface CreateNotepadArgs {
    workspaceId: string;
    projectId: string;
    parentId?: string | null;
    title?: string;
    createdBy: string;
    position?: string;
}
export interface CreatedNotepad {
    id: string;
    position: string;
    version: number;
}
export declare function createNotepad(db: DB, args: CreateNotepadArgs): Promise<CreatedNotepad>;
export interface SaveContentArgs {
    notepadId: string;
    content: string;
    baseVersion: number;
    /** Acting user — mentioned users other than this one get notifications. */
    actorId: string;
}
export interface SaveContentResult {
    version: number;
}
interface PreparedSave {
    row: {
        id: string;
        workspaceId: string;
        title: string;
        version: number;
    };
    validLinks: StoredLink[];
    previousLinks: StoredLink[];
}
/**
 * Read everything the save batch needs: the notepad row, its existing links,
 * and the extracted link targets filtered to this workspace (I8).
 */
export declare function prepareSave(db: DB, args: SaveContentArgs): Promise<PreparedSave>;
/**
 * Version-gated, atomic content save. The batch:
 *   1. UPDATE the notepad only when version = baseVersion
 *   2. rebuild the FTS row
 *   3. insert mention notifications for newly added user mentions
 *   4. diff notepad_links (delete removed, insert added)
 * Statements 2-4 only take effect while the row holds the exact content this
 * save just wrote (see liveContentCond), so a stale save changes NOTHING
 * anywhere — including FTS, links and notifications.
 */
export declare function saveContent(db: DB, args: SaveContentArgs): Promise<SaveContentResult>;
export interface SaveStatementArgs {
    row: {
        id: string;
        workspaceId: string;
        title: string;
    };
    content: string;
    baseVersion: number;
    actorId: string;
    validLinks: StoredLink[];
    previousLinks: StoredLink[];
    now: number;
}
/** Exported for the Phase 0 atomicity spike, which drives the batch directly. */
export declare function buildSaveContentStatements(db: DB, args: SaveStatementArgs): BatchItem<'sqlite'>[];
export {};
