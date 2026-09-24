import type { IBoardRepository, Board, CreateBoardData, UpdateBoardData, BoardColumn, CreateColumnData, UpdateColumnData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresBoardRepository implements IBoardRepository {
    private db;
    constructor(db: PostgresDb);
    listByProject(projectId: string): Promise<Board[]>;
    findById(id: string): Promise<Board | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Board | null>;
    create(data: CreateBoardData): Promise<Board>;
    update(id: string, data: UpdateBoardData): Promise<void>;
    softDelete(id: string, deletedAt: number): Promise<void>;
    restore(id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
    listColumns(boardId: string): Promise<BoardColumn[]>;
    findColumnByIdAndWorkspace(columnId: string, workspaceId: string): Promise<BoardColumn | null>;
    createColumn(data: CreateColumnData): Promise<BoardColumn>;
    updateColumn(id: string, data: UpdateColumnData): Promise<void>;
    moveColumn(id: string, position: string): Promise<void>;
    deleteColumn(id: string): Promise<void>;
}
