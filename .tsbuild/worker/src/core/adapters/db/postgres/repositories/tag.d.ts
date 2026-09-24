import type { ITagRepository, Tag, CreateTagData, UpdateTagData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresTagRepository implements ITagRepository {
    private db;
    constructor(db: PostgresDb);
    listByProject(projectId: string): Promise<Tag[]>;
    findById(id: string): Promise<Tag | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Tag | null>;
    create(data: CreateTagData): Promise<Tag>;
    update(id: string, data: UpdateTagData): Promise<void>;
    delete(id: string): Promise<void>;
    findByName(projectId: string, name: string): Promise<Tag | null>;
    validateByProject(projectId: string, tagIds: string[]): Promise<{
        id: string;
    }[]>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        name: string;
        color: string | null;
    }[]>;
}
