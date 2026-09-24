import type { ICardRepository, Card, CreateCardData, UpdateCardData, CardSubtask, CreateSubtaskData, UpdateSubtaskData, CardAssignee, Comment, CreateCommentData, MyTasksFilters, MyTaskItem, CardSummary, CardPriority, CardWithDetails } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresCardRepository implements ICardRepository {
    private db;
    constructor(db: PostgresDb);
    findById(id: string): Promise<Card | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Card | null>;
    getCardWithDetails(id: string, workspaceId: string): Promise<CardWithDetails | null>;
    create(data: CreateCardData): Promise<Card>;
    update(id: string, data: UpdateCardData): Promise<void>;
    move(id: string, columnId: string, position: string): Promise<void>;
    softDelete(id: string, _deletedAt: number): Promise<void>;
    restore(_id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
    listSubtasks(cardId: string): Promise<CardSubtask[]>;
    createSubtask(data: CreateSubtaskData): Promise<CardSubtask>;
    updateSubtask(id: string, data: UpdateSubtaskData): Promise<void>;
    deleteSubtask(id: string): Promise<void>;
    listAssignees(cardId: string): Promise<CardAssignee[]>;
    setAssignees(cardId: string, userIds: string[]): Promise<void>;
    validateAssignees(workspaceId: string, userIds: string[]): Promise<{
        userId: string;
    }[]>;
    listTagIds(notepadId: string): Promise<string[]>;
    setTagIds(notepadId: string, tagIds: string[]): Promise<void>;
    listComments(cardId: string): Promise<Comment[]>;
    createComment(data: CreateCommentData): Promise<Comment>;
    getComment(id: string, cardId: string): Promise<Comment | null>;
    deleteComment(id: string): Promise<void>;
    listByColumn(columnId: string): Promise<Card[]>;
    getMyTasks(workspaceId: string, userId: string, filters: MyTasksFilters): Promise<MyTaskItem[]>;
    getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        title: string;
        boardName: string;
        priority: CardPriority | null;
    }[]>;
}
