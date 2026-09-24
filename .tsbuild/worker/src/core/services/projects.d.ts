import type { IProjectRepository, Project } from '../infrastructure/types';
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
}
export declare class ProjectService {
    private readonly repos;
    constructor(repos: {
        projects: IProjectRepository;
    });
    listProjects(workspaceId: string): Promise<Project[]>;
    createProject(args: CreateProjectArgs): Promise<{
        id: string;
        position: string;
    }>;
    updateProject(args: UpdateProjectArgs): Promise<void>;
    moveProject(args: MoveProjectArgs): Promise<{
        position: string;
    }>;
    permanentDeleteProject(args: PermanentDeleteProjectArgs): Promise<void>;
}
