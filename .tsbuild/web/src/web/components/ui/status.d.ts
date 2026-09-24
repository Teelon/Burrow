/** Basalt Layer 4: centralized priority → status token mapping. */
export type PriorityKey = 'urgent' | 'high' | 'medium' | 'low';
export declare const PRIORITY_TOKENS: Record<PriorityKey, string>;
export declare function resolvePriorityToken(priority?: string | null): string;
/** Priority → Badge tone (mirrors PRIORITY_BADGES Basalt tokens). */
export declare function priorityBadgeTone(priority?: string | null): 'danger' | 'c2' | 'c3' | 'c4' | 'neutral';
/** Priority → Basalt CSS color for the StatusDiamond marker. */
export declare function priorityDiamondColor(priority?: string | null): string;
/**
 * Resolve a Kanban column header color.
 * Explicit column.color wins; completed columns get --c4; otherwise neutral --c1.
 */
export declare function resolveColumnColor(column: {
    name: string;
    color?: string | null;
}): string;
/** Columns whose name implies completion (confetti trigger, My Tasks filter). */
export declare const COMPLETED_COLUMN_RE: RegExp;
