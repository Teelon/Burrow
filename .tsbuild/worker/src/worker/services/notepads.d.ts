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
export interface MoveNotepadArgs {
    workspaceId: string;
    notepadId: string;
    parentId?: string | null;
    afterId?: string | null;
}
export declare function moveNotepad(db: DB, args: MoveNotepadArgs): Promise<{
    parentId: string | null;
    position: string;
}>;
export interface SoftDeleteNotepadArgs {
    workspaceId: string;
    notepadId: string;
}
export declare function softDeleteNotepad(db: DB, args: SoftDeleteNotepadArgs): Promise<void>;
export interface RestoreNotepadArgs {
    workspaceId: string;
    notepadId: string;
}
export declare function restoreNotepad(db: DB, args: RestoreNotepadArgs): Promise<void>;
export interface PermanentDeleteNotepadArgs {
    workspaceId: string;
    notepadId: string;
    filesBucket?: R2Bucket | null;
}
export declare function permanentDeleteNotepad(db: DB, args: PermanentDeleteNotepadArgs): Promise<void>;
export interface SaveContentArgs {
    notepadId: string;
    content: string;
    baseVersion: number;
    actorId: string;
    clientId?: string;
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
export declare function prepareSave(db: DB, args: SaveContentArgs): Promise<PreparedSave>;
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
export declare function buildSaveContentStatements(db: DB, args: SaveStatementArgs): BatchItem<'sqlite'>[];
export interface ClaimLockArgs {
    notepadId: string;
    userId: string;
    clientId: string;
}
export declare function claimLock(db: DB, args: ClaimLockArgs): Promise<{
    expiresAt: number;
}>;
export declare function releaseLock(db: DB, args: ClaimLockArgs): Promise<void>;
export declare function setNotepadTags(db: DB, notepadId: string, tagIds: string[], workspaceId: string): Promise<void>;
export {};
