import type { INotepadRepository, Notepad, CreateNotepadData, UpdateNotepadData, NotepadContent, RestoredNotepad, HardDeletedNotepad, StoredLink, EditLock, MentionNotificationArgs } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresNotepadRepository implements INotepadRepository {
    private db;
    constructor(db: PostgresDb);
    listByProject(projectId: string): Promise<Notepad[]>;
    listDeletedByProject(projectId: string): Promise<Notepad[]>;
    findById(id: string): Promise<Notepad | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Notepad | null>;
    create(data: CreateNotepadData): Promise<Notepad>;
    update(id: string, data: UpdateNotepadData): Promise<void>;
    move(id: string, parentId: string | null, position: string): Promise<void>;
    softDelete(id: string, deletedAt: number): Promise<void>;
    restore(id: string, deleteTimestamp: number): Promise<RestoredNotepad[]>;
    hardDelete(id: string): Promise<HardDeletedNotepad[]>;
    getContent(id: string): Promise<NotepadContent | null>;
    saveContent(id: string, content: string, expectedVersion: number): Promise<number>;
    getChildren(parentIds: string[]): Promise<{
        id: string;
        parentId: string | null;
    }[]>;
    getParent(id: string): Promise<{
        id: string;
        parentId: string | null;
    } | null>;
    isValidLink(link: {
        targetType: string;
        targetId: string;
    }): Promise<boolean>;
    listTagIds(notepadId: string): Promise<string[]>;
    setTagIds(notepadId: string, tagIds: string[]): Promise<void>;
    getLock(_notepadId: string): Promise<EditLock | null>;
    deleteFts(_notepadId: string): Promise<void>;
    insertFts(notepadId: string, _title: string, body: string): Promise<void>;
    insertFtsConditional(notepadId: string, _title: string, body: string, version: number, content: string): Promise<void>;
    listLinks(sourceId: string): Promise<StoredLink[]>;
    replaceLinks(sourceId: string, added: StoredLink[], removed: StoredLink[], _version: number, _content: string): Promise<void>;
    insertMentions(args: MentionNotificationArgs): Promise<void>;
    getLastChildPosition(parentId: string): Promise<string | null>;
    getLastRootPosition(projectId: string): Promise<string | null>;
    getLastRootNotepadPosition(projectId: string): Promise<string>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        title: string;
        icon: string | null;
    }[]>;
}
