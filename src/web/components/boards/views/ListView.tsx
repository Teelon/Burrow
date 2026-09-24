import { useState } from 'react'
import { CalendarDays, CheckSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { useUpdateCard } from '../../../lib/queries'
import { Avatar, AvatarGroup } from '../../ui/Avatar'
import { Badge } from '../../ui/Badge'
import { StatusDiamond } from '../../ui/StatusDiamond'
import { PRIORITY_BADGES, PRIORITIES, type ColumnItem, type Priority } from './types'

interface ListViewProps {
  boardId: string
  columns: ColumnItem[]
  onCardClick: (cardId: string) => void
}

function toDateInput(ts: number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Parse `yyyy-mm-dd` as a local noon timestamp (avoids UTC off-by-one). */
function parseDateInput(v: string): number | null {
  const parts = v.split('-').map(Number)
  const [y, m, d] = parts
  if (!y || !m || !d || parts.length !== 3) return null
  return new Date(y, m - 1, d, 12).getTime()
}

/**
 * Compact tabular view grouped by column (FEATURE_PLAN 2.2):
 * collapsible group headers, Title/Priority/Due/Assignees/Tags columns,
 * inline quick-edit for priority and due date.
 */
export function ListView({ boardId, columns, onCardClick }: ListViewProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const updateCard = useUpdateCard()

  const gridCols = 'grid grid-cols-[minmax(0,1fr)_96px_140px_120px_minmax(0,1fr)] gap-3'

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-[var(--bg)] text-[var(--text)]">
      {/* Table header */}
      <div
        className={`${gridCols} sticky top-0 z-10 bg-[var(--surface2)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]`}
      >
        <span>Title</span>
        <span>Priority</span>
        <span>Due Date</span>
        <span>Assignees</span>
        <span>Tags</span>
      </div>

      <div className="mt-3 space-y-5">
        {columns.map((col) => {
          const isCollapsed = Boolean(collapsed[col.id])
          return (
            <section key={col.id}>
              {/* Group header */}
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [col.id]: !c[col.id] }))}
                className="flex w-full items-center gap-2 px-3 py-2 min-h-[44px] text-left hover:bg-[var(--hi)] transition border-l-4"
                style={{ borderLeftColor: col.color || 'var(--c1)' }}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                )}
                {col.color && (
                  <StatusDiamond color={col.color} size={9} />
                )}
                <span
                  className="truncate text-sm text-[var(--text)] uppercase tracking-wider"
                  style={{ fontFamily: 'Archivo, sans-serif', fontVariationSettings: "'wdth' 122, 'wght' 800" }}
                >
                  {col.name}
                </span>
                <Badge tone="neutral">{col.cards.length}</Badge>
                {col.wipLimit != null && col.wipLimit > 0 && (
                  <Badge
                    tone={col.cards.length > col.wipLimit ? 'danger' : 'neutral'}
                    title="WIP limit"
                  >
                    WIP {col.wipLimit}
                  </Badge>
                )}
              </button>

              {/* Rows */}
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {col.cards.length === 0 && (
                    <div className="px-3 py-2 text-xs italic text-[var(--muted)]">No cards</div>
                  )}
                  {col.cards.map((card) => {
                    const overdue = card.dueDate != null && card.dueDate < Date.now()
                    return (
                      <div
                        key={card.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onCardClick(card.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onCardClick(card.id)
                          }
                        }}
                        className={`${gridCols} items-center px-3 py-1.5 min-h-[44px] text-xs cursor-pointer border border-transparent border-l-4 hover:bg-[var(--surface)] hover:border-[var(--line)] transition`}
                        style={{ borderLeftColor: col.color || 'var(--c1)' }}
                      >
                        {/* Title */}
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[var(--text)]">
                            {card.title || 'Untitled'}
                          </span>
                          {(card.totalSubtasks ?? 0) > 0 && (
                            <span
                              className="flex shrink-0 items-center gap-1 text-[10px] text-[var(--muted)]"
                              title={`${card.completedSubtasks ?? 0}/${card.totalSubtasks} subtasks`}
                            >
                              <CheckSquare className="h-3 w-3" />
                              <span className="tabular-nums">
                                {card.completedSubtasks ?? 0}/{card.totalSubtasks}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Priority (inline quick-edit) */}
                        <select
                          value={card.priority ?? ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const v = e.target.value
                            updateCard.mutate({
                              cardId: card.id,
                              boardId,
                              priority: v ? (v as Priority) : null,
                            })
                          }}
                          className={`chamfer-sm border border-transparent bg-transparent px-1 py-0.5 min-h-[44px] md:min-h-0 text-[11px] font-semibold outline-none hover:border-[var(--line)] focus:border-[var(--accent)] ${
                            card.priority && PRIORITY_BADGES[card.priority]
                              ? PRIORITY_BADGES[card.priority]!.class
                              : 'text-[var(--muted)]'
                          }`}
                          title="Change priority"
                        >
                          <option value="">—</option>
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>
                              {PRIORITY_BADGES[p]?.label ?? p}
                            </option>
                          ))}
                        </select>

                        {/* Due date (inline quick-edit) */}
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <CalendarDays
                            className={`h-3.5 w-3.5 shrink-0 ${
                              overdue ? 'text-[var(--danger)]' : 'text-[var(--muted)]'
                            }`}
                          />
                          <input
                            type="date"
                            value={toDateInput(card.dueDate)}
                            onChange={(e) => {
                              const ts = e.target.value ? parseDateInput(e.target.value) : null
                              updateCard.mutate({
                                cardId: card.id,
                                boardId,
                                dueDate: e.target.value ? ts : null,
                              })
                            }}
                            className={`min-w-0 border border-transparent bg-transparent px-1 py-0.5 text-[11px] outline-none hover:border-[var(--line)] focus:border-[var(--accent)] ${
                              overdue ? 'text-[var(--danger)] font-medium' : 'text-[var(--text)]'
                            }`}
                            title="Change due date"
                          />
                        </div>

                        {/* Assignees */}
                        <AvatarGroup max={4} className="min-w-0">
                          {card.assignees.map((a) => (
                            <Avatar key={a.userId} name={a.name || 'U'} size="xs" title={a.name} />
                          ))}
                        </AvatarGroup>

                        {/* Tags */}
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {card.tags.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag.id}
                              tone="neutral"
                              style={{
                                backgroundColor: `${tag.color || '#64748b'}20`,
                                color: tag.color || '#64748b',
                                borderColor: `${tag.color || '#64748b'}40`,
                              }}
                            >
                              #{tag.name}
                            </Badge>
                          ))}
                          {card.tags.length > 3 && (
                            <span className="text-[10px] text-[var(--muted)]">
                              +{card.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
