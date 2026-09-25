export interface KanbanCardLike {
    id: string;
}
export interface KanbanColumnLike {
    id: string;
    name: string;
    cards: KanbanCardLike[];
}
/**
 * Reorders a flat array of items and computes the server `afterId`
 * (where null = first position, or the ID of the predecessor item).
 */
export declare function computeLinearReorderAfterId<T extends {
    id: string;
}>(items: T[], activeId: string, overId: string): string | null | undefined;
/**
 * Computes destination `afterId` when a column is dragged over another column or card.
 */
export declare function computeColumnDropTarget(columns: Array<{
    id: string;
}>, params: {
    activeId: string;
    overId: string;
    overType?: 'column' | 'card';
    cardColumnMap?: Map<string, string>;
}): {
    columnId: string;
    afterId: string | null;
} | null;
/**
 * Computes destination column and `afterId` when a card is dropped.
 * Returns null if the drop is a no-op within the same column.
 */
export declare function computeCardDropTarget(columns: KanbanColumnLike[], params: {
    activeId: string;
    overId: string;
    isOverColumn: boolean;
    isBelow?: boolean;
}): {
    cardId: string;
    columnId: string;
    afterId: string | null;
} | null;
