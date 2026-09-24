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
/**
 * Linear-style board hotkeys (FEATURE_PLAN 2.4):
 *   J/K or ↓/↑  move within the column
 *   H/L or ←/→  move across columns
 *   Enter open card · Space quick peek · C create · P priority · M assign
 */
export declare function useBoardKeyboardNav(args: UseBoardKeyboardNavArgs): BoardKeyboardNav;
export {};
