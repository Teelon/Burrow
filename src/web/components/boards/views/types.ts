export interface CardItem {
  id: string
  columnId: string
  notepadId: string
  title: string
  position: string
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
  dueDate?: number | null
  assignees: Array<{ userId: string; name: string; image?: string | null }>
  tags: Array<{ id: string; name: string; color?: string | null }>
  totalSubtasks?: number
  completedSubtasks?: number
}

export interface ColumnItem {
  id: string
  name: string
  color?: string | null
  position: string
  wipLimit?: number | null
  cards: CardItem[]
}

export const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  medium: { label: 'Medium', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  high: { label: 'High', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  urgent: { label: 'Urgent', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
}

export type Priority = 'low' | 'medium' | 'high' | 'urgent'

export const PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low']

/** Columns whose name implies completion (confetti trigger, My Tasks filter). */
export const COMPLETED_COLUMN_RE = /done|completed|closed|shipped/i

/** Priority → dot color for compact chips (calendar/list). */
export const PRIORITY_DOTS: Record<string, string> = {
  urgent: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-400',
}
