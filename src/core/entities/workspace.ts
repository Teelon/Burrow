/**
 * Workspace entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceInput {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateWorkspaceInput {
  name?: string;
}
