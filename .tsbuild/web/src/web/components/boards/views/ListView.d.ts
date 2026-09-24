import { type ColumnItem } from './types';
interface ListViewProps {
    boardId: string;
    columns: ColumnItem[];
    onCardClick: (cardId: string) => void;
}
/**
 * Compact tabular view grouped by column (FEATURE_PLAN 2.2):
 * collapsible group headers, Title/Priority/Due/Assignees/Tags columns,
 * inline quick-edit for priority and due date.
 */
export declare function ListView({ boardId, columns, onCardClick }: ListViewProps): import("react").JSX.Element;
export {};
