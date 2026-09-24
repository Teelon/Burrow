import type { IWorkspaceRepository, Workspace, CreateWorkspaceData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresWorkspaceRepository implements IWorkspaceRepository {
    private db;
    constructor(db: PostgresDb);
    findById(id: string): Promise<Workspace | null>;
    create(data: CreateWorkspaceData): Promise<Workspace>;
    count(): Promise<number>;
}
