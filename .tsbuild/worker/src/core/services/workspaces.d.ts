import type { IWorkspaceRepository, Workspace, CreateWorkspaceData } from '../infrastructure/types';
/**
 * WorkspaceService — minimal operations; auth owns creation/bootstrap.
 */
export declare class WorkspaceService {
    private readonly repos;
    constructor(repos: {
        workspaces: IWorkspaceRepository;
    });
    getWorkspace(workspaceId: string): Promise<Workspace>;
    createWorkspace(data: CreateWorkspaceData): Promise<Workspace>;
}
