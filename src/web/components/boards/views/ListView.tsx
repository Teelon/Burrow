import { useState } from 'react'
import { CalendarDays, CheckSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { useUpdateCard } from '../../../lib/queries'
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
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Table header */}
      <div
        className={`${gridCols} sticky top-0 z-10 bg-neutral-50/90 dark:bg-neutral-950/90 backdrop-blur-sm px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 border-b border-neutral-200/70 dark:border-neutral-800/70`}
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
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                )}
                {col.color && (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: col.color }}
                  />
                )}
                <span className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {col.name}
                </span>
                <span className="shrink-0 rounded-full bg-neutral-200/70 px-1.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800">
                  {col.cards.length}
                </span>
                {col.wipLimit != null && col.wipLimit > 0 && (
                  <span
                    className={`shrink-0 rounded-full border px-1.5 text-[11px] font-medium ${
                      col.cards.length > col.wipLimit
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-500'
                        : 'border-neutral-200 text-neutral-400 dark:border-neutral-700'
                    }`}
                    title="WIP limit"
                  >
                    WIP {col.wipLimit}
                  </span>
                )}
              </button>

              {/* Rows */}
              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {col.cards.length === 0 && (
                    <div className="px-3 py-2 text-xs italic text-neutral-400">No cards</div>
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
                        className={`${gridCols} items-center rounded-lg px-3 py-1.5 text-xs cursor-pointer hover:bg-white hover:shadow-xs hover:border border-transparent hover:border-neutral-200 dark:hover:bg-neutral-900 dark:hover:border-neutral-800 transition`}
                      >
                        {/* Title */}
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-neutral-800 dark:text-neutral-200">
                            {card.title || 'Untitled'}
                          </span>
                          {(card.totalSubtasks ?? 0) > 0 && (
                            <span
                              className="flex shrink-0 items-center gap-1 text-[10px] text-neutral-400"
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
                          className={`rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-semibold outline-none hover:border-neutral-300 focus:border-primary dark:hover:border-neutral-600 ${
                            card.priority && PRIORITY_BADGES[card.priority]
                              ? PRIORITY_BADGES[card.priority]!.class
                              : 'text-neutral-400'
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
                              overdue ? 'text-rose-500' : 'text-neutral-400'
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
                            className={`min-w-0 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] outline-none hover:border-neutral-300 focus:border-primary dark:hover:border-neutral-600 ${
                              overdue ? 'text-rose-500 font-medium' : 'text-neutral-600 dark:text-neutral-300'
                            }`}
                            title="Change due date"
                          />
                        </div>

                        {/* Assignees */}
                        <div className="flex min-w-0 items-center -space-x-1.5">
                          {card.assignees.slice(0, 4).map((a) => (
                            <span
                              key={a.userId}
                              title={a.name}
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-white bg-primary/20 text-[9px] font-semibold text-primary dark:border-neutral-900"
                            >
                              {a.name?.[0]?.toUpperCase() || 'U'}
                            </span>
                          ))}
                          {card.assignees.length > 4 && (
                            <span className="pl-2 text-[10px] text-neutral-400">
                              +{card.assignees.length - 4}
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        <div className="flex min-w-0 flex-wrap gap-1">
                          {card.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                backgroundColor: `${tag.color || '#64748b'}20`,
                                color: tag.color || '#64748b',
                              }}
                            >
                              #{tag.name}
                            </span>
                          ))}
                          {card.tags.length > 3 && (
                            <span className="text-[10px] text-neutral-400">
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
