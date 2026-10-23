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
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Input } from '../../ui/Input';
import { PromptDialog } from '../../ui/PromptDialog';
import { StatusDiamond } from '../../ui/StatusDiamond';
import { priorityBadgeTone } from '../../ui/status';
import { AssignPickerModal, PriorityPickerModal, QuickPeekModal } from './BoardQuickModals';
import { COMPLETED_COLUMN_RE, PRIORITY_BADGES, type CardItem, type ColumnItem } from './types';
import { computeCardDropTarget, computeColumnDropTarget } from '../kanbanReorder';

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
    <span
      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border shrink-0 ${
        over
          ? 'bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/30'
          : 'bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--hair)]'
      }`}
      title={wipLimit != null && wipLimit > 0 ? `${count} of ${wipLimit} WIP limit` : undefined}
    >
      {wipLimit != null && wipLimit > 0 ? `${count}/${wipLimit}` : count}
    </span>
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

  // Prioritize card priority color for the left accent stripe so it matches the priority badge;
  // fall back to column status color only when no priority is set.
  const activeStatus = card.priority ? priorityStatusColor(card.priority) : statusColor || undefined;

  return (
    <Card
      ref={setNodeRef}
      statusColor={activeStatus}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group/card p-3 pl-3.5 bg-[var(--surface)] border border-[var(--line)] hover:border-[var(--muted)]/50 hover:bg-[var(--hi)]/20 transition-all cursor-grab active:cursor-grabbing space-y-2 select-none theme-radius-md ${
        isOverlay ? 'rotate-1 scale-105 z-50' : ''
      } ${focused && !isOverlay ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]' : ''}`}
    >
      {/* Header Row: Title on Left, Priority on Top-Right */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="text-[13px] font-semibold text-[var(--text)] leading-snug tracking-tight group-hover/card:text-[var(--accent)] transition-colors flex-1 min-w-0">
          {card.title || 'Untitled'}
        </div>

        {card.priority && PRIORITY_BADGES[card.priority] && (
          <Badge tone={priorityBadgeTone(card.priority)} className="shrink-0 mt-0.5">
            <StatusDiamond color={priorityStatusColor(card.priority)} size={6} />
            <span>{PRIORITY_BADGES[card.priority]!.label}</span>
          </Badge>
        )}
      </div>

      {/* Tags row (if any) */}
      {(card.tags || []).length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {(card.tags || []).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--surface2)] text-[var(--ink-muted)] border border-[var(--hair)] theme-radius-xs"
            >
              <span
                className="w-1.5 h-1.5 theme-radius-xs shrink-0"
                style={{ backgroundColor: tag.color || '#a855f7' }}
              />
              <span>#{tag.name}</span>
            </span>
          ))}
        </div>
      )}

      {/* Footer: Due date, subtask progress & Assignees */}
      {(formattedDueDate || (card.totalSubtasks ?? 0) > 0 || (card.assignees || []).length > 0) && (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--hair)] text-[11px] text-[var(--ink-muted)]">
          <div className="flex items-center gap-2 min-w-0">
            {formattedDueDate && (
              <div
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium theme-radius-xs ${
                  isOverdue
                    ? 'bg-[var(--danger)]/15 text-[var(--danger)] font-bold border border-[var(--danger)]/30'
                    : 'text-[var(--ink-muted)] bg-[var(--surface2)]/80 border border-[var(--hair)]'
                }`}
              >
                <Calendar className="w-3 h-3 shrink-0" />
                <span>{formattedDueDate}</span>
              </div>
            )}

            {(card.totalSubtasks ?? 0) > 0 && (
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--ink-muted)]"
                title={`${card.completedSubtasks ?? 0}/${card.totalSubtasks} subtasks done`}
              >
                <CheckSquare className="w-3 h-3 text-[var(--ink-muted)]" />
                <span className="tabular-nums">
                  {card.completedSubtasks ?? 0}/{card.totalSubtasks}
                </span>
                <span className="w-8 h-1 bg-[var(--surface2)] border border-[var(--hair)] overflow-hidden inline-block theme-radius-xs">
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
            <AvatarGroup max={4}>
              {(card.assignees || []).map((a) => (
                <Avatar
                  key={a.userId}
                  name={a.name || 'U'}
                  size="xs"
                  title={a.name}
                  className="w-5 h-5 text-[9px] font-bold"
                />
              ))}
            </AvatarGroup>
          )}
        </div>
      )}
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
  onOpenWipDialog,
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
  onOpenWipDialog: (column: { id: string; name: string; wipLimit?: number | null }) => void;
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
        className={`w-10 h-80 shrink-0 snap-start border bg-[var(--side)] flex flex-col items-center gap-3 py-3 transition-all duration-150 cursor-grab active:cursor-grabbing touch-none theme-radius-md ${
          isDragging ? 'z-10 relative opacity-50' : ''
        } ${isOver ? 'border-[var(--accent)] bg-[var(--hi)]' : 'border-[var(--hair)]'}`}
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
          className="h-7 w-7 flex items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--hi)] hover:text-[var(--text)] theme-radius-xs cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <span
          className="flex-1 min-h-0 overflow-hidden text-xs font-eyebrow text-[var(--side-text)] whitespace-nowrap cursor-pointer uppercase tracking-wider"
          style={{
            writingMode: 'vertical-rl',
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
      className={`group/column w-[300px] md:w-[320px] shrink-0 snap-start self-start bg-[var(--side)] border p-2.5 flex flex-col transition-all duration-150 theme-radius-md ${
        isDragging ? 'z-10 relative opacity-60' : ''
      } ${isOver ? 'border-[var(--accent)] bg-[var(--hi)]/30' : 'border-[var(--hair)]'}`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-1 py-1 mb-2 pb-2 border-b border-[var(--hair)] relative">
        <div className="flex items-center gap-2 flex-1 min-w-0 pr-1">
          <StatusDiamond color={column.color || 'var(--c1)'} size={8} />
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
              className="text-xs font-eyebrow text-[var(--side-text)] uppercase tracking-wider truncate cursor-pointer hover:text-[var(--text)]"
              title={`${column.name} (double-click to rename)`}
            >
              {column.name}
            </h3>
          )}
          <CountPill count={column.cards.length} wipLimit={column.wipLimit} />
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/column:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            aria-label="Collapse column"
            title="Collapse column"
            className="h-6 w-6 flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--text)] hover:bg-[var(--hi)] theme-radius-xs transition cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder column"
            title="Drag to reorder"
            className="h-6 w-6 flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--text)] hover:bg-[var(--hi)] theme-radius-xs cursor-grab active:cursor-grabbing touch-none transition"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Column menu"
              className="h-6 w-6 flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--text)] hover:bg-[var(--hi)] theme-radius-xs transition cursor-pointer"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[var(--surface)] border border-[var(--line)] p-1 z-20 text-xs theme-radius-md">
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setColumnName(column.name);
                    setIsEditingName(true);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[var(--text)] hover:bg-[var(--hi)] theme-radius-xs cursor-pointer text-left"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenWipDialog({
                      id: column.id,
                      name: column.name,
                      wipLimit: column.wipLimit,
                    });
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[var(--text)] hover:bg-[var(--hi)] theme-radius-xs cursor-pointer text-left"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>WIP limit…</span>
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onDeleteColumn(column.id, column.cards.length);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[var(--danger)] hover:bg-[var(--hi)] theme-radius-xs cursor-pointer text-left"
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
      <div className="space-y-2 pr-0.5 min-h-[60px]">
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
            className={`h-20 border border-dashed flex items-center justify-center text-xs font-medium transition-colors select-none ${
              isOver
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--hi)]/30'
                : 'border-[var(--hair)] text-[var(--ink-muted)]/70'
            }`}
          >
            Drop cards here
          </div>
        )}
      </div>

      {/* Add Card Bottom Button / Form */}
      <div className="mt-2.5 pt-2 border-t border-[var(--hair)]">
        {isAdding ? (
          <QuickAddCard
            boardId={boardId}
            columnId={column.id}
            projectId={projectId}
            onClose={() => setIsAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 h-8 px-2 border border-dashed border-[var(--line)] text-[var(--ink-muted)] hover:text-[var(--text)] hover:border-[var(--accent)] text-xs font-semibold transition cursor-pointer"
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
  const [wipPromptColumn, setWipPromptColumn] = useState<{
    id: string;
    name: string;
    wipLimit?: number | null;
  } | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<{
    id: string;
    name: string;
    cardCount: number;
  } | null>(null);

  const anyModalOpen =
    peekCardId !== null ||
    priorityCardId !== null ||
    assignCardId !== null ||
    wipPromptColumn !== null ||
    columnToDelete !== null;

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
      const cardColumnMap = new Map<string, string>();
      for (const col of columns) {
        for (const card of col.cards) {
          cardColumnMap.set(card.id, col.id);
        }
      }
      const target = computeColumnDropTarget(columns, {
        activeId,
        overId,
        overType: over.data.current?.type,
        cardColumnMap,
      });
      if (target) {
        moveColumnMutation.mutate({ boardId, columnId: target.columnId, afterId: target.afterId });
      }
      return;
    }

    // --- Card reorder ---
    const isOverColumn = columns.some((c) => c.id === overId);
    const overRect = event.over?.rect;
    const activeRect = event.active.rect.current.translated;
    let isBelow = false;
    if (overRect && activeRect) {
      const overMidY = overRect.top + overRect.height / 2;
      const activeMidY = activeRect.top + activeRect.height / 2;
      isBelow = activeMidY > overMidY;
    }

    const drop = computeCardDropTarget(columns, {
      activeId,
      overId,
      isOverColumn,
      isBelow,
    });
    if (!drop) return;

    moveCardMutation.mutate({
      cardId: drop.cardId,
      boardId,
      columnId: drop.columnId,
      afterId: drop.afterId,
    });

    // Drop landed in a completion column? Small celebratory burst.
    const destCol = columns.find((c) => c.id === drop.columnId);
    if (destCol && COMPLETED_COLUMN_RE.test(destCol.name)) {
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
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    if (cardCount > 0) {
      const otherCols = columns.filter((c) => c.id !== columnId);
      if (otherCols.length === 0) {
        toast.error('Cannot delete the only column when it has cards.');
        return;
      }
    }
    setColumnToDelete({ id: columnId, name: col.name, cardCount });
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
      toast.error(err?.message || 'Failed to create column');
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
                onOpenWipDialog={setWipPromptColumn}
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
          <div className="w-[300px] md:w-[320px] shrink-0 snap-start bg-[var(--side)] p-3 flex flex-col gap-2.5 border border-[var(--accent)] theme-radius-md">
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
                className="h-8 w-8 flex items-center justify-center hover:bg-[var(--hi)] text-[var(--ink-muted)] hover:text-[var(--text)] transition cursor-pointer theme-radius-xs"
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
            className="w-[300px] md:w-[320px] shrink-0 snap-start h-12 border border-dashed border-[var(--line)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-xs font-semibold text-[var(--ink-muted)] transition flex items-center justify-center gap-2 cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" />
            <span>Add Column</span>
          </button>
        )}
      </div>

      {/* WIP Limit Prompt Dialog */}
      <PromptDialog
        open={!!wipPromptColumn}
        title={`Set WIP limit for "${wipPromptColumn?.name}"`}
        message="Enter maximum number of cards for this column (leave empty to remove limit):"
        placeholder="e.g. 5"
        defaultValue={
          wipPromptColumn?.wipLimit != null && wipPromptColumn.wipLimit > 0
            ? String(wipPromptColumn.wipLimit)
            : ''
        }
        confirmLabel="Save"
        allowEmpty={true}
        busy={updateColumnMutation.isPending}
        onConfirm={(val) => {
          if (!wipPromptColumn) return;
          const trimmed = val.trim();
          if (!trimmed) {
            handleSetWipLimit(wipPromptColumn.id, null);
          } else {
            const parsed = parseInt(trimmed, 10);
            if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 999) {
              handleSetWipLimit(wipPromptColumn.id, parsed);
            } else {
              toast.error('WIP limit must be a number between 0 and 999');
              return;
            }
          }
          setWipPromptColumn(null);
        }}
        onCancel={() => setWipPromptColumn(null)}
      />

      {/* Delete Column Confirm Dialog */}
      {columnToDelete && (() => {
        const otherCols = columns.filter((c) => c.id !== columnToDelete.id);
        const moveToCol = otherCols[0];
        const hasCards = columnToDelete.cardCount > 0;
        return (
          <ConfirmDialog
            open={true}
            title="Delete column"
            message={
              hasCards && moveToCol
                ? `Column "${columnToDelete.name}" has ${columnToDelete.cardCount} card(s). They will be moved to "${moveToCol.name}". Are you sure you want to delete this column?`
                : `Are you sure you want to delete column "${columnToDelete.name}"?`
            }
            confirmLabel="Delete"
            danger={true}
            busy={deleteColumnMutation.isPending}
            onConfirm={() => {
              deleteColumnMutation.mutate(
                {
                  boardId,
                  columnId: columnToDelete.id,
                  moveTo: hasCards && moveToCol ? moveToCol.id : undefined,
                },
                {
                  onSuccess: () => {
                    if (hasCards && moveToCol) {
                      toast.success(
                        `Column deleted — ${columnToDelete.cardCount} cards moved to ${moveToCol.name}`,
                      );
                    } else {
                      toast.success('Column deleted');
                    }
                    setColumnToDelete(null);
                  },
                  onError: (err: any) => {
                    toast.error(err?.message || 'Failed to delete column');
                    setColumnToDelete(null);
                  },
                },
              );
            }}
            onCancel={() => setColumnToDelete(null)}
          />
        );
      })()}

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
