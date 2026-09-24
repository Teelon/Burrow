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
