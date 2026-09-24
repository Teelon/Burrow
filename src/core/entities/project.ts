/**
 * Project entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  icon: string | null;
  color: string | null;
  position: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  id: string;
  workspaceId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProjectInput {
  name?: string;
  icon?: string | null;
  color?: string | null;
  archived?: boolean;
}

export interface MoveProjectInput {
  afterId: string | null;
}