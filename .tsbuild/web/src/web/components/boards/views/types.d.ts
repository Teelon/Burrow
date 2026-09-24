export interface CardItem {
    id: string;
    columnId: string;
    notepadId: string;
    title: string;
    position: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
    dueDate?: number | null;
    assignees: Array<{
        userId: string;
        name: string;
        image?: string | null;
    }>;
    tags: Array<{
        id: string;
        name: string;
        color?: string | null;
    }>;
    totalSubtasks?: number;
    completedSubtasks?: number;
}
export interface ColumnItem {
    id: string;
    name: string;
    color?: string | null;
    position: string;
    wipLimit?: number | null;
    cards: CardItem[];
}
export declare const PRIORITY_BADGES: Record<string, {
    label: string;
    class: string;
}>;
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export declare const PRIORITIES: Priority[];
/** Columns whose name implies completion (confetti trigger, My Tasks filter). */
export declare const COMPLETED_COLUMN_RE: RegExp;
/** Priority → dot color for compact chips (calendar/list). */
export declare const PRIORITY_DOTS: Record<string, string>;
