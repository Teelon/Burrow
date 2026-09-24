import { useState, useEffect, lazy, Suspense } from 'react'
import { toast } from 'sonner'
import {
  Calendar,
  Flag,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react'

const LazyNotepadEditor = lazy(() =>
  import('../../editor/NotepadEditor').then((m) => ({ default: m.NotepadEditor })),
)
import {
  useCard,
  useDeleteCard,
  useMembers,
  useMoveCard,
  useRestoreCard,
  useUpdateCard,
} from '../../lib/queries'
import { SubtasksSection } from './SubtasksSection'
import { CommentsFeed } from './CommentsFeed'

interface CardPanelProps {
  cardId: string
  boardId: string
  projectId: string
  columns: Array<{ id: string; name: string }>
  onClose: () => void
}

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  { value: 'high', label: 'High', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
] as const

export function CardPanel({
  cardId,
  boardId,
  columns,
  onClose,
}: CardPanelProps) {
  const { data: card, isLoading } = useCard(cardId)
  const { data: members = [] } = useMembers()
  const updateCardMutation = useUpdateCard()
  const moveCardMutation = useMoveCard()
  const deleteCardMutation = useDeleteCard()
  const restoreCardMutation = useRestoreCard()

  const [title, setTitle] = useState('')

  useEffect(() => {
    if (card) {
      setTitle(card.title || '')
    }
  }, [card])

  if (isLoading || !card) {
    return (
      <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] md:w-[640px] bg-white dark:bg-neutral-900 shadow-2xl z-50 border-l border-neutral-200 dark:border-neutral-800 p-6 flex flex-col items-center justify-center">
        <div className="text-sm text-neutral-400">Loading card…</div>
      </div>
    )
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== card.title) {
      updateCardMutation.mutate({
        cardId,
        boardId,
        title: title.trim(),
      })
    }
  }

  const handlePriorityChange = (priority: 'low' | 'medium' | 'high' | 'urgent' | null) => {
    updateCardMutation.mutate({
      cardId,
      boardId,
      priority,
    })
  }

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const timestamp = val ? new Date(val).getTime() : null
    updateCardMutation.mutate({
      cardId,
      boardId,
      dueDate: timestamp,
    })
  }

  const handleColumnChange = (newColId: string) => {
    if (newColId !== card.columnId) {
      moveCardMutation.mutate({
        cardId,
        boardId,
        columnId: newColId,
      })
    }
  }

  const toggleAssignee = (userId: string) => {
    const current = card.assignees.map((a) => a.userId)
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]
    updateCardMutation.mutate({
      cardId,
      boardId,
      assigneeIds: next,
    })
  }

  const handleDelete = () => {
    deleteCardMutation.mutate(
      { cardId, boardId },
      {
        onSuccess: () => {
          onClose()
          toast('Card moved to trash', {
            duration: 6000,
            action: {
              label: 'Undo',
              onClick: () => restoreCardMutation.mutate({ cardId }),
            },
          })
        },
      },
    )
  }

  const isoDueDate = card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : ''

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[540px] md:w-[680px] bg-white dark:bg-neutral-950 shadow-2xl z-50 border-l border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select
            value={card.columnId}
            onChange={(e) => handleColumnChange(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 focus:outline-none"
          >
            {columns.map((col) => (
              <option key={col.id} value={col.id}>
                {col.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleDelete}
            title="Delete card"
            className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title */}
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Card Title"
            className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none placeholder-neutral-300 dark:placeholder-neutral-700"
          />
        </div>

        {/* Metadata Properties Grid */}
        <div className="bg-neutral-50/80 dark:bg-neutral-900/50 p-4 rounded-xl border border-neutral-200/70 dark:border-neutral-800/70 space-y-3 text-xs">
          {/* Priority */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-neutral-500 w-28">
              <Flag className="w-3.5 h-3.5" />
              <span>Priority</span>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {PRIORITIES.map((p) => {
                const active = card.priority === p.value
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => handlePriorityChange(active ? null : p.value)}
                    className={`px-2 py-0.5 rounded-md font-medium transition ${
                      active
                        ? `${p.color} ring-1 ring-inset ring-neutral-400/40`
                        : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-neutral-500 w-28">
              <Calendar className="w-3.5 h-3.5" />
              <span>Due Date</span>
            </div>
            <input
              type="date"
              value={isoDueDate}
              onChange={handleDueDateChange}
              className="px-2 py-1 text-xs rounded bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 focus:outline-none"
            />
          </div>

          {/* Assignees */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-neutral-500 w-28 pt-1">
              <Users className="w-3.5 h-3.5" />
              <span>Assignees</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {members.map((m) => {
                const isAssigned = card.assignees.some((a) => a.userId === m.userId)
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleAssignee(m.userId)}
                    className={`px-2 py-1 rounded-lg border text-xs flex items-center gap-1.5 transition ${
                      isAssigned
                        ? 'bg-primary/10 border-primary/30 text-primary font-medium'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px]">
                      {m.name?.[0]?.toUpperCase() || 'U'}
                    </span>
                    <span>{m.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-neutral-500 w-28">
                <Tag className="w-3.5 h-3.5" />
                <span>Tags</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {card.tags.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-0.5 rounded text-[11px] font-medium"
                    style={{
                      backgroundColor: `${t.color || '#64748b'}20`,
                      color: t.color || '#64748b',
                    }}
                  >
                    #{t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subtasks / Checklist */}
        <SubtasksSection cardId={cardId} boardId={boardId} subtasks={card.subtasks || []} />

        {/* Card Body (BlockNote Notepad Editor) */}
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-2">
            Card Notes & Body
          </h3>
          <Suspense
            fallback={
              <div className="p-4 text-xs text-neutral-400">Loading card notes…</div>
            }
          >
            <LazyNotepadEditor notepadId={card.notepadId} hideTitle hideFavorite />
          </Suspense>
        </div>

        {/* Discussion thread */}
        <CommentsFeed cardId={cardId} />
      </div>
    </div>
  )
}
