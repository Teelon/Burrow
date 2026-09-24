import type { IWorkspaceRepository, Workspace, CreateWorkspaceData } from '../infrastructure/types';
import { notFound } from './errors';

/**
 * WorkspaceService — minimal operations; auth owns creation/bootstrap.
 */
export class WorkspaceService {
  constructor(private readonly repos: { workspaces: IWorkspaceRepository }) {}

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const ws = await this.repos.workspaces.findById(workspaceId);
    if (!ws) throw notFound('workspace_not_found', 'Workspace not found');
    return ws;
  }

  async createWorkspace(data: CreateWorkspaceData): Promise<Workspace> {
    return this.repos.workspaces.create(data);
  }
}
