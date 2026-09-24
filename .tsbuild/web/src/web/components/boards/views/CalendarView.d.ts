import { type ColumnItem } from './types';
interface CalendarViewProps {
    boardId: string;
    columns: ColumnItem[];
    onCardClick: (cardId: string) => void;
}
/**
 * Monthly grid placing cards by `dueDate` (FEATURE_PLAN 2.2).
 * Drag a chip (scheduled or from the Unscheduled tray) onto a day to reschedule.
 */
export declare function CalendarView({ boardId, columns, onCardClick }: CalendarViewProps): import("react").JSX.Element;
export {};
