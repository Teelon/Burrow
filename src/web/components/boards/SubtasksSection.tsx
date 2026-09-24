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
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { StatusDiamond } from '../ui/StatusDiamond'

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
      className="group flex items-center gap-2 px-1.5 py-1 min-h-[44px] md:min-h-0 hover:bg-[var(--hi)] transition"
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        className="touch-none cursor-grab active:cursor-grabbing text-[var(--muted)] hover:text-[var(--text)] shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
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
        aria-label={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
        className={`shrink-0 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center transition ${
          subtask.completed
            ? 'text-[var(--c4)]'
            : 'text-[var(--muted)] hover:text-[var(--c4)]'
        }`}
      >
        {/* Decorative diamond marker; the button itself keeps checkbox toggle behavior. */}
        <StatusDiamond color={subtask.completed ? 'var(--c4)' : 'var(--muted)'} size={12} />
      </button>

      {editing ? (
        <Input
          autoFocus
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
          className="border-none bg-transparent px-0"
        />
      ) : (
        <span
          onDoubleClick={() => setEditing(true)}
          className={`flex-1 min-w-0 text-xs cursor-text ${
            subtask.completed
              ? 'line-through text-[var(--muted)]'
              : 'text-[var(--text)]'
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
        aria-label="Remove subtask"
        className="p-0.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition shrink-0"
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
    <div className="border-t border-[var(--hair)] pt-4">
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-xs uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5"
          style={{ fontFamily: 'Archivo, sans-serif', fontVariationSettings: "'wdth' 122, 'wght' 800" }}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Subtasks</span>
        </h3>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[var(--surface2)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-[var(--muted)] tabular-nums">
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
        <Plus className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAdd()
            }
          }}
          placeholder="Add a subtask…"
          className="border-none bg-transparent px-0"
        />
        {draft.trim() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAdd}
            disabled={createSubtask.isPending}
          >
            Add
          </Button>
        )}
      </div>
    </div>
  )
}
