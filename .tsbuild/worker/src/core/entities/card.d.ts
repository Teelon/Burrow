/**
 * Card entity and related input types
 * Pure TypeScript — zero runtime dependencies
 */
export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface Card {
    id: string;
    boardId: string;
    columnId: string;
    notepadId: string;
    position: string;
    priority: CardPriority | null;
    dueDate: Date | null;
    createdAt: Date;
    title: string;
    content: string;
    version: number;
    projectId: string;
    workspaceId: string;
}
export interface CardAssignee {
    cardId: string;
    userId: string;
}
export interface CardSubtask {
    id: string;
    cardId: string;
    title: string;
    completed: boolean;
    position: string;
    createdAt: Date;
}
export interface CardComment {
    id: string;
    cardId: string;
    userId: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateCardInput {
    workspaceId: string;
    actorId: string;
    boardId: string;
    columnId: string;
    title: string;
    priority?: CardPriority | null;
    dueDate?: Date | null;
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
export interface UpdateCardInput {
    title?: string;
    priority?: CardPriority | null;
    dueDate?: Date | null;
    assigneeIds?: string[];
    tagIds?: string[];
}
export interface MoveCardInput {
    columnId: string;
    afterId?: string | null;
}
export interface CreateSubtaskInput {
    title: string;
}
export interface UpdateSubtaskInput {
    title?: string;
    completed?: boolean;
    afterId?: string | null;
}
export interface MyTasksFilters {
    status?: 'all' | 'open' | 'completed';
    projectId?: string;
}
export interface MyTaskItem {
    id: string;
    notepadId: string;
    boardId: string;
    columnId: string;
    projectId: string;
    title: string;
    dueDate: Date | null;
    priority: CardPriority | null;
    isCompleted: boolean;
    createdAt: Date;
    boardName: string;
    columnName: string;
    projectName: string;
    projectIcon: string | null;
    projectColor: string | null;
    tags: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
}
export interface CardsSummaryInput {
    cardIds: string[];
}
export interface CardSummaryItem {
    id: string;
    notepadId: string;
    title: string;
    boardId: string;
    boardName: string;
    columnId: string;
    columnName: string;
    priority: CardPriority | null;
    dueDate: Date | null;
    assignees: Array<{
        userId: string;
        name: string;
        image: string | null;
    }>;
}
