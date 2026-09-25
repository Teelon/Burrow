import { describe, expect, it } from 'vitest';
import {
  computeCardDropTarget,
  computeColumnDropTarget,
  computeLinearReorderAfterId,
  type KanbanColumnLike,
} from './kanbanReorder';

describe('computeLinearReorderAfterId', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('returns undefined if active and over are identical', () => {
    expect(computeLinearReorderAfterId(items, 'b', 'b')).toBeUndefined();
  });

  it('returns undefined if an id is not found', () => {
    expect(computeLinearReorderAfterId(items, 'x', 'b')).toBeUndefined();
    expect(computeLinearReorderAfterId(items, 'a', 'y')).toBeUndefined();
  });

  it('moving to index 0 returns null (first item)', () => {
    // Moving 'c' to 'a' makes order [c, a, b, d], so afterId for 'c' is null
    expect(computeLinearReorderAfterId(items, 'c', 'a')).toBeNull();
  });

  it('moving downward places after the target item', () => {
    // Moving 'a' to 'c' makes order [b, c, a, d], so afterId for 'a' is 'c'
    expect(computeLinearReorderAfterId(items, 'a', 'c')).toBe('c');
  });

  it('moving upward places after the target predecessor', () => {
    // Moving 'd' to 'b' makes order [a, d, b, c], so afterId for 'd' is 'a'
    expect(computeLinearReorderAfterId(items, 'd', 'b')).toBe('a');
  });
});

describe('computeColumnDropTarget', () => {
  const cols = [{ id: 'col1' }, { id: 'col2' }, { id: 'col3' }];

  it('returns null if dragging onto self', () => {
    expect(
      computeColumnDropTarget(cols, { activeId: 'col1', overId: 'col1', overType: 'column' }),
    ).toBeNull();
  });

  it('dragging right places after target column', () => {
    // Drag col1 to col3 -> lands after col3
    const res = computeColumnDropTarget(cols, {
      activeId: 'col1',
      overId: 'col3',
      overType: 'column',
    });
    expect(res).toEqual({ columnId: 'col1', afterId: 'col3' });
  });

  it('dragging left places before target column (after target predecessor)', () => {
    // Drag col3 to col2 -> lands after col1 (before col2)
    const res = computeColumnDropTarget(cols, {
      activeId: 'col3',
      overId: 'col2',
      overType: 'column',
    });
    expect(res).toEqual({ columnId: 'col3', afterId: 'col1' });
  });

  it('dragging to the first column returns afterId: null', () => {
    // Drag col3 to col1 -> lands before col1, so afterId is null
    const res = computeColumnDropTarget(cols, {
      activeId: 'col3',
      overId: 'col1',
      overType: 'column',
    });
    expect(res).toEqual({ columnId: 'col3', afterId: null });
  });

  it('resolves overId when dragging over a card belonging to a column', () => {
    const cardColMap = new Map([['card-99', 'col2']]);
    const res = computeColumnDropTarget(cols, {
      activeId: 'col1',
      overId: 'card-99',
      overType: 'card',
      cardColumnMap: cardColMap,
    });
    expect(res).toEqual({ columnId: 'col1', afterId: 'col2' });
  });
});

describe('computeCardDropTarget', () => {
  const columns: KanbanColumnLike[] = [
    {
      id: 'col-todo',
      name: 'To Do',
      cards: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
    },
    {
      id: 'col-doing',
      name: 'In Progress',
      cards: [{ id: 'c4' }],
    },
    {
      id: 'col-empty',
      name: 'Done',
      cards: [],
    },
  ];

  describe('within same column', () => {
    it('returns null if dropped on itself without change', () => {
      const res = computeCardDropTarget(columns, {
        activeId: 'c2',
        overId: 'c2',
        isOverColumn: false,
      });
      expect(res).toBeNull();
    });

    it('dragging down past a card lands after that card', () => {
      // Drag c1 past c3 -> afterId is c3
      const res = computeCardDropTarget(columns, {
        activeId: 'c1',
        overId: 'c3',
        isOverColumn: false,
      });
      expect(res).toEqual({
        cardId: 'c1',
        columnId: 'col-todo',
        afterId: 'c3',
      });
    });

    it('dragging up before a card lands after its predecessor', () => {
      // Drag c3 to c2 -> lands after c1
      const res = computeCardDropTarget(columns, {
        activeId: 'c3',
        overId: 'c2',
        isOverColumn: false,
      });
      expect(res).toEqual({
        cardId: 'c3',
        columnId: 'col-todo',
        afterId: 'c1',
      });
    });

    it('dragging up to the first card lands at the top (afterId: null)', () => {
      // Drag c2 to c1 -> lands at top of col-todo
      const res = computeCardDropTarget(columns, {
        activeId: 'c2',
        overId: 'c1',
        isOverColumn: false,
      });
      expect(res).toEqual({
        cardId: 'c2',
        columnId: 'col-todo',
        afterId: null,
      });
    });

    it('detects no-op when position would not change', () => {
      const resUp = computeCardDropTarget(columns, {
        activeId: 'c3',
        overId: 'c3',
        isOverColumn: false,
      });
      expect(resUp).toBeNull();
    });
  });

  describe('across columns', () => {
    it('dropping onto an empty column lands at top (afterId: null)', () => {
      const res = computeCardDropTarget(columns, {
        activeId: 'c1',
        overId: 'col-empty',
        isOverColumn: true,
      });
      expect(res).toEqual({
        cardId: 'c1',
        columnId: 'col-empty',
        afterId: null,
      });
    });

    it('dropping onto column body with cards appends to the bottom', () => {
      const res = computeCardDropTarget(columns, {
        activeId: 'c1',
        overId: 'col-doing',
        isOverColumn: true,
      });
      expect(res).toEqual({
        cardId: 'c1',
        columnId: 'col-doing',
        afterId: 'c4',
      });
    });

    it('dropping onto a card with isBelow: true lands after it', () => {
      const res = computeCardDropTarget(columns, {
        activeId: 'c1',
        overId: 'c4',
        isOverColumn: false,
        isBelow: true,
      });
      expect(res).toEqual({
        cardId: 'c1',
        columnId: 'col-doing',
        afterId: 'c4',
      });
    });

    it('dropping onto a card with isBelow: false lands before it', () => {
      const res = computeCardDropTarget(columns, {
        activeId: 'c4',
        overId: 'c2',
        isOverColumn: false,
        isBelow: false,
      });
      expect(res).toEqual({
        cardId: 'c4',
        columnId: 'col-todo',
        afterId: 'c1',
      });
    });
  });
});
