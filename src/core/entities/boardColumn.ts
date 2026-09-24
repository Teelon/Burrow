/**
 * BoardColumn entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  color: string | null;
  position: string;
  wipLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateColumnInput {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  position: string;
  wipLimit?: number | null;
}

export interface UpdateColumnInput {
  name?: string;
  color?: string | null;
  wipLimit?: number | null;
}

export interface MoveColumnInput {
  afterId: string | null;
}

export interface DeleteColumnInput {
  moveToColumnId?: string | null;
}
