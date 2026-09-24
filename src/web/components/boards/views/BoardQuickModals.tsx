import { useEffect, useState } from 'react'
import { Calendar, User, X } from 'lucide-react'
import { useMembers, useUpdateCard } from '../../../lib/queries'
import { Avatar } from '../../ui/Avatar'
import { Badge } from '../../ui/Badge'
import { ModalShell } from '../../ui/ModalShell'
import { priorityBadgeTone } from '../../ui/status'
import { PRIORITY_BADGES, PRIORITIES, type CardItem, type Priority } from './types'

function Backdrop({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  return (
    <ModalShell open onClose={onClose} title={title} className="max-w-sm">
      {children}
    </ModalShell>
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
        <div
          className="text-sm text-[var(--text)]"
          style={{ fontFamily: 'Archivo, sans-serif', fontVariationSettings: "'wdth' 122, 'wght' 700" }}
        >
          {card.title || 'Untitled'}
        </div>
        {columnName && (
          <div className="mt-0.5 text-[11px] text-[var(--muted)]">in {columnName}</div>
        )}
      </div>
      {card.priority && PRIORITY_BADGES[card.priority] && (
        <Badge tone={priorityBadgeTone(card.priority)}>
          {PRIORITY_BADGES[card.priority]!.label}
        </Badge>
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

      <div className="space-y-2 text-xs text-[var(--text)]">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-[var(--muted)]" />
          {dueLabel ? (
            <span className={overdue ? 'font-medium text-[var(--danger)]' : ''}>{dueLabel}</span>
          ) : (
            <span className="text-[var(--muted)]">No due date</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-[var(--muted)]" />
          {card.assignees.length > 0 ? (
            <span className="truncate">{card.assignees.map((a) => a.name).join(', ')}</span>
          ) : (
            <span className="text-[var(--muted)]">Unassigned</span>
          )}
        </div>

        {(card.totalSubtasks ?? 0) > 0 && (
          <div className="text-[var(--muted)]">
            Subtasks: {card.completedSubtasks ?? 0}/{card.totalSubtasks} done
          </div>
        )}

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {card.tags.map((tag) => (
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
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 min-h-[44px] text-xs text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]"
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
    <Backdrop onClose={onClose} title="Set priority">
      <div className="grid grid-cols-5 gap-1.5">
        <button
          type="button"
          onClick={() => set(null)}
          className={`chamfer-sm border px-2 py-1.5 min-h-[44px] text-xs font-medium transition ${
            !card.priority
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
              : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]'
          }`}
        >
          None
        </button>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => set(p)}
            className={`chamfer-sm border px-2 py-1.5 min-h-[44px] text-xs font-medium capitalize transition ${
              card.priority === p
                ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--text)] hover:bg-[var(--hi)]'
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
    <Backdrop onClose={onClose} title="Assign member">
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {members.length === 0 && (
          <div className="px-1 py-2 text-xs italic text-[var(--muted)]">No members</div>
        )}
        {members.map((m) => {
          const assigned = currentIds.includes(m.userId)
          return (
            <button
              key={m.userId}
              type="button"
              disabled={saving}
              onClick={() => toggle(m.userId)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 min-h-[44px] text-left text-xs transition ${
                assigned
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text)] hover:bg-[var(--hi)]'
              }`}
            >
              <Avatar name={m.name || m.email} size="xs" />
              <span className="min-w-0 flex-1 truncate">{m.name || m.email}</span>
              {assigned && <X className="h-3 w-3 opacity-60" aria-hidden />}
            </button>
          )
        })}
      </div>
    </Backdrop>
  )
}
