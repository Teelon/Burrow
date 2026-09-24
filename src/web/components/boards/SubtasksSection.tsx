import { useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CheckSquare, GripVertical, Plus, X } from 'lucide-react'
import {
  useCreateSubtask,
  useDeleteSubtask,
  useUpdateSubtask,
  type SubtaskItem,
} from '../../lib/queries'

interface SubtasksSectionProps {
  cardId: string
  boardId: string
  subtasks: SubtaskItem[]
}

function SubtaskRow({
  subtask,
  cardId,
  boardId,
}: {
  subtask: SubtaskItem
  cardId: string
  boardId: string
}) {
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subtask.title)

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: subtask.id, data: { type: 'subtask', subtaskId: subtask.id } })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== subtask.title) {
      updateSubtask.mutate({ cardId, boardId, subtaskId: subtask.id, title: trimmed })
    } else {
      setDraft(subtask.title)
    }
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="touch-none cursor-grab active:cursor-grabbing text-neutral-300 dark:text-neutral-600 hover:text-neutral-500 shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() =>
          updateSubtask.mutate({
            cardId,
            boardId,
            subtaskId: subtask.id,
            completed: !subtask.completed,
          })
        }
        title={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`shrink-0 transition ${
          subtask.completed
            ? 'text-emerald-500'
            : 'text-neutral-300 dark:text-neutral-600 hover:text-emerald-500'
        }`}
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" />
          {subtask.completed && <path d="M4.5 8.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />}
        </svg>
      </button>

      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setDraft(subtask.title)
              setEditing(false)
            }
          }}
          className="flex-1 min-w-0 text-xs bg-transparent border-none focus:outline-none text-neutral-800 dark:text-neutral-200"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 min-w-0 text-xs cursor-text ${
            subtask.completed
              ? 'line-through text-neutral-400'
              : 'text-neutral-700 dark:text-neutral-300'
          }`}
          title="Double-click to rename"
        >
          {subtask.title}
        </span>
      )}

      <button
        type="button"
        onClick={() => deleteSubtask.mutate({ cardId, boardId, subtaskId: subtask.id })}
        title="Remove subtask"
        className="p-0.5 rounded text-neutral-300 dark:text-neutral-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function SubtasksSection({ cardId, boardId, subtasks }: SubtasksSectionProps) {
  const createSubtask = useCreateSubtask()
  const updateSubtask = useUpdateSubtask()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const total = subtasks.length
  const completed = subtasks.filter((s) => s.completed).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  const handleAdd = () => {
    const title = draft.trim()
    if (!title || createSubtask.isPending) return
    createSubtask.mutate(
      { cardId, boardId, title },
      {
        onSuccess: () => {
          setDraft('')
          inputRef.current?.focus()
        },
      },
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = subtasks.findIndex((s) => s.id === active.id)
    const newIndex = subtasks.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(subtasks, oldIndex, newIndex)
    // Server contract: place after this sibling (null = first).
    const afterId = reordered.findIndex((s) => s.id === active.id) === 0
      ? null
      : reordered[reordered.findIndex((s) => s.id === active.id) - 1]!.id

    updateSubtask.mutate({ cardId, boardId, subtaskId: String(active.id), afterId })
  }

  return (
    <div className="border-t border-neutral-200/60 dark:border-neutral-800/60 pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Subtasks</span>
        </h3>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct === 100 ? 'bg-emerald-500' : 'bg-primary'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
              {completed}/{total}
            </span>
          </div>
        )}
      </div>

      {total > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5 mb-2">
              {subtasks.map((subtask) => (
                <SubtaskRow key={subtask.id} subtask={subtask} cardId={cardId} boardId={boardId} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2 px-1.5 py-1">
        <Plus className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Add a subtask…"
          className="flex-1 min-w-0 text-xs bg-transparent border-none focus:outline-none placeholder-neutral-400 text-neutral-800 dark:text-neutral-200"
        />
        {draft.trim() && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={createSubtask.isPending}
            className="text-[11px] font-semibold text-primary hover:opacity-80 disabled:opacity-50"
          >
            Add
          </button>
        )}
      </div>
    </div>
  )
}
