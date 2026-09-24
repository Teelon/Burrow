import type { IStorageAdapter } from '../adapters/storage/types';
import type { DB } from '../db/client';
export interface CreateProjectArgs {
    workspaceId: string;
    name: string;
    icon?: string | null;
    color?: string | null;
}
export interface UpdateProjectArgs {
    workspaceId: string;
    projectId: string;
    name?: string;
    icon?: string | null;
    color?: string | null;
    archived?: boolean;
}
export interface MoveProjectArgs {
    workspaceId: string;
    projectId: string;
    afterId?: string | null;
}
export interface PermanentDeleteProjectArgs {
    workspaceId: string;
    projectId: string;
    confirmName: string;
    storage?: IStorageAdapter | null;
}
export declare function listProjects(db: DB, workspaceId: string): Promise<{
    id: string;
    workspaceId: string;
    name: string;
    icon: string | null;
    color: string | null;
    position: string;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
}[]>;
export declare function createProject(db: DB, args: CreateProjectArgs): Promise<{
    id: string;
    position: string;
}>;
export declare function updateProject(db: DB, args: UpdateProjectArgs): Promise<void>;
export declare function moveProject(db: DB, args: MoveProjectArgs): Promise<{
    position: string;
}>;
export declare function permanentDeleteProject(db: DB, args: PermanentDeleteProjectArgs): Promise<void>;
