import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
  X,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { toast } from 'sonner'
import {
  useCreateColumn,
  useDeleteColumn,
  useMoveCard,
  useMoveColumn,
  useUpdateColumn,
} from '../../../lib/queries'
import { QuickAddCard } from '../QuickAddCard'
import { useBoardKeyboardNav } from '../useBoardKeyboardNav'
import {
  AssignPickerModal,
  PriorityPickerModal,
  QuickPeekModal,
} from './BoardQuickModals'
import { COMPLETED_COLUMN_RE, PRIORITY_BADGES, type CardItem, type ColumnItem } from './types'

interface KanbanViewProps {
  boardId: string
  projectId: string
  /** Unfiltered columns (drag math + menus keep working while filters hide cards). */
  columns: ColumnItem[]
  /** Filtered columns (what is rendered). */
  filteredColumns: ColumnItem[]
  isAddingColumn: boolean
  setIsAddingColumn: (v: boolean) => void
  onCardClick: (cardId: string) => void
}

/** Card count vs. WIP limit; turns rose when the limit is exceeded. */
function CountPill({ count, wipLimit }: { count: number; wipLimit?: number | null }) {
  const over = wipLimit != null && wipLimit > 0 && count > wipLimit
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.2 text-xs font-medium ${
        over
          ? 'border border-rose-500/30 bg-rose-500/10 text-rose-500'
          : 'bg-neutral-200/70 text-neutral-500 dark:bg-neutral-800'
      }`}
      title={wipLimit != null && wipLimit > 0 ? `${count} of ${wipLimit} WIP limit` : undefined}
    >
      {wipLimit != null && wipLimit > 0 ? `${count}/${wipLimit}` : count}
    </span>
  )
}

function CardTile({
  card,
  onClick,
  isOverlay = false,
  focused = false,
}: {
  card: CardItem
  onClick?: () => void
  isOverlay?: boolean
  focused?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
    disabled: isOverlay,
  })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none' as const,
  }

  const isOverdue = card.dueDate && card.dueDate < Date.now()
  const formattedDueDate = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`p-3 bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-700 transition cursor-grab active:cursor-grabbing space-y-2 select-none ${
        isOverlay ? 'shadow-xl rotate-1 scale-105' : ''
      } ${focused && !isOverlay ? 'ring-2 ring-primary ring-offset-2' : ''}`}
    >
      <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-snug">
        {card.title || 'Untitled'}
      </div>

      {/* Meta tags & priority */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {card.priority && PRIORITY_BADGES[card.priority] && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              PRIORITY_BADGES[card.priority]!.class
            }`}
          >
            {PRIORITY_BADGES[card.priority]!.label}
          </span>
        )}

        {card.tags.map((tag) => (
          <span
            key={tag.id}
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: `${tag.color || '#64748b'}20`,
              color: tag.color || '#64748b',
            }}
          >
            #{tag.name}
          </span>
        ))}
      </div>

      {/* Footer: Due date, subtask progress & Assignees */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/40 text-[11px] text-neutral-400">
        <div className="flex items-center gap-2.5 min-w-0">
          {formattedDueDate ? (
            <div
              className={`flex items-center gap-1 ${
                isOverdue ? 'text-rose-500 font-medium' : ''
              }`}
            >
              <Calendar className="w-3 h-3" />
              <span>{formattedDueDate}</span>
            </div>
          ) : (
            <div />
          )}

          {(card.totalSubtasks ?? 0) > 0 && (
            <div
              className="flex items-center gap-1 font-medium"
              title={`${card.completedSubtasks ?? 0}/${card.totalSubtasks} subtasks done`}
            >
              <CheckSquare className="w-3 h-3" />
              <span className="tabular-nums">
                {card.completedSubtasks ?? 0}/{card.totalSubtasks}
              </span>
              <span className="w-8 h-1 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden inline-block">
                <span
                  className={`block h-full rounded-full ${
                    (card.completedSubtasks ?? 0) === card.totalSubtasks
                      ? 'bg-emerald-500'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: `${Math.round(
                      ((card.completedSubtasks ?? 0) / (card.totalSubtasks || 1)) * 100,
                    )}%`,
                  }}
                />
              </span>
            </div>
          )}
        </div>

        {card.assignees.length > 0 && (
          <div className="flex items-center -space-x-1.5">
            {card.assignees.map((a) => (
              <span
                key={a.userId}
                title={a.name}
                className="w-5 h-5 rounded-full bg-primary/20 text-primary border border-white dark:border-neutral-900 flex items-center justify-center text-[9px] font-semibold"
              >
                {a.name?.[0]?.toUpperCase() || 'U'}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ColumnComponent({
  column,
  boardId,
  projectId,
  focusedCardId,
  autoAdd,
  onAutoAddConsumed,
  onCardClick,
  onDeleteColumn,
  onRenameColumn,
  onSetWipLimit,
}: {
  column: ColumnItem
  boardId: string
  projectId: string
  focusedCardId: string | null
  autoAdd: boolean
  onAutoAddConsumed: () => void
  onCardClick: (cardId: string) => void
  onDeleteColumn: (columnId: string, cardCount: number) => void
  onRenameColumn: (columnId: string, currentName: string) => void
  onSetWipLimit: (columnId: string, wipLimit: number | null) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [columnName, setColumnName] = useState(column.name)
  const [isCollapsed, setIsCollapsed] = useState(false)

  // `C` hotkey: open the quick-add form for this column.
  useEffect(() => {
    if (autoAdd) {
      setIsAdding(true)
      onAutoAddConsumed()
    }
  }, [autoAdd])

  const cardIds = useMemo(() => column.cards.map((c) => c.id), [column.cards])

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isOver,
    isDragging,
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Collapsed: slender 40px vertical bar (title rotated, count pill, expand).
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`w-10 h-80 shrink-0 rounded-2xl border bg-neutral-100/60 dark:bg-neutral-900/40 flex flex-col items-center gap-3 py-3 transition-all duration-150 cursor-grab active:cursor-grabbing touch-none ${
          isDragging ? 'z-10 shadow-xl relative opacity-50' : ''
        } ${
          isOver
            ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
            : 'border-neutral-200/50 dark:border-neutral-800/50'
        }`}
        title={`${column.name} (click to expand)`}
        onDoubleClick={() => setIsCollapsed(false)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setIsCollapsed(false)
          }}
          aria-label="Expand column"
          className="p-1 rounded-lg text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span
          className="flex-1 min-h-0 overflow-hidden text-xs font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap cursor-pointer"
          style={{ writingMode: 'vertical-rl' }}
          onClick={() => setIsCollapsed(false)}
        >
          {column.name}
        </span>
        <CountPill count={column.cards.length} wipLimit={column.wipLimit} />
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-72 shrink-0 bg-neutral-100/60 dark:bg-neutral-900/40 rounded-2xl p-3 flex flex-col max-h-full border transition-all duration-150 ${
        isDragging ? 'z-10 shadow-xl relative' : ''
      } ${
        isOver
          ? 'border-primary/60 bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
          : 'border-neutral-200/50 dark:border-neutral-800/50'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 py-1.5 mb-2 relative">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {column.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: column.color }}
            />
          )}
          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onBlur={() => {
                if (columnName.trim() && columnName.trim() !== column.name) {
                  onRenameColumn(column.id, columnName.trim())
                } else {
                  setColumnName(column.name)
                }
                setIsEditingName(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
                if (e.key === 'Escape') {
                  setColumnName(column.name)
                  setIsEditingName(false)
                }
              }}
              className="text-sm font-semibold bg-white dark:bg-neutral-800 border border-primary px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-200 focus:outline-none w-full"
            />
          ) : (
            <h3
              onDoubleClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate cursor-pointer hover:opacity-80"
              title="Double-click to rename"
            >
              {column.name}
            </h3>
          )}
          <CountPill count={column.cards.length} wipLimit={column.wipLimit} />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse column"
            title="Collapse column"
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder column"
            title="Drag to reorder"
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false)
                    setColumnName(column.name)
                    setIsEditingName(true)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    const input = window.prompt(
                      'WIP limit (empty removes the limit):',
                      column.wipLimit != null && column.wipLimit > 0
                        ? String(column.wipLimit)
                        : '',
                    )
                    if (input === null) return
                    const trimmed = input.trim()
                    if (trimmed === '') {
                      onSetWipLimit(column.id, null)
                      return
                    }
                    const parsed = parseInt(trimmed, 10)
                    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 999) {
                      onSetWipLimit(column.id, parsed)
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>WIP limit…</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onDeleteColumn(column.id, column.cards.length)
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[60px]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              focused={card.id === focusedCardId}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>
        {column.cards.length === 0 && (
          <div
            className={`h-24 rounded-xl border border-dashed flex items-center justify-center text-xs font-medium transition-colors select-none ${
              isOver
                ? 'border-primary/60 text-primary bg-primary/5'
                : 'border-neutral-300 dark:border-neutral-700/60 text-neutral-400'
            }`}
          >
            Drop cards here
          </div>
        )}
      </div>

      {/* Add Card Bottom Button / Form */}
      <div className="mt-2 pt-1 border-t border-neutral-200/40 dark:border-neutral-800/40">
        {isAdding ? (
          <QuickAddCard
            boardId={boardId}
            columnId={column.id}
            projectId={projectId}
            onClose={() => setIsAdding(false)}
          />
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-1.5 px-2 rounded-xl text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add card</span>
          </button>
        )}
      </div>
    </div>
  )
}

export function KanbanView({
  boardId,
  projectId,
  columns,
  filteredColumns,
  isAddingColumn,
  setIsAddingColumn,
  onCardClick,
}: KanbanViewProps) {
  const moveCardMutation = useMoveCard()
  const moveColumnMutation = useMoveColumn()
  const createColumnMutation = useCreateColumn()
  const updateColumnMutation = useUpdateColumn()
  const deleteColumnMutation = useDeleteColumn()

  const [activeCard, setActiveCard] = useState<CardItem | null>(null)
  const [newColumnName, setNewColumnName] = useState('')

  // Keyboard-first navigation state (FEATURE_PLAN 2.4)
  const [peekCardId, setPeekCardId] = useState<string | null>(null)
  const [priorityCardId, setPriorityCardId] = useState<string | null>(null)
  const [assignCardId, setAssignCardId] = useState<string | null>(null)
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null)

  const anyModalOpen = peekCardId !== null || priorityCardId !== null || assignCardId !== null

  const findCard = (cardId: string): CardItem | undefined =>
    filteredColumns.flatMap((c) => c.cards).find((c) => c.id === cardId) ??
    columns.flatMap((c) => c.cards).find((c) => c.id === cardId)

  const columnOfCard = (cardId: string): string | undefined =>
    (filteredColumns.find((c) => c.cards.some((card) => card.id === cardId)) ??
      columns.find((c) => c.cards.some((card) => card.id === cardId)))?.name

  const { focusedCardId, setFocusedCardId } = useBoardKeyboardNav({
    columns: filteredColumns,
    enabled: !anyModalOpen,
    onOpenCard: onCardClick,
    onQuickPeek: (id) => setPeekCardId(id),
    onQuickAdd: (id) => setQuickAddColumnId(id),
    onPriority: (id) => setPriorityCardId(id),
    onAssign: (id) => setAssignCardId(id),
  })

  const handleCardClick = (cardId: string) => {
    setFocusedCardId(cardId)
    onCardClick(cardId)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const columnIds = useMemo(
    () => filteredColumns.map((c) => c.id),
    [filteredColumns],
  )

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    // When reordering columns, only consider columns as drop targets
    // (ignore cards nested inside them)
    if (args.active.data.current?.type === 'column') {
      const columnContainers = args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column',
      )
      const columnArgs = { ...args, droppableContainers: columnContainers }
      const columnPointer = pointerWithin(columnArgs)
      return columnPointer.length > 0 ? columnPointer : closestCorners(columnArgs)
    }

    // 1. First, check if pointer is within any droppable
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      // Prioritize card if pointer is directly over a card
      const cardCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'card',
      )
      if (cardCollision) {
        return [cardCollision]
      }
      // Otherwise prioritize column if pointer is over the column
      const columnCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'column',
      )
      if (columnCollision) {
        return [columnCollision]
      }
      return pointerCollisions
    }

    // 2. Fall back to closestCorners
    const cornerCollisions = closestCorners(args)
    if (cornerCollisions.length > 0) {
      const cardCollision = cornerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'card',
      )
      if (cardCollision) {
        return [cardCollision]
      }
      return cornerCollisions
    }

    return []
  }

  const celebrate = (event: DragEndEvent) => {
    const rect = event.active.rect.current.translated
    confetti({
      particleCount: 55,
      spread: 60,
      startVelocity: 26,
      scalar: 0.9,
      origin: rect
        ? {
            x: (rect.left + rect.width / 2) / window.innerWidth,
            y: (rect.top + rect.height / 2) / window.innerHeight,
          }
        : { x: 0.5, y: 0.5 },
    })
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const foundCard = columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === active.id)
    if (foundCard) {
      setActiveCard(foundCard)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // --- Column reorder: the column itself was dragged ---
    if (active.data.current?.type === 'column') {
      let overColId: string
      if (columns.some((c) => c.id === overId)) {
        overColId = overId
      } else if (over.data.current?.type === 'card') {
        // Collided with a card; reorder relative to its column
        overColId = over.data.current.columnId as string
      } else {
        return
      }
      if (overColId === activeId) return

      const activeIndex = columns.findIndex((c) => c.id === activeId)
      const overIndex = columns.findIndex((c) => c.id === overColId)
      if (activeIndex === -1 || overIndex === -1) return

      // Dragged right -> land after the target column;
      // dragged left -> land before it (i.e. after its predecessor)
      const afterId =
        activeIndex < overIndex
          ? overColId
          : (columns[overIndex - 1]?.id ?? null)
      if (afterId === activeId) return

      moveColumnMutation.mutate({ boardId, columnId: activeId, afterId })
      return
    }

    // 1. Find active card and its current column
    let sourceCol: ColumnItem | undefined
    for (const col of columns) {
      if (col.cards.some((c) => c.id === activeId)) {
        sourceCol = col
        break
      }
    }
    if (!sourceCol) return

    // 2. Find destination column: either over a column directly or over another card
    let destCol = columns.find((c) => c.id === overId)
    const isOverColumn = Boolean(destCol)

    if (!destCol) {
      // overId is a card id; find which column contains it
      destCol = columns.find((c) => c.cards.some((c) => c.id === overId))
    }
    if (!destCol) return

    // 3. Compute target otherCards (cards in destination column excluding activeCard)
    const targetCards = destCol.cards.filter((c) => c.id !== activeId)
    let afterId: string | null

    if (isOverColumn) {
      // Dropped on the column itself (e.g. empty column or empty bottom area)
      if (targetCards.length === 0) {
        afterId = null
      } else {
        // Append to the bottom of the column
        afterId = targetCards[targetCards.length - 1]!.id
      }
    } else {
      // Dropped onto a specific card (overId)
      const overIndex = targetCards.findIndex((c) => c.id === overId)

      if (sourceCol.id === destCol.id) {
        // Reordering within the SAME column
        const sourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId)
        const rawOverIndex = sourceCol.cards.findIndex((c) => c.id === overId)

        if (sourceIndex === rawOverIndex) {
          return
        }

        if (sourceIndex < rawOverIndex) {
          // Dragged downward past overId -> place AFTER overId
          afterId = overId
        } else {
          // Dragged upward before overId -> place BEFORE overId
          afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null
        }
      } else {
        // Dragging into a DIFFERENT column (stage)
        const overRect = event.over?.rect
        const activeRect = event.active.rect.current.translated

        let isBelow = false
        if (overRect && activeRect) {
          const overMidY = overRect.top + overRect.height / 2
          const activeMidY = activeRect.top + activeRect.height / 2
          isBelow = activeMidY > overMidY
        }

        if (isBelow) {
          afterId = overId
        } else {
          afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null
        }
      }
    }

    // 4. Skip mutation if position didn't change in the same column
    if (sourceCol.id === destCol.id) {
      const currentSourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId)
      const currentPredecessorId =
        currentSourceIndex > 0 ? sourceCol.cards[currentSourceIndex - 1]!.id : null
      if (afterId === currentPredecessorId) {
        return
      }
    }

    // 5. Execute move mutation
    moveCardMutation.mutate({
      cardId: activeId,
      boardId,
      columnId: destCol.id,
      afterId,
    })

    // 6. Drop landed in a completion column? Small celebratory burst.
    if (COMPLETED_COLUMN_RE.test(destCol.name)) {
      celebrate(event)
    }
  }

  const handleRenameColumn = (columnId: string, currentName: string) => {
    if (currentName?.trim()) {
      updateColumnMutation.mutate({
        boardId,
        columnId,
        name: currentName.trim(),
      })
    }
  }

  const handleSetWipLimit = (columnId: string, wipLimit: number | null) => {
    updateColumnMutation.mutate({ boardId, columnId, wipLimit })
  }

  const handleDeleteColumn = (columnId: string, cardCount: number) => {
    if (cardCount > 0) {
      const otherCols = columns.filter((c) => c.id !== columnId)
      if (otherCols.length === 0) {
        window.alert('Cannot delete the only column when it has cards.')
        return
      }
      const destNames = otherCols.map((c, i) => `${i + 1}: ${c.name}`).join('\n')
      const choice = window.prompt(
        `This column has ${cardCount} cards. Select a column number to move them to:\n${destNames}`,
        '1',
      )
      if (!choice) return
      const chosenIdx = parseInt(choice, 10) - 1
      const chosenCol = otherCols[chosenIdx]
      if (!chosenCol) {
        window.alert('Invalid selection')
        return
      }
      deleteColumnMutation.mutate(
        { boardId, columnId, moveTo: chosenCol.id },
        {
          onSuccess: () =>
            toast.success(`Column deleted — ${cardCount} cards moved to ${chosenCol.name}`),
        },
      )
    } else {
      if (window.confirm('Delete this column?')) {
        deleteColumnMutation.mutate(
          { boardId, columnId },
          { onSuccess: () => toast.success('Column deleted') },
        )
      }
    }
  }

  const handleCreateColumn = async () => {
    const trimmed = newColumnName.trim()
    if (!trimmed || createColumnMutation.isPending) return
    try {
      await createColumnMutation.mutateAsync({
        boardId,
        name: trimmed,
      })
      setNewColumnName('')
      setIsAddingColumn(false)
    } catch (err: any) {
      window.alert(err.message || 'Failed to create column')
    }
  }

  const peekCard = peekCardId ? findCard(peekCardId) : undefined
  const priorityCard = priorityCardId ? findCard(priorityCardId) : undefined
  const assignCard = assignCardId ? findCard(assignCardId) : undefined

  return (
    <>
      {/* Columns Container (Horizontal Scroll) */}
      <div className="flex-1 overflow-x-auto p-6 flex items-start gap-4">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            {filteredColumns.map((column) => (
              <ColumnComponent
                key={column.id}
                column={column}
                boardId={boardId}
                projectId={projectId}
                focusedCardId={focusedCardId}
                autoAdd={quickAddColumnId === column.id}
                onAutoAddConsumed={() => setQuickAddColumnId(null)}
                onCardClick={handleCardClick}
                onDeleteColumn={handleDeleteColumn}
                onRenameColumn={handleRenameColumn}
                onSetWipLimit={handleSetWipLimit}
              />
            ))}
          </SortableContext>

          <DragOverlay>
            {activeCard ? <CardTile card={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>

        {/* Add Column Button & Inline Card on the Kanban Board */}
        {isAddingColumn ? (
          <div className="w-72 shrink-0 bg-neutral-100/70 dark:bg-neutral-900/50 rounded-2xl p-3 flex flex-col gap-2.5 border border-primary/40 shadow-xs">
            <input
              type="text"
              autoFocus
              placeholder="Column name…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateColumn()
                }
                if (e.key === 'Escape') {
                  setIsAddingColumn(false)
                  setNewColumnName('')
                }
              }}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 focus:outline-none focus:border-primary text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateColumn}
                disabled={!newColumnName.trim() || createColumnMutation.isPending}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary text-white hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createColumnMutation.isPending ? 'Adding…' : 'Add Column'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(false)
                  setNewColumnName('')
                }}
                className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingColumn(true)}
            className="w-72 shrink-0 h-12 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700/60 hover:border-primary/60 dark:hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/10 text-xs font-semibold text-neutral-500 hover:text-primary transition flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            <span>Add Column</span>
          </button>
        )}
      </div>

      {/* Keyboard quick modals (Space / P / M) */}
      {peekCard && (
        <QuickPeekModal
          card={peekCard}
          columnName={columnOfCard(peekCard.id)}
          onClose={() => setPeekCardId(null)}
        />
      )}
      {priorityCard && (
        <PriorityPickerModal
          card={priorityCard}
          boardId={boardId}
          onClose={() => setPriorityCardId(null)}
        />
      )}
      {assignCard && (
        <AssignPickerModal
          card={assignCard}
          boardId={boardId}
          onClose={() => setAssignCardId(null)}
        />
      )}
    </>
  )
}
