import type { ICardRepository, INotepadRepository, ITagRepository, IBoardRepository, CardPriority, MyTasksFilters, MyTaskItem, CardSummary, CardSubtask } from '../infrastructure/types';
export interface CreateCardInput {
    workspaceId: string;
    actorId: string;
    boardId: string;
    columnId: string;
    title: string;
    priority?: CardPriority | null;
    dueDate?: number | null;
    assigneeIds?: string[];
    tagIds?: string[];
    notepad?: {
        mode: 'new';
    } | {
        mode: 'existing';
        id: string;
    };
}
export interface CreatedCard {
    cardId: string;
    notepadId: string;
    linkedNotepadId: string | null;
}
export interface CardPlan {
    workspaceId: string;
    projectId: string;
    boardId: string;
    columnId: string;
    actorId: string;
    cardId: string;
    notepadId: string;
    title: string;
    content: string;
    plainText: string;
    priority: CardPriority | null;
    dueDate: number | null;
    assigneeIds: string[];
    tagIds: string[];
    cardPosition: string;
    linkedNotepad: {
        id: string;
        position: string;
        title: string;
    } | null;
    now: number;
}
export declare class CardService {
    private readonly repos;
    constructor(repos: {
        cards: ICardRepository;
        notepads: INotepadRepository;
        tags: ITagRepository;
        boards: IBoardRepository;
        boardColumns?: {
            findById: (id: string) => Promise<any>;
        };
    });
    createCard(input: CreateCardInput): Promise<CreatedCard>;
    /** The exact statements createCard runs. Exported for the atomicity spike. */
    executeCardCreation(plan: CardPlan): Promise<void>;
    getCard(workspaceId: string, cardId: string): Promise<import("..").Card>;
    moveCard(workspaceId: string, cardId: string, columnId: string, afterId?: string | null): Promise<{
        columnId: string;
        position: string;
    }>;
    updateCard(workspaceId: string, cardId: string, updates: {
        title?: string;
        priority?: CardPriority | null;
        dueDate?: number | null;
        assigneeIds?: string[];
        tagIds?: string[];
    }, actorId?: string): Promise<{
        ok: true;
        cardId: string;
    }>;
    deleteCard(workspaceId: string, cardId: string): Promise<{
        ok: true;
        cardId: string;
    }>;
    restoreCard(workspaceId: string, cardId: string): Promise<{
        ok: true;
        cardId: string;
    }>;
    permanentDeleteCard(workspaceId: string, cardId: string): Promise<{
        ok: true;
        cardId: string;
    }>;
    getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]>;
    getMyTasks(workspaceId: string, userId: string, filters: MyTasksFilters): Promise<MyTaskItem[]>;
    listSubtasks(cardId: string): Promise<CardSubtask[]>;
    createSubtask(workspaceId: string, cardId: string, title: string): Promise<CardSubtask>;
    updateSubtask(workspaceId: string, cardId: string, subtaskId: string, updates: {
        title?: string;
        completed?: boolean;
        afterId?: string | null;
    }): Promise<{
        ok: true;
        subtaskId: string;
    }>;
    deleteSubtask(workspaceId: string, cardId: string, subtaskId: string): Promise<{
        ok: true;
        subtaskId: string;
    }>;
    private requireCardForWorkspace;
    private validateAssignees;
    private validateTags;
    private lastCardPosition;
}
