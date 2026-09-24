import { useEffect, useMemo, useState } from 'react';
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
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toast } from 'sonner';
import {
  useCreateColumn,
  useDeleteColumn,
  useMoveCard,
  useMoveColumn,
  useUpdateColumn,
} from '../../../lib/queries';
import { QuickAddCard } from '../QuickAddCard';
import { useBoardKeyboardNav } from '../useBoardKeyboardNav';
import { Avatar, AvatarGroup } from '../../ui/Avatar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { StatusDiamond } from '../../ui/StatusDiamond';
import { priorityBadgeTone } from '../../ui/status';
import { AssignPickerModal, PriorityPickerModal, QuickPeekModal } from './BoardQuickModals';
import { COMPLETED_COLUMN_RE, PRIORITY_BADGES, type CardItem, type ColumnItem } from './types';

interface KanbanViewProps {
  boardId: string;
  projectId: string;
  /** Unfiltered columns (drag math + menus keep working while filters hide cards). */
  columns: ColumnItem[];
  /** Filtered columns (what is rendered). */
  filteredColumns: ColumnItem[];
  isAddingColumn: boolean;
  setIsAddingColumn: (v: boolean) => void;
  onCardClick: (cardId: string) => void;
}

/** Priority → Basalt status token for the 4px left-edge bar. */
function priorityStatusColor(priority?: string | null): string {
  switch (priority) {
    case 'urgent':
      return 'var(--danger)';
    case 'high':
      return 'var(--c2)';
    case 'medium':
      return 'var(--c3)';
    case 'low':
      return 'var(--c4)';
    default:
      return 'var(--c1)';
  }
}

/** Card count vs. WIP limit; turns danger when the limit is exceeded. */
function CountPill({ count, wipLimit }: { count: number; wipLimit?: number | null }) {
  const over = wipLimit != null && wipLimit > 0 && count > wipLimit;
  return (
    <Badge
      tone={over ? 'danger' : 'neutral'}
      title={wipLimit != null && wipLimit > 0 ? `${count} of ${wipLimit} WIP limit` : undefined}
    >
      {wipLimit != null && wipLimit > 0 ? `${count}/${wipLimit}` : count}
    </Badge>
  );
}

