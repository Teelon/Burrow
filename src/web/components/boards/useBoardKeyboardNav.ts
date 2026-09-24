import { useEffect, useRef, useState } from 'react';
import type { ColumnItem } from './views/types';

interface UseBoardKeyboardNavArgs {
  columns: ColumnItem[];
  /** When false (a modal is open / board not ready) all keys are ignored. */
  enabled: boolean;
  onOpenCard: (cardId: string) => void;
  onQuickPeek: (cardId: string) => void;
  onQuickAdd: (columnId: string) => void;
  onPriority: (cardId: string) => void;
  onAssign: (cardId: string) => void;
}

export interface BoardKeyboardNav {
  focusedCardId: string | null;
  setFocusedCardId: (id: string | null) => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TextArea' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

function locateCard(
  columns: ColumnItem[],
  cardId: string | null,
): { colIndex: number; cardIndex: number } | null {
  if (!cardId) return null;
  for (let c = 0; c < columns.length; c++) {
    const idx = columns[c]!.cards.findIndex((card) => card.id === cardId);
    if (idx !== -1) return { colIndex: c, cardIndex: idx };
  }
  return null;
}

function firstCardId(columns: ColumnItem[]): string | null {
  for (const col of columns) {
    const first = col.cards[0];
    if (first) return first.id;
  }
  return null;
}

/** The first non-empty column at or after `from` (searching `dir`). */
function findNonEmptyColumn(columns: ColumnItem[], from: number, dir: 1 | -1): ColumnItem | null {
  for (let i = from; i >= 0 && i < columns.length; i += dir) {
    const col = columns[i]!;
    if (col.cards.length > 0) return col;
  }
  return null;
}

/**
 * Linear-style board hotkeys (FEATURE_PLAN 2.4):
 *   J/K or ↓/↑  move within the column
 *   H/L or ←/→  move across columns
 *   Enter open card · Space quick peek · C create · P priority · M assign
 */
export function useBoardKeyboardNav(args: UseBoardKeyboardNavArgs): BoardKeyboardNav {
  const [focusedCardId, setFocusedCardIdState] = useState<string | null>(null);

  // Mirror state into refs so the (stable) window listener always sees current values.
  const argsRef = useRef(args);
  argsRef.current = args;
  const focusRef = useRef<string | null>(null);
  focusRef.current = focusedCardId;

  const setFocusedCardId = (id: string | null) => setFocusedCardIdState(id);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const a = argsRef.current;
      if (!a.enabled || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const { columns } = a;
      if (columns.length === 0) return;

      const pos = locateCard(columns, focusRef.current);

      const moveWithin = (delta: number) => {
        if (!pos) {
          const first = firstCardId(columns);
          if (first) setFocusedCardIdState(first);
          return;
        }
        const cards = columns[pos.colIndex]!.cards;
        const next = Math.min(Math.max(pos.cardIndex + delta, 0), cards.length - 1);
        const target = cards[next];
        if (target) setFocusedCardIdState(target.id);
      };

      const moveAcross = (dir: 1 | -1) => {
        if (!pos) {
          const first = firstCardId(columns);
          if (first) setFocusedCardIdState(first);
          return;
        }
        const col = findNonEmptyColumn(columns, pos.colIndex + dir, dir);
        if (!col) return;
        const targetIdx = Math.min(pos.cardIndex, col.cards.length - 1);
        const target = col.cards[targetIdx];
        if (target) setFocusedCardIdState(target.id);
      };

      const columnIdOfFocused = (): string | null => {
        if (pos) return columns[pos.colIndex]!.id;
        return columns[0]?.id ?? null;
      };

      switch (key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          moveWithin(1);
          return;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          moveWithin(-1);
          return;
        case 'h':
        case 'ArrowLeft':
          e.preventDefault();
          moveAcross(-1);
          return;
        case 'l':
        case 'ArrowRight':
          e.preventDefault();
          moveAcross(1);
          return;
        case 'Enter':
          if (focusRef.current) {
            e.preventDefault();
            a.onOpenCard(focusRef.current);
          }
          return;
        case ' ':
          if (focusRef.current) {
            e.preventDefault();
            a.onQuickPeek(focusRef.current);
          }
          return;
        case 'c': {
          const colId = columnIdOfFocused();
          if (colId) {
            e.preventDefault();
            a.onQuickAdd(colId);
          }
          return;
        }
        case 'p':
          if (focusRef.current) {
            e.preventDefault();
            a.onPriority(focusRef.current);
          }
          return;
        case 'm':
          if (focusRef.current) {
            e.preventDefault();
            a.onAssign(focusRef.current);
          }
          return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { focusedCardId, setFocusedCardId };
}
