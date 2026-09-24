import type { BatchItem } from 'drizzle-orm/batch';
import type { DB } from '../db/client';
export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';
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
    /** From the quick-add `/notepad` command. */
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
/**
 * Create a card atomically: card notepad (+ FTS row), the card row, optional
 * linked notepad, tags and assignees — all in one db.batch(). Either everything
 * lands or nothing does.
 */
export declare function createCard(db: DB, input: CreateCardInput): Promise<CreatedCard>;
/** The exact statements createCard runs. Exported for the atomicity spike. */
export declare function cardCreationStatements(db: DB, plan: CardPlan): BatchItem<'sqlite'>[];
export declare function getCard(db: DB, workspaceId: string, cardId: string): Promise<{
    boardName: string;
    columnName: string;
    assignees: {
        userId: string;
        name: string;
        image: string | null;
    }[];
    tags: {
        id: string;
        name: string;
        color: string | null;
    }[];
    lock: {
        userId: string;
        name: string;
        expiresAt: number;
    } | null;
    id: string;
    boardId: string;
    columnId: string;
    notepadId: string;
    position: string;
    priority: "low" | "medium" | "high" | "urgent" | null;
    dueDate: number | null;
    createdAt: number;
    title: string;
    content: string;
    version: number;
    projectId: string;
    workspaceId: string;
}>;
export declare function moveCard(db: DB, workspaceId: string, cardId: string, columnId: string, afterId?: string | null): Promise<{
    columnId: string;
    position: string;
}>;
export interface UpdateCardArgs {
    title?: string;
    priority?: CardPriority | null;
    dueDate?: number | null;
    assigneeIds?: string[];
    tagIds?: string[];
}
export declare function updateCard(db: DB, workspaceId: string, cardId: string, updates: UpdateCardArgs, actorId?: string): Promise<{
    ok: boolean;
    cardId: string;
}>;
export declare function deleteCard(db: DB, workspaceId: string, cardId: string): Promise<{
    ok: boolean;
    cardId: string;
}>;
export declare function restoreCard(db: DB, workspaceId: string, cardId: string): Promise<{
    ok: boolean;
    cardId: string;
}>;
export declare function permanentDeleteCard(db: DB, workspaceId: string, cardId: string): Promise<{
    ok: boolean;
    cardId: string;
}>;
export declare function getCardsSummary(db: DB, workspaceId: string, cardIds: string[]): Promise<{
    id: string;
    notepadId: string;
    title: string;
    boardId: string;
    boardName: string;
    columnId: string;
    columnName: string;
    priority: "low" | "medium" | "high" | "urgent" | null;
    dueDate: number | null;
    assignees: {
        userId: string;
        name: string;
        image: string | null;
    }[];
}[]>;
