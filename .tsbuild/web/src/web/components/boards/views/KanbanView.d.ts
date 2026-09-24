import { type ColumnItem } from './types';
interface KanbanViewProps {
    boardId: string;
    projectId: string;
    /** Unfiltered columns (drag math + menus keep working while filters hide cards). */
    columns: ColumnItem[];
    /** Filtered columns (what is rendered). */
    filteredColumns: ColumnItem[];
    isAddingColumn: boolean;
    setIsAddingColumn: (v: boolean) => void;
    onCardClick: (cardId: string) => void;
}
export declare function KanbanView({ boardId, projectId, columns, filteredColumns, isAddingColumn, setIsAddingColumn, onCardClick, }: KanbanViewProps): import("react").JSX.Element;
export {};
