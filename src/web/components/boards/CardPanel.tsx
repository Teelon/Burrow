import { useState, useEffect, lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { Calendar, Flag, Tag, Trash2, Users, X } from 'lucide-react';

const LazyNotepadEditor = lazy(() =>
  import('../../editor/NotepadEditor').then((m) => ({ default: m.NotepadEditor })),
);
import {
  useCard,
  useDeleteCard,
  useMembers,
  useMoveCard,
  useRestoreCard,
  useUpdateCard,
} from '../../lib/queries';
import { SubtasksSection } from './SubtasksSection';
import { CommentsFeed } from './CommentsFeed';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { SegmentedControl } from '../ui/SegmentedControl';
import { StatusDiamond } from '../ui/StatusDiamond';

interface CardPanelProps {
  cardId: string;
  boardId: string;
  projectId: string;
  columns: Array<{ id: string; name: string }>;
  onClose: () => void;
}

// Basalt priority → status token mapping (Layer 4 adapter).
const PRIORITIES = [
  { value: 'low', label: 'Low', colorVar: 'var(--c4)' },
  { value: 'medium', label: 'Medium', colorVar: 'var(--c3)' },
  { value: 'high', label: 'High', colorVar: 'var(--c2)' },
  { value: 'urgent', label: 'Urgent', colorVar: 'var(--danger)' },
] as const;

export function CardPanel({ cardId, boardId, columns, onClose }: CardPanelProps) {
  const { data: card, isLoading } = useCard(cardId);
  const { data: members = [] } = useMembers();
  const updateCardMutation = useUpdateCard();
  const moveCardMutation = useMoveCard();
  const deleteCardMutation = useDeleteCard();
  const restoreCardMutation = useRestoreCard();

  const [title, setTitle] = useState('');

  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
    }
  }, [card]);

  if (isLoading || !card) {
    return (
      <div className="fixed inset-x-0 bottom-0 top-[8dvh] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[540px] md:w-[680px] h-[100dvh] bg-[var(--surface)] border-t-2 border-[var(--line)] sm:border-t-0 sm:border-l sm:border-l-[var(--line)] z-50 p-6 flex flex-col items-center justify-center pb-[env(safe-area-inset-bottom)]">
        <div className="text-sm text-[var(--muted)]">Loading card…</div>
      </div>
    );
  }

  const handleTitleBlur = () => {
    if (title.trim() && title !== card.title) {
      updateCardMutation.mutate({
        cardId,
        boardId,
        title: title.trim(),
      });
    }
  };

  const handlePriorityChange = (priority: 'low' | 'medium' | 'high' | 'urgent' | null) => {
    updateCardMutation.mutate({
      cardId,
      boardId,
      priority,
    });
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const timestamp = val ? new Date(val).getTime() : null;
    updateCardMutation.mutate({
      cardId,
      boardId,
      dueDate: timestamp,
    });
  };

  const handleColumnChange = (newColId: string) => {
    if (newColId !== card.columnId) {
      moveCardMutation.mutate({
        cardId,
        boardId,
        columnId: newColId,
      });
    }
  };

  const assignees = (card as any).assignees || [];
  const tags = (card as any).tags || [];
  const subtasks = (card as any).subtasks || [];

  const toggleAssignee = (userId: string) => {
    const current = assignees.map((a: any) => a.userId);
    const next = current.includes(userId)
      ? current.filter((id: string) => id !== userId)
      : [...current, userId];
    updateCardMutation.mutate({
      cardId,
      boardId,
      assigneeIds: next,
    });
  };

  const handleDelete = () => {
    deleteCardMutation.mutate(
      { cardId, boardId },
      {
        onSuccess: () => {
          onClose();
          toast('Card moved to trash', {
            duration: 6000,
            action: {
              label: 'Undo',
              onClick: () => restoreCardMutation.mutate({ cardId }),
            },
          });
        },
      },
    );
  };

  const isoDueDate = card.dueDate ? new Date(card.dueDate).toISOString().slice(0, 10) : '';

  return (
    <div className="fixed inset-x-0 bottom-0 top-[8dvh] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[540px] md:w-[680px] h-[100dvh] bg-[var(--surface)] border-t-2 border-[var(--line)] sm:border-t-0 sm:border-l sm:border-l-[var(--line)] z-50 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
      {/* Top Header */}
      <div className="p-4 border-b border-[var(--hair)] flex items-center justify-between gap-3 bg-[var(--surface2)]">
        <div className="flex items-center gap-2">
          <Select
            value={card.columnId}
            onChange={(e) => handleColumnChange(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold min-h-[44px] sm:min-h-0"
          >
            {columns.length > 0 ? (
              columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))
            ) : (
              <option value={card.columnId}>{(card as any).columnName || 'Column'}</option>
            )}
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={handleDelete}
            title="Delete card"
            className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--danger)]"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            title="Close"
            className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Title */}
        <div>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Card Title"
            className="w-full text-2xl font-bold bg-transparent border-none focus:outline-none placeholder:text-[var(--muted)] text-[var(--text)]"
          />
        </div>

        {/* Metadata Properties Grid — flat, angular */}
        <div className="bg-[var(--surface2)] p-4 border border-[var(--line)] space-y-3 text-xs">
          {/* Priority — geometric selector */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--muted)] w-28">
              <Flag className="w-3.5 h-3.5" />
              <span>Priority</span>
            </div>
            <SegmentedControl
              value={card.priority ?? ''}
              onValueChange={(v) =>
                handlePriorityChange(
                  card.priority === v ? null : (v as 'low' | 'medium' | 'high' | 'urgent'),
                )
              }
              options={PRIORITIES.map((p) => ({
                value: p.value,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDiamond color={p.colorVar} size={8} />
                    {p.label}
                  </span>
                ),
              }))}
            />
          </div>

          {/* Due Date */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--muted)] w-28">
              <Calendar className="w-3.5 h-3.5" />
              <span>Due Date</span>
            </div>
            <Input
              type="date"
              value={isoDueDate}
              onChange={handleDueDateChange}
              className="px-2 py-1 text-xs min-h-[44px] sm:min-h-0 w-auto max-w-[10rem]"
            />
          </div>

          {/* Assignees */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--muted)] w-28 pt-1">
              <Users className="w-3.5 h-3.5" />
              <span>Assignees</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {members.map((m) => {
                const isAssigned = assignees.some((a: any) => a.userId === m.userId);
                return (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => toggleAssignee(m.userId)}
                    className={`px-2 py-1 min-h-[44px] sm:min-h-0 border text-xs flex items-center gap-1.5 transition ${
                      isAssigned
                        ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-ink)] font-medium'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    <Avatar name={m.name} size="xs" />
                    <span>{m.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[var(--muted)] w-28">
                <Tag className="w-3.5 h-3.5" />
                <span>Tags</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {tags.map((t: any) => (
                  <Badge key={t.id} style={{ borderLeftColor: t.color || '#64748b' }}>
                    #{t.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Subtasks / Checklist */}
        <SubtasksSection cardId={cardId} boardId={boardId} subtasks={subtasks} />

        {/* Card Body (BlockNote Notepad Editor) */}
        {card.notepadId && (
          <div className="border-t border-[var(--hair)] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">
              Card Notes & Body
            </h3>
            <Suspense
              fallback={<div className="p-4 text-xs text-[var(--muted)]">Loading card notes…</div>}
            >
              <LazyNotepadEditor notepadId={card.notepadId} hideTitle hideFavorite />
            </Suspense>
          </div>
        )}

        {/* Discussion thread */}
        <CommentsFeed cardId={cardId} />
      </div>
    </div>
  );
}
