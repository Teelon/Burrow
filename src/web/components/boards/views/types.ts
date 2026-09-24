export interface CardItem {
  id: string;
  columnId: string;
  notepadId: string;
  title: string;
  position: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null;
  dueDate?: number | null;
  assignees: Array<{ userId: string; name: string; image?: string | null }>;
  tags: Array<{ id: string; name: string; color?: string | null }>;
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

export const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'border border-[var(--c4)] text-[var(--c4)]' },
  medium: { label: 'Medium', class: 'border border-[var(--c3)] text-[var(--c3)]' },
  high: { label: 'High', class: 'border border-[var(--c2)] text-[var(--c2)]' },
  urgent: {
    label: 'Urgent',
    class: 'bg-[var(--danger)] text-[var(--accent-ink)] border border-transparent',
  },
};

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low'];

/** Columns whose name implies completion (confetti trigger, My Tasks filter). */
export const COMPLETED_COLUMN_RE = /done|completed|closed|shipped/i;

/** Priority → dot color for compact chips (calendar/list). */
export const PRIORITY_DOTS: Record<string, string> = {
  urgent: 'bg-[var(--danger)]',
  high: 'bg-[var(--c2)]',
  medium: 'bg-[var(--c3)]',
  low: 'bg-[var(--c4)]',
};
