import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Calendar,
  MoreHorizontal,
  Plus,
  Trash2,
  Edit2,
} from 'lucide-react'
import {
  useBoard,
  useCreateColumn,
  useDeleteBoard,
  useDeleteColumn,
  useMoveCard,
  useUpdateBoard,
  useUpdateColumn,
} from '../../lib/queries'
import { CardPanel } from './CardPanel'
import { QuickAddCard } from './QuickAddCard'
import { useNavigate } from '@tanstack/react-router'

interface BoardViewProps {
  boardId: string
  projectId: string
}

interface CardItem {
  id: string
  columnId: string
  notepadId: string
  title: string
  position: string
  priority?: 'low' | 'medium' | 'high' | 'urgent' | null
  dueDate?: number | null
  assignees: Array<{ userId: string; name: string; image?: string | null }>
  tags: Array<{ id: string; name: string; color?: string | null }>
}

interface ColumnItem {
  id: string
  name: string
  color?: string | null
  position: string
  cards: CardItem[]
}

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  medium: { label: 'Medium', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  high: { label: 'High', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  urgent: { label: 'Urgent', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
}

function CardTile({
  card,
  onClick,
  isOverlay = false,
}: {
  card: CardItem
  onClick?: () => void
  isOverlay?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: { type: 'card', card },
  })

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
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
      }`}
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

      {/* Footer: Due date & Assignees */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/40 text-[11px] text-neutral-400">
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
  onCardClick,
  onDeleteColumn,
  onRenameColumn,
}: {
  column: ColumnItem
  boardId: string
  projectId: string
  onCardClick: (cardId: string) => void
  onDeleteColumn: (columnId: string, cardCount: number) => void
  onRenameColumn: (columnId: string, currentName: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  const cardIds = useMemo(() => column.cards.map((c) => c.id), [column.cards])

  return (
    <div className="w-72 shrink-0 bg-neutral-100/60 dark:bg-neutral-900/40 rounded-2xl p-3 flex flex-col max-h-full border border-neutral-200/50 dark:border-neutral-800/50">
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 py-1.5 mb-2 relative">
        <div className="flex items-center gap-2">
          {column.color && (
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: column.color }}
            />
          )}
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {column.name}
          </h3>
          <span className="text-xs px-1.5 py-0.2 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 font-medium">
            {column.cards.length}
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-neutral-200 dark:border-neutral-800 p-1 z-20 text-xs">
              <button
                onClick={() => {
                  setShowMenu(false)
                  onRenameColumn(column.id, column.name)
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Rename</span>
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

      {/* Cards Scroll Container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[50px]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>
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

export function BoardView({ boardId, projectId }: BoardViewProps) {
  const navigate = useNavigate()
  const { data: board, isLoading } = useBoard(boardId)
  const moveCardMutation = useMoveCard()
  const createColumnMutation = useCreateColumn()
  const updateColumnMutation = useUpdateColumn()
  const deleteColumnMutation = useDeleteColumn()
  const updateBoardMutation = useUpdateBoard()
  const deleteBoardMutation = useDeleteBoard()

  const [activeCard, setActiveCard] = useState<CardItem | null>(null)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isEditingBoardName, setIsEditingBoardName] = useState(false)
  const [boardName, setBoardName] = useState('')

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

  if (isLoading || !board) {
    return (
      <div className="p-8 flex items-center justify-center text-sm text-neutral-400">
        Loading board…
      </div>
    )
  }

  const columns: ColumnItem[] = board.columns || []

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

    // Find active card and its current column
    let sourceCol: ColumnItem | undefined
    let activeCardItem: CardItem | undefined
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === activeId)
      if (card) {
        sourceCol = col
        activeCardItem = card
        break
      }
    }
    if (!sourceCol || !activeCardItem) return

    // Find destination column: either over a column directly or over another card
    let destCol = columns.find((c) => c.id === overId)
    let afterId: string | null = null

    if (!destCol) {
      // Over another card
      for (const col of columns) {
        const idx = col.cards.findIndex((c) => c.id === overId)
        if (idx !== -1) {
          destCol = col
          // Position after previous sibling
          afterId = idx > 0 ? col.cards[idx - 1]!.id : null
          break
        }
      }
    }

    if (!destCol) return

    if (sourceCol.id !== destCol.id || activeId !== overId) {
      moveCardMutation.mutate({
        cardId: activeId,
        boardId,
        columnId: destCol.id,
        afterId,
      })
    }
  }

  const handleAddColumn = () => {
    const name = window.prompt('Column name:', 'New Column')
    if (name?.trim()) {
      createColumnMutation.mutate({
        boardId,
        name: name.trim(),
      })
    }
  }

  const handleRenameColumn = (columnId: string, currentName: string) => {
    const name = window.prompt('Rename column:', currentName)
    if (name?.trim() && name.trim() !== currentName) {
      updateColumnMutation.mutate({
        boardId,
        columnId,
        name: name.trim(),
      })
    }
  }

  const handleDeleteColumn = (columnId: string, cardCount: number) => {
    if (cardCount > 0) {
      const otherCols = columns.filter((c) => c.id !== columnId)
      if (otherCols.length === 0) {
        alert('Cannot delete the only column when it has cards.')
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
        alert('Invalid selection')
        return
      }
      deleteColumnMutation.mutate({
        boardId,
        columnId,
        moveTo: chosenCol.id,
      })
    } else {
      if (window.confirm('Delete this column?')) {
        deleteColumnMutation.mutate({ boardId, columnId })
      }
    }
  }


  const handleBoardNameSave = () => {
    if (boardName.trim() && boardName !== board.name) {
      updateBoardMutation.mutate({
        boardId,
        name: boardName.trim(),
      })
    }
    setIsEditingBoardName(false)
  }

  const handleDeleteBoard = () => {
    if (window.confirm('Move this board to Trash?')) {
      deleteBoardMutation.mutate(boardId, {
        onSuccess: () => {
          navigate({ to: `/p/${projectId}` })
        },
      })
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-neutral-50/40 dark:bg-neutral-950/40">
      {/* Board Header Bar */}
      <div className="p-4 px-6 border-b border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between gap-4 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{board.icon || '📋'}</span>
          {isEditingBoardName ? (
            <input
              type="text"
              autoFocus
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onBlur={handleBoardNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBoardNameSave()
                if (e.key === 'Escape') setIsEditingBoardName(false)
              }}
              className="text-xl font-bold bg-transparent border-b border-primary focus:outline-none"
            />
          ) : (
            <h1
              onClick={() => {
                setBoardName(board.name)
                setIsEditingBoardName(true)
              }}
              className="text-xl font-bold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:opacity-80"
              title="Click to rename"
            >
              {board.name}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddColumn}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Column</span>
          </button>
          <button
            onClick={handleDeleteBoard}
            title="Delete Board"
            className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columns Container (Horizontal Scroll) */}
      <div className="flex-1 overflow-x-auto p-6 flex items-start gap-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {columns.map((column) => (
            <ColumnComponent
              key={column.id}
              column={column}
              boardId={boardId}
              projectId={projectId}
              onCardClick={(id) => setSelectedCardId(id)}
              onDeleteColumn={handleDeleteColumn}
              onRenameColumn={handleRenameColumn}
            />
          ))}

          <DragOverlay>
            {activeCard ? <CardTile card={activeCard} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Selected Card Side Panel */}
      {selectedCardId && (
        <CardPanel
          cardId={selectedCardId}
          boardId={boardId}
          projectId={projectId}
          columns={columns.map((c) => ({ id: c.id, name: c.name }))}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  )
}
