import type { DB } from '../db/client';
export interface CreateBoardArgs {
    workspaceId: string;
    projectId: string;
    name: string;
    icon?: string | null;
}
export declare function listBoards(db: DB, workspaceId: string, projectId: string): Promise<{
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number;
}[]>;
export declare function createBoard(db: DB, args: CreateBoardArgs): Promise<{
    id: string;
    position: string;
}>;
export declare function getBoard(db: DB, workspaceId: string, boardId: string): Promise<{
    columns: {
        cards: any[];
        id: string;
        boardId: string;
        name: string;
        color: string | null;
        position: string;
    }[];
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number;
}>;
export declare function updateBoard(db: DB, workspaceId: string, boardId: string, updates: {
    name?: string;
    icon?: string | null;
}): Promise<void>;
export declare function softDeleteBoard(db: DB, workspaceId: string, boardId: string): Promise<void>;
export declare function restoreBoard(db: DB, workspaceId: string, boardId: string): Promise<void>;
export declare function permanentDeleteBoard(db: DB, workspaceId: string, boardId: string): Promise<void>;
export declare function createColumn(db: DB, workspaceId: string, boardId: string, name: string, color?: string | null): Promise<{
    id: string;
    position: string;
}>;
export declare function updateColumn(db: DB, workspaceId: string, columnId: string, updates: {
    name?: string;
    color?: string | null;
}): Promise<void>;
export declare function moveColumn(db: DB, workspaceId: string, columnId: string, afterId?: string | null): Promise<{
    position: string;
}>;
export declare function deleteColumn(db: DB, workspaceId: string, columnId: string, moveToColumnId?: string | null): Promise<void>;
