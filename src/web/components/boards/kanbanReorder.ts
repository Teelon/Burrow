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
export function computeLinearReorderAfterId<T extends { id: string }>(
  items: T[],
  activeId: string,
  overId: string,
): string | null | undefined {
  if (activeId === overId) return undefined;

  const oldIndex = items.findIndex((i) => i.id === activeId);
  const newIndex = items.findIndex((i) => i.id === overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return undefined;

  const copy = [...items];
  const moved = copy.splice(oldIndex, 1)[0];
  if (!moved) return undefined;
  copy.splice(newIndex, 0, moved);

  if (newIndex === 0) return null;
  return copy[newIndex - 1]!.id;
}

/**
 * Computes destination `afterId` when a column is dragged over another column or card.
 */
export function computeColumnDropTarget(
  columns: Array<{ id: string }>,
  params: {
    activeId: string;
    overId: string;
    overType?: 'column' | 'card';
    cardColumnMap?: Map<string, string>;
  },
): { columnId: string; afterId: string | null } | null {
  const { activeId, overId, overType, cardColumnMap } = params;

  let overColId: string | undefined;
  if (columns.some((c) => c.id === overId)) {
    overColId = overId;
  } else if (overType === 'card' && cardColumnMap?.has(overId)) {
    overColId = cardColumnMap.get(overId);
  } else if (cardColumnMap?.has(overId)) {
    overColId = cardColumnMap.get(overId);
  }

  if (!overColId || overColId === activeId) return null;

  const activeIndex = columns.findIndex((c) => c.id === activeId);
  const overIndex = columns.findIndex((c) => c.id === overColId);
  if (activeIndex === -1 || overIndex === -1) return null;

  // Dragged right -> land after the target column;
  // dragged left -> land before it (i.e. after its predecessor, or null if first)
  const afterId = activeIndex < overIndex ? overColId : (columns[overIndex - 1]?.id ?? null);
  if (afterId === activeId) return null;

  return { columnId: activeId, afterId };
}

/**
 * Computes destination column and `afterId` when a card is dropped.
 * Returns null if the drop is a no-op within the same column.
 */
export function computeCardDropTarget(
  columns: KanbanColumnLike[],
  params: {
    activeId: string;
    overId: string;
    isOverColumn: boolean;
    isBelow?: boolean;
  },
): { cardId: string; columnId: string; afterId: string | null } | null {
  const { activeId, overId, isOverColumn, isBelow = false } = params;

  // 1. Find source column
  let sourceCol: KanbanColumnLike | undefined;
  for (const col of columns) {
    if (col.cards.some((c) => c.id === activeId)) {
      sourceCol = col;
      break;
    }
  }
  if (!sourceCol) return null;

  // 2. Find destination column: either over column directly or over a card in it
  let destCol = columns.find((c) => c.id === overId);
  if (!destCol) {
    destCol = columns.find((c) => c.cards.some((c) => c.id === overId));
  }
  if (!destCol) return null;

  // 3. Compute target cards in destination column excluding active card
  const targetCards = destCol.cards.filter((c) => c.id !== activeId);
  let afterId: string | null;

  if (isOverColumn) {
    // Dropped on the column itself (empty column or bottom blank space)
    if (targetCards.length === 0) {
      afterId = null;
    } else {
      afterId = targetCards[targetCards.length - 1]!.id;
    }
  } else {
    // Dropped onto a specific card
    const overIndex = targetCards.findIndex((c) => c.id === overId);

    if (sourceCol.id === destCol.id) {
      // Reordering within the SAME column
      const sourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId);
      const rawOverIndex = sourceCol.cards.findIndex((c) => c.id === overId);

      if (sourceIndex === rawOverIndex) {
        return null;
      }

      if (sourceIndex < rawOverIndex) {
        // Dragged downward past overId -> place AFTER overId
        afterId = overId;
      } else {
        // Dragged upward before overId -> place BEFORE overId
        afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null;
      }
    } else {
      // Dragging into a DIFFERENT column
      if (isBelow) {
        afterId = overId;
      } else {
        afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null;
      }
    }
  }

  // 4. Skip mutation if position didn't change in the same column
  if (sourceCol.id === destCol.id) {
    const currentSourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId);
    const currentPredecessorId =
      currentSourceIndex > 0 ? sourceCol.cards[currentSourceIndex - 1]!.id : null;
    if (afterId === currentPredecessorId) {
      return null;
    }
  }

  return {
    cardId: activeId,
    columnId: destCol.id,
    afterId,
  };
}
