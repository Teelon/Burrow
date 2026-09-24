import type { IProjectRepository, Project, CreateProjectData, UpdateProjectData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresProjectRepository implements IProjectRepository {
    private db;
    constructor(db: PostgresDb);
    listByWorkspace(workspaceId: string): Promise<Project[]>;
    findById(id: string): Promise<Project | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Project | null>;
    create(data: CreateProjectData): Promise<Project>;
    update(id: string, data: UpdateProjectData): Promise<void>;
    updatePosition(id: string, position: string): Promise<void>;
    delete(id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
}
