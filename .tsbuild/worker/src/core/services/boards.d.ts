import type { IBoardRepository, ICardRepository, Board, BoardColumn, BoardWithDetails } from '../infrastructure/types';
export interface CreateBoardArgs {
    workspaceId: string;
    projectId: string;
    name: string;
    icon?: string | null;
}
export declare class BoardService {
    private readonly repos;
    constructor(repos: {
        boards: IBoardRepository;
        cards?: ICardRepository;
    });
    listBoards(_workspaceId: string, projectId: string): Promise<Board[]>;
    createBoard(args: CreateBoardArgs): Promise<{
        id: string;
        position: string;
    }>;
    getBoard(workspaceId: string, boardId: string): Promise<BoardWithDetails | (Board & {
        columns: (BoardColumn & {
            cards: any[];
        })[];
    })>;
    updateBoard(_workspaceId: string, boardId: string, updates: {
        name?: string;
        icon?: string | null;
    }): Promise<void>;
    softDeleteBoard(_workspaceId: string, boardId: string): Promise<void>;
    restoreBoard(_workspaceId: string, boardId: string): Promise<void>;
    permanentDeleteBoard(_workspaceId: string, boardId: string): Promise<void>;
    createColumn(_workspaceId: string, boardId: string, name: string, color?: string | null): Promise<{
        id: string;
        position: string;
    }>;
    updateColumn(_workspaceId: string, columnId: string, updates: {
        name?: string;
        color?: string | null;
        wipLimit?: number | null;
    }): Promise<void>;
    moveColumn(_workspaceId: string, columnId: string, afterId?: string | null): Promise<{
        position: string;
    }>;
    deleteColumn(_workspaceId: string, columnId: string, moveToColumnId?: string | null): Promise<void>;
    private findColumnInWorkspace;
}