function CardTile({
  card,
  statusColor,
  onClick,
  isOverlay = false,
  focused = false,
}: {
  card: CardItem;
  statusColor?: string | null;
  onClick?: () => void;
  isOverlay?: boolean;
  focused?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
    disabled: isOverlay,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: 'none' as const,
  };

  const isOverdue = card.dueDate && card.dueDate < Date.now();
  const formattedDueDate = card.dueDate
    ? new Date(card.dueDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card
      ref={setNodeRef}
      statusColor={statusColor || priorityStatusColor(card.priority)}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`p-3 pl-4 cursor-grab active:cursor-grabbing space-y-2 select-none ${
        isOverlay ? 'rotate-1 scale-105' : ''
      } ${focused && !isOverlay ? 'outline-2 outline-[var(--accent)] outline-offset-2' : ''}`}
    >
      <div className="text-sm font-medium text-[var(--text)] leading-snug">
        {card.title || 'Untitled'}
      </div>

      {/* Meta tags & priority */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {card.priority && PRIORITY_BADGES[card.priority] && (
          <Badge tone={priorityBadgeTone(card.priority)}>
            {PRIORITY_BADGES[card.priority]!.label}
          </Badge>
        )}

        {(card.tags || []).map((tag) => (
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

      {/* Footer: Due date, subtask progress & Assignees */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--hair)] text-[11px] text-[var(--muted)]">
        <div className="flex items-center gap-2.5 min-w-0">
          {formattedDueDate ? (
            <div
              className={`flex items-center gap-1 ${
                isOverdue ? 'text-[var(--danger)] font-medium' : ''
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
              <span className="w-8 h-1 bg-[var(--surface2)] overflow-hidden inline-block">
                <span
                  className="block h-full bg-[var(--accent)]"
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

        {(card.assignees || []).length > 0 && (
          <AvatarGroup max={8}>
            {(card.assignees || []).map((a) => (
              <Avatar key={a.userId} name={a.name || 'U'} size="xs" title={a.name} />
            ))}
          </AvatarGroup>
        )}
      </div>
    </Card>
  );
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
  column: ColumnItem;
  boardId: string;
  projectId: string;
  focusedCardId: string | null;
  autoAdd: boolean;
  onAutoAddConsumed: () => void;
  onCardClick: (cardId: string) => void;
  onDeleteColumn: (columnId: string, cardCount: number) => void;
  onRenameColumn: (columnId: string, currentName: string) => void;
  onSetWipLimit: (columnId: string, wipLimit: number | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [columnName, setColumnName] = useState(column.name);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // `C` hotkey: open the quick-add form for this column.
  useEffect(() => {
    if (autoAdd) {
      setIsAdding(true);
      onAutoAddConsumed();
    }
  }, [autoAdd]);

  const cardIds = useMemo(() => column.cards.map((c) => c.id), [column.cards]);

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
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Collapsed: slender 40px vertical bar (title rotated, count pill, expand).
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`chamfer-lg w-10 h-80 shrink-0 snap-start border bg-[var(--surface2)] flex flex-col items-center gap-3 py-3 transition-all duration-150 cursor-grab active:cursor-grabbing touch-none ${
          isDragging ? 'z-10 relative opacity-50' : ''
        } ${isOver ? 'border-[var(--accent)] bg-[var(--hi)]' : 'border-[var(--line)]'}`}
        title={`${column.name} (click to expand)`}
        onDoubleClick={() => setIsCollapsed(false)}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(false);
          }}
          aria-label="Expand column"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span
          className="flex-1 min-h-0 overflow-hidden text-xs font-semibold text-[var(--text)] whitespace-nowrap cursor-pointer uppercase tracking-wider"
          style={{
            writingMode: 'vertical-rl',
            fontFamily: 'Archivo, sans-serif',
            fontVariationSettings: "'wdth' 122, 'wght' 800",
          }}
          onClick={() => setIsCollapsed(false)}
        >
          {column.name}
        </span>
        <CountPill count={column.cards.length} wipLimit={column.wipLimit} />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`chamfer-lg w-72 md:w-72 w-[85vw] max-w-72 shrink-0 snap-start self-start bg-[var(--surface2)] p-3 flex flex-col border transition-all duration-150 ${
        isDragging ? 'z-10 relative' : ''
      } ${isOver ? 'border-[var(--accent)] bg-[var(--hi)]' : 'border-[var(--line)]'}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-1.5 mb-2 relative">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <StatusDiamond color={column.color || 'var(--c1)'} size={9} />
          {isEditingName ? (
            <Input
              autoFocus
              type="text"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              onBlur={() => {
                if (columnName.trim() && columnName.trim() !== column.name) {
                  onRenameColumn(column.id, columnName.trim());
                } else {
                  setColumnName(column.name);
                }
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  setColumnName(column.name);
                  setIsEditingName(false);
                }
              }}
            />
          ) : (
            <h3
              onDoubleClick={() => setIsEditingName(true)}
              className="text-sm text-[var(--text)] truncate cursor-pointer hover:opacity-80 uppercase tracking-wider"
              style={{
                fontFamily: 'Archivo, sans-serif',
                fontVariationSettings: "'wdth' 122, 'wght' 800",
              }}
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
            className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center hover:bg-[var(--hi)] text-[var(--muted)] hover:text-[var(--text)]"
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
            className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center hover:bg-[var(--hi)] text-[var(--muted)] hover:text-[var(--text)] cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Column menu"
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 md:p-1 flex items-center justify-center hover:bg-[var(--hi)] text-[var(--muted)] hover:text-[var(--text)]"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--surface)] border border-[var(--line)] p-1 z-20 text-xs">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setColumnName(column.name);
                    setIsEditingName(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[var(--text)] hover:bg-[var(--hi)]"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    const input = window.prompt(
                      'WIP limit (empty removes the limit):',
                      column.wipLimit != null && column.wipLimit > 0 ? String(column.wipLimit) : '',
                    );
                    if (input === null) return;
                    const trimmed = input.trim();
                    if (trimmed === '') {
                      onSetWipLimit(column.id, null);
                      return;
                    }
                    const parsed = parseInt(trimmed, 10);
                    if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 999) {
                      onSetWipLimit(column.id, parsed);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[var(--text)] hover:bg-[var(--hi)]"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>WIP limit…</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteColumn(column.id, column.cards.length);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 min-h-[44px] md:min-h-0 text-[var(--danger)] hover:bg-[var(--hi)]"
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
      <div className="space-y-2 pr-1 min-h-[60px]">
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <CardTile
              key={card.id}
              card={card}
              statusColor={column.color || priorityStatusColor(card.priority)}
              focused={card.id === focusedCardId}
              onClick={() => onCardClick(card.id)}
            />
          ))}
        </SortableContext>
        {column.cards.length === 0 && (
          <div
            className={`h-24 border border-dashed flex items-center justify-center text-xs font-medium transition-colors select-none ${
              isOver
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--hi)]'
                : 'border-[var(--line)] text-[var(--muted)]'
            }`}
          >
            Drop cards here
          </div>
        )}
      </div>

      {/* Add Card Bottom Button / Form */}
      <div className="mt-2 pt-1 border-t border-[var(--hair)]">
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
            className="w-full py-1.5 px-2 min-h-[44px] text-xs font-medium text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--hi)] transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add card</span>
          </button>
        )}
      </div>
    </div>
  );
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
  const moveCardMutation = useMoveCard();
  const moveColumnMutation = useMoveColumn();
  const createColumnMutation = useCreateColumn();
  const updateColumnMutation = useUpdateColumn();
  const deleteColumnMutation = useDeleteColumn();

  const [activeCard, setActiveCard] = useState<CardItem | null>(null);
  const [newColumnName, setNewColumnName] = useState('');

  // Keyboard-first navigation state (FEATURE_PLAN 2.4)
  const [peekCardId, setPeekCardId] = useState<string | null>(null);
  const [priorityCardId, setPriorityCardId] = useState<string | null>(null);
  const [assignCardId, setAssignCardId] = useState<string | null>(null);
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);

  const anyModalOpen = peekCardId !== null || priorityCardId !== null || assignCardId !== null;

  const findCard = (cardId: string): CardItem | undefined =>
    filteredColumns.flatMap((c) => c.cards).find((c) => c.id === cardId) ??
    columns.flatMap((c) => c.cards).find((c) => c.id === cardId);

  const columnOfCard = (cardId: string): string | undefined =>
    (
      filteredColumns.find((c) => c.cards.some((card) => card.id === cardId)) ??
      columns.find((c) => c.cards.some((card) => card.id === cardId))
    )?.name;

  const { focusedCardId, setFocusedCardId } = useBoardKeyboardNav({
    columns: filteredColumns,
    enabled: !anyModalOpen,
    onOpenCard: onCardClick,
    onQuickPeek: (id) => setPeekCardId(id),
    onQuickAdd: (id) => setQuickAddColumnId(id),
    onPriority: (id) => setPriorityCardId(id),
    onAssign: (id) => setAssignCardId(id),
  });

  const handleCardClick = (cardId: string) => {
    setFocusedCardId(cardId);
    onCardClick(cardId);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const columnIds = useMemo(() => filteredColumns.map((c) => c.id), [filteredColumns]);

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    // When reordering columns, only consider columns as drop targets
    // (ignore cards nested inside them)
    if (args.active.data.current?.type === 'column') {
      const columnContainers = args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column',
      );
      const columnArgs = { ...args, droppableContainers: columnContainers };
      const columnPointer = pointerWithin(columnArgs);
      return columnPointer.length > 0 ? columnPointer : closestCorners(columnArgs);
    }

    // 1. First, check if pointer is within any droppable
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      // Prioritize card if pointer is directly over a card
      const cardCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'card',
      );
      if (cardCollision) {
        return [cardCollision];
      }
      // Otherwise prioritize column if pointer is over the column
      const columnCollision = pointerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'column',
      );
      if (columnCollision) {
        return [columnCollision];
      }
      return pointerCollisions;
    }

    // 2. Fall back to closestCorners
    const cornerCollisions = closestCorners(args);
    if (cornerCollisions.length > 0) {
      const cardCollision = cornerCollisions.find(
        (c) => c.data?.droppableContainer?.data?.current?.type === 'card',
      );
      if (cardCollision) {
        return [cardCollision];
      }
      return cornerCollisions;
    }

    return [];
  };

  const celebrate = (event: DragEndEvent) => {
    const rect = event.active.rect.current.translated;
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
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const foundCard = columns.flatMap((c) => c.cards).find((c) => c.id === active.id);
    if (foundCard) {
      setActiveCard(foundCard);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // --- Column reorder: the column itself was dragged ---
    if (active.data.current?.type === 'column') {
      let overColId: string;
      if (columns.some((c) => c.id === overId)) {
        overColId = overId;
      } else if (over.data.current?.type === 'card') {
        // Collided with a card; reorder relative to its column
        overColId = over.data.current.columnId as string;
      } else {
        return;
      }
      if (overColId === activeId) return;

      const activeIndex = columns.findIndex((c) => c.id === activeId);
      const overIndex = columns.findIndex((c) => c.id === overColId);
      if (activeIndex === -1 || overIndex === -1) return;

      // Dragged right -> land after the target column;
      // dragged left -> land before it (i.e. after its predecessor)
      const afterId = activeIndex < overIndex ? overColId : (columns[overIndex - 1]?.id ?? null);
      if (afterId === activeId) return;

      moveColumnMutation.mutate({ boardId, columnId: activeId, afterId });
      return;
    }

    // 1. Find active card and its current column
    let sourceCol: ColumnItem | undefined;
    for (const col of columns) {
      if (col.cards.some((c) => c.id === activeId)) {
        sourceCol = col;
        break;
      }
    }
    if (!sourceCol) return;

    // 2. Find destination column: either over a column directly or over another card
    let destCol = columns.find((c) => c.id === overId);
    const isOverColumn = Boolean(destCol);

    if (!destCol) {
      // overId is a card id; find which column contains it
      destCol = columns.find((c) => c.cards.some((c) => c.id === overId));
    }
    if (!destCol) return;

    // 3. Compute target otherCards (cards in destination column excluding activeCard)
    const targetCards = destCol.cards.filter((c) => c.id !== activeId);
    let afterId: string | null;

    if (isOverColumn) {
      // Dropped on the column itself (e.g. empty column or empty bottom area)
      if (targetCards.length === 0) {
        afterId = null;
      } else {
        // Append to the bottom of the column
        afterId = targetCards[targetCards.length - 1]!.id;
      }
    } else {
      // Dropped onto a specific card (overId)
      const overIndex = targetCards.findIndex((c) => c.id === overId);

      if (sourceCol.id === destCol.id) {
        // Reordering within the SAME column
        const sourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId);
        const rawOverIndex = sourceCol.cards.findIndex((c) => c.id === overId);

        if (sourceIndex === rawOverIndex) {
          return;
        }

        if (sourceIndex < rawOverIndex) {
          // Dragged downward past overId -> place AFTER overId
          afterId = overId;
        } else {
          // Dragged upward before overId -> place BEFORE overId
          afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null;
        }
      } else {
        // Dragging into a DIFFERENT column (stage)
        const overRect = event.over?.rect;
        const activeRect = event.active.rect.current.translated;

        let isBelow = false;
        if (overRect && activeRect) {
          const overMidY = overRect.top + overRect.height / 2;
          const activeMidY = activeRect.top + activeRect.height / 2;
          isBelow = activeMidY > overMidY;
        }

        if (isBelow) {
          afterId = overId;
        } else {
          afterId = overIndex > 0 ? targetCards[overIndex - 1]!.id : null;
        }
      }
    }

    // 4. Skip mutation if position didn't change in the same column
    if (sourceCol.id === destCol.id) {
      const currentSourceIndex = sourceCol.cards.findIndex((c) => c.id === activeId);
      const currentPredecessorId =
        currentSourceIndex > 0 ? sourceCol.cards[currentSourceIndex - 1]!.id : null;
      if (afterId === currentPredecessorId) {
        return;
      }
    }

    // 5. Execute move mutation
    moveCardMutation.mutate({
      cardId: activeId,
      boardId,
      columnId: destCol.id,
      afterId,
    });

    // 6. Drop landed in a completion column? Small celebratory burst.
    if (COMPLETED_COLUMN_RE.test(destCol.name)) {
      celebrate(event);
    }
  };

  const handleRenameColumn = (columnId: string, currentName: string) => {
    if (currentName?.trim()) {
      updateColumnMutation.mutate({
        boardId,
        columnId,
        name: currentName.trim(),
      });
    }
  };

  const handleSetWipLimit = (columnId: string, wipLimit: number | null) => {
    updateColumnMutation.mutate({ boardId, columnId, wipLimit });
  };

  const handleDeleteColumn = (columnId: string, cardCount: number) => {
    if (cardCount > 0) {
      const otherCols = columns.filter((c) => c.id !== columnId);
      if (otherCols.length === 0) {
        window.alert('Cannot delete the only column when it has cards.');
        return;
      }
      const destNames = otherCols.map((c, i) => `${i + 1}: ${c.name}`).join('\n');
      const choice = window.prompt(
        `This column has ${cardCount} cards. Select a column number to move them to:\n${destNames}`,
        '1',
      );
      if (!choice) return;
      const chosenIdx = parseInt(choice, 10) - 1;
      const chosenCol = otherCols[chosenIdx];
      if (!chosenCol) {
        window.alert('Invalid selection');
        return;
      }
      deleteColumnMutation.mutate(
        { boardId, columnId, moveTo: chosenCol.id },
        {
          onSuccess: () =>
            toast.success(`Column deleted — ${cardCount} cards moved to ${chosenCol.name}`),
        },
      );
    } else {
      if (window.confirm('Delete this column?')) {
        deleteColumnMutation.mutate(
          { boardId, columnId },
          { onSuccess: () => toast.success('Column deleted') },
        );
      }
    }
  };

  const handleCreateColumn = async () => {
    const trimmed = newColumnName.trim();
    if (!trimmed || createColumnMutation.isPending) return;
    try {
      await createColumnMutation.mutateAsync({
        boardId,
        name: trimmed,
      });
      setNewColumnName('');
      setIsAddingColumn(false);
    } catch (err: any) {
      window.alert(err.message || 'Failed to create column');
    }
  };

  const peekCard = peekCardId ? findCard(peekCardId) : undefined;
  const priorityCard = priorityCardId ? findCard(priorityCardId) : undefined;
  const assignCard = assignCardId ? findCard(assignCardId) : undefined;

  const activeCardColumn = activeCard
    ? (columns.find((c) => c.cards.some((cc) => cc.id === activeCard.id))?.color ?? null)
    : null;

  return (
    <>
      {/* Columns Container (Horizontal Scroll with mobile snap) */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-6 flex items-start gap-4 snap-x snap-mandatory md:snap-none bg-[var(--bg)] min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
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
            {activeCard ? (
              <CardTile card={activeCard} statusColor={activeCardColumn} isOverlay />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Add Column Button & Inline Card on the Kanban Board */}
        {isAddingColumn ? (
          <Card className="w-[85vw] max-w-72 md:w-72 shrink-0 snap-start bg-[var(--surface2)] p-3 flex flex-col gap-2.5 border-[var(--accent)]">
            <Input
              autoFocus
              type="text"
              placeholder="Column name…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateColumn();
                }
                if (e.key === 'Escape') {
                  setIsAddingColumn(false);
                  setNewColumnName('');
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateColumn}
                disabled={!newColumnName.trim() || createColumnMutation.isPending}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createColumnMutation.isPending ? 'Adding…' : 'Add Column'}</span>
              </Button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnName('');
                }}
                aria-label="Cancel"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-[var(--hi)] text-[var(--muted)] hover:text-[var(--text)] transition cursor-pointer"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingColumn(true)}
            className="w-[85vw] max-w-72 md:w-72 shrink-0 snap-start h-12 min-h-[44px] border-2 border-dashed border-[var(--line)] hover:border-[var(--accent)] hover:bg-[var(--hi)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--accent)] transition flex items-center justify-center gap-2 cursor-pointer select-none"
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
  );
}
