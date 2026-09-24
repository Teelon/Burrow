import { useEffect, useState } from 'react'
import { Calendar, User, X } from 'lucide-react'
import { useMembers, useUpdateCard } from '../../../lib/queries'
import { PRIORITY_BADGES, PRIORITIES, type CardItem, type Priority } from './types'

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        {children}
      </div>
    </div>
  )
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])
}

function CardHeading({ card, columnName }: { card: CardItem; columnName?: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {card.title || 'Untitled'}
        </div>
        {columnName && (
          <div className="mt-0.5 text-[11px] text-neutral-400">in {columnName}</div>
        )}
      </div>
      {card.priority && PRIORITY_BADGES[card.priority] && (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            PRIORITY_BADGES[card.priority]!.class
          }`}
        >
          {PRIORITY_BADGES[card.priority]!.label}
        </span>
      )}
    </div>
  )
}

/** Space-bar quick peek: read-only snapshot of the focused card. */
export function QuickPeekModal({
  card,
  columnName,
  onClose,
}: {
  card: CardItem
  columnName?: string
  onClose: () => void
}) {
  useEscape(onClose)

  const dueLabel = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null
  const overdue = card.dueDate != null && card.dueDate < Date.now()

  return (
    <Backdrop onClose={onClose}>
      <CardHeading card={card} columnName={columnName} />

      <div className="space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-neutral-400" />
          {dueLabel ? (
            <span className={overdue ? 'font-medium text-rose-500' : ''}>{dueLabel}</span>
          ) : (
            <span className="text-neutral-400">No due date</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-neutral-400" />
          {card.assignees.length > 0 ? (
            <span className="truncate">{card.assignees.map((a) => a.name).join(', ')}</span>
          ) : (
            <span className="text-neutral-400">Unassigned</span>
          )}
        </div>

        {(card.totalSubtasks ?? 0) > 0 && (
          <div className="text-neutral-500">
            Subtasks: {card.completedSubtasks ?? 0}/{card.totalSubtasks} done
          </div>
        )}

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {card.tags.map((tag) => (
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
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Close (Esc)
        </button>
      </div>
    </Backdrop>
  )
}

/** P-key quick priority picker for the focused card. */
export function PriorityPickerModal({
  card,
  boardId,
  onClose,
}: {
  card: CardItem
  boardId: string
  onClose: () => void
}) {
  useEscape(onClose)
  const updateCard = useUpdateCard()

  const set = (priority: Priority | null) => {
    updateCard.mutate({ cardId: card.id, boardId, priority })
    onClose()
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Set priority
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => set(null)}
          className={`rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
            !card.priority
              ? 'border-primary/60 bg-primary/10 text-primary'
              : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800'
          }`}
        >
          None
        </button>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(p)}
            className={`rounded-lg border px-2 py-1.5 text-xs font-medium capitalize transition ${
              card.priority === p
                ? 'border-primary/60 bg-primary/10 text-primary'
                : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </Backdrop>
  )
}

/** M-key member assign picker for the focused card (toggles assigneeIds). */
export function AssignPickerModal({
  card,
  boardId,
  onClose,
}: {
  card: CardItem
  boardId: string
  onClose: () => void
}) {
  useEscape(onClose)
  const { data: members = [] } = useMembers()
  const updateCard = useUpdateCard()
  const [saving, setSaving] = useState(false)

  const currentIds = card.assignees.map((a) => a.userId)

  const toggle = async (userId: string) => {
    if (saving) return
    const next = currentIds.includes(userId)
      ? currentIds.filter((id) => id !== userId)
      : [...currentIds, userId]
    setSaving(true)
    try {
      await updateCard.mutateAsync({ cardId: card.id, boardId, assigneeIds: next })
      onClose()
    } catch {
      setSaving(false)
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
        Assign member
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {members.length === 0 && (
          <div className="px-1 py-2 text-xs italic text-neutral-400">No members</div>
        )}
        {members.map((m) => {
          const assigned = currentIds.includes(m.userId)
          return (
            <button
              key={m.userId}
              type="button"
              disabled={saving}
              onClick={() => toggle(m.userId)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                assigned
                  ? 'bg-primary/10 text-primary'
                  : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-semibold">
                {m.name?.[0]?.toUpperCase() || 'U'}
              </span>
              <span className="min-w-0 flex-1 truncate">{m.name || m.email}</span>
              {assigned && <X className="h-3 w-3 opacity-60" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Backdrop>
  )
}
