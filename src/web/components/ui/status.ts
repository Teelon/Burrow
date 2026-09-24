/** Basalt Layer 4: centralized priority → status token mapping. */

export type PriorityKey = 'urgent' | 'high' | 'medium' | 'low'

export const PRIORITY_TOKENS: Record<PriorityKey, string> = {
  urgent: 'var(--danger)',
  high: 'var(--c2)',
  medium: 'var(--c3)',
  low: 'var(--c4)',
}

export function resolvePriorityToken(priority?: string | null): string {
  if (!priority) return 'var(--c1)'
  const key = priority.toLowerCase() as PriorityKey
  return PRIORITY_TOKENS[key] ?? 'var(--c1)'
}

/** Priority → Badge tone (mirrors PRIORITY_BADGES Basalt tokens). */
export function priorityBadgeTone(
  priority?: string | null,
): 'danger' | 'c2' | 'c3' | 'c4' | 'neutral' {
  switch (priority?.toLowerCase()) {
    case 'urgent':
      return 'danger'
    case 'high':
      return 'c2'
    case 'medium':
      return 'c3'
    case 'low':
      return 'c4'
    default:
      return 'neutral'
  }
}

/** Priority → Basalt CSS color for the StatusDiamond marker. */
export function priorityDiamondColor(priority?: string | null): string {
  return resolvePriorityToken(priority)
}

/**
 * Resolve a Kanban column header color.
 * Explicit column.color wins; completed columns get --c4; otherwise neutral --c1.
 */
export function resolveColumnColor(column: { name: string; color?: string | null }): string {
  if (column.color) return column.color
  if (COMPLETED_COLUMN_RE.test(column.name)) return 'var(--c4)'
  return 'var(--c1)'
}

/** Columns whose name implies completion (confetti trigger, My Tasks filter). */
export const COMPLETED_COLUMN_RE = /done|completed|closed|shipped/i
