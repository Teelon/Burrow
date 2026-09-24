import type { INotepadRepository, ITagRepository, Notepad, StoredLink } from '../infrastructure/types';
import type { ILockAdapter } from '../adapters/lock';
/** Root notepads are depth 1; reject anything deeper than 8. */
export declare const MAX_NOTEPAD_DEPTH = 8;
/** D1 rows are limited to ~2MB; reject oversized content with 413. */
export declare const MAX_CONTENT_BYTES = 1500000;
/** Rolling edit-lock window (ms). */
export declare const LOCK_TTL_MS = 60000;
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
export interface MoveNotepadArgs {
    workspaceId: string;
    notepadId: string;
    parentId?: string | null;
    afterId?: string | null;
}
export interface SoftDeleteNotepadArgs {
    workspaceId: string;
    notepadId: string;
}
export interface RestoreNotepadArgs {
    workspaceId: string;
    notepadId: string;
}
export interface PermanentDeleteNotepadArgs {
    workspaceId: string;
    notepadId: string;
    storage?: IStorageAdapter | null;
}
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
export interface PreparedSave {
    row: {
        id: string;
        workspaceId: string;
        title: string;
        version: number;
    };
    validLinks: StoredLink[];
    previousLinks: StoredLink[];
}
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
export interface ClaimLockArgs {
    notepadId: string;
    userId: string;
    clientId: string;
    takeover?: boolean;
}
export interface IStorageAdapter {
    delete(key: string): Promise<void>;
}
export declare class NotepadService {
    private readonly repos;
    private readonly locks;
    private readonly storage?;
    constructor(repos: {
        notepads: INotepadRepository;
        tags: ITagRepository;
    }, locks: ILockAdapter, storage?: IStorageAdapter | undefined);
    createNotepad(args: CreateNotepadArgs): Promise<CreatedNotepad>;
    moveNotepad(args: MoveNotepadArgs): Promise<{
        parentId: string | null;
        position: string;
    }>;
    private getSiblings;
    softDeleteNotepad(args: SoftDeleteNotepadArgs): Promise<void>;
    restoreNotepad(args: RestoreNotepadArgs): Promise<void>;
    permanentDeleteNotepad(args: PermanentDeleteNotepadArgs): Promise<void>;
    prepareSave(args: SaveContentArgs): Promise<PreparedSave>;
    saveContent(args: SaveContentArgs): Promise<SaveContentResult>;
    private buildAndExecuteSaveStatements;
    claimLock(args: ClaimLockArgs): Promise<{
        expiresAt: number;
    }>;
    releaseLock(args: ClaimLockArgs): Promise<void>;
    setNotepadTags(notepadId: string, tagIds: string[], workspaceId: string): Promise<void>;
    getTree(projectId: string): Promise<Notepad[]>;
    listByProject(projectId: string): Promise<Notepad[]>;
}
