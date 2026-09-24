/**
 * Board entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export interface Board {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  icon: string | null;
  position: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBoardInput {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string;
  icon?: string | null;
  position: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateBoardInput {
  name?: string;
  icon?: string | null;
}
