import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { CalendarDays, Filter, Kanban, List, Plus, Search, Trash2, X } from 'lucide-react';
import { useBoard, useDeleteBoard, useMembers, useProjectTags, useUpdateBoard } from '../../lib/queries';
import { CardPanel } from './CardPanel';
import { KanbanView } from './views/KanbanView';
import { ListView } from './views/ListView';
import { CalendarView } from './views/CalendarView';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Select } from '../ui/Select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { ColumnItem } from './views/types';

interface BoardViewProps {
  boardId: string;
  projectId: string;
}

type BoardViewMode = 'kanban' | 'list' | 'calendar';

const VIEW_STORAGE_PREFIX = 'burrow:board-view:';

function readStoredMode(boardId: string): BoardViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_PREFIX + boardId);
    if (v === 'list' || v === 'calendar' || v === 'kanban') return v;
  } catch {
    // localStorage unavailable (private mode) — fall back to kanban
  }
  return 'kanban';
}

const VIEW_TABS: Array<{ mode: BoardViewMode; label: string; icon: typeof Kanban }> = [
  { mode: 'kanban', label: 'Kanban', icon: Kanban },
  { mode: 'list', label: 'List', icon: List },
  { mode: 'calendar', label: 'Calendar', icon: CalendarDays },
];

export function BoardView({ boardId, projectId }: BoardViewProps) {
  const navigate = useNavigate();
  const { data: board, isLoading } = useBoard(boardId);
  const updateBoardMutation = useUpdateBoard();
  const deleteBoardMutation = useDeleteBoard();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isEditingBoardName, setIsEditingBoardName] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Board filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');

  // View switcher, persisted per board (FEATURE_PLAN 2.2)
  const [viewMode, setViewMode] = useState<BoardViewMode>(() => readStoredMode(boardId));
  useEffect(() => {
    setViewMode(readStoredMode(boardId));
    setIsAddingColumn(false);
  }, [boardId]);

  const changeView = (mode: BoardViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_PREFIX + boardId, mode);
    } catch {
      // ignore quota/private-mode errors
    }
  };

  const { data: members = [] } = useMembers();
  const { data: tags = [] } = useProjectTags(projectId);

  const columns = useMemo<ColumnItem[]>(() => board?.columns || [], [board?.columns]);

  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filterSearch.trim()) {
          const q = filterSearch.toLowerCase();
          if (!card.title.toLowerCase().includes(q)) return false;
        }
        if (filterPriority !== 'all' && card.priority !== filterPriority) {
          return false;
        }
        if (filterAssignee !== 'all') {
          if (!card.assignees.some((a) => a.userId === filterAssignee)) return false;
        }
        if (filterTag !== 'all') {
          if (!card.tags.some((t) => t.id === filterTag)) return false;
        }
        return true;
      }),
    }));
  }, [columns, filterSearch, filterPriority, filterAssignee, filterTag]);

  const isFiltered =
    filterSearch.trim() !== '' ||
    filterPriority !== 'all' ||
    filterAssignee !== 'all' ||
    filterTag !== 'all';

  if (isLoading || !board) {
    return (
      <div className="p-8 flex items-center justify-center text-sm text-[var(--muted)]">
        Loading board…
      </div>
    );
  }

  const handleBoardNameSave = () => {
    if (boardName.trim() && boardName !== board.name) {
      updateBoardMutation.mutate({
        boardId,
        name: boardName.trim(),
      });
    }
    setIsEditingBoardName(false);
  };

  const handleDeleteBoard = async () => {
    await deleteBoardMutation.mutateAsync(boardId);
    setConfirmDeleteOpen(false);
    navigate({ to: '/p/$projectId', params: { projectId } });
  };

  return (
    <div className="h-full flex flex-col min-h-0 bg-[var(--bg)] text-[var(--text)]">
      {/* Board Header Bar */}
      <div className="p-4 px-4 md:px-6 border-b border-[var(--line)] flex items-center justify-between gap-4 bg-[var(--surface)]">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">{board.icon || '📋'}</span>
          {isEditingBoardName ? (
            <input
              type="text"
              autoFocus
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              onBlur={handleBoardNameSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleBoardNameSave();
                if (e.key === 'Escape') setIsEditingBoardName(false);
              }}
              className="text-xl bg-transparent border-b-2 border-[var(--accent)] focus:outline-none text-[var(--text)] min-w-0 text-[16px]"
              style={{
                fontFamily: 'Archivo, sans-serif',
                fontVariationSettings: "'wdth' 122, 'wght' 800",
              }}
            />
          ) : (
            <h1
              onClick={() => {
                setBoardName(board.name);
                setIsEditingBoardName(true);
              }}
              className="text-xl md:text-2xl text-[var(--text)] cursor-pointer hover:opacity-80 truncate tracking-tight"
              style={{
                fontFamily: 'Archivo, sans-serif',
                fontVariationSettings: "'wdth' 122, 'wght' 800",
                letterSpacing: '-0.02em',
              }}
              title="Click to rename"
            >
              {board.name}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'kanban' && (
            <Button variant="primary" size="sm" onClick={() => setIsAddingColumn(true)}>
              <Plus className="w-3.5 h-3.5" />
              <span>Add Column</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
            className="text-[var(--muted)] hover:text-[var(--danger)] cursor-pointer"
            title="Delete board to Trash"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter Bar + View Switcher — horizontally scrollable chip track on mobile */}
      <div className="border-b border-[var(--line)] bg-[var(--surface2)]">
        <div className="px-4 md:px-6 py-2 flex items-center gap-2 md:gap-3 md:flex-wrap text-xs overflow-x-auto no-scrollbar whitespace-nowrap snap-x">
          <div className="flex items-center gap-1.5 text-[var(--muted)] shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-semibold uppercase tracking-wider text-[10px]">Filter:</span>
          </div>

          {/* Text Search */}
          <div className="relative flex items-center shrink-0">
            <Search className="w-3 h-3 text-[var(--muted)] absolute left-2 pointer-events-none" />
            <Input
              type="text"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Search cards…"
              aria-label="Search cards"
              className="pl-7 pr-2 w-32 focus:w-44 transition-all"
            />
          </div>

          {/* Priority Filter */}
          <Select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
            className="shrink-0 w-auto"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>

          {/* Assignee Filter */}
          <Select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            aria-label="Filter by assignee"
            className="shrink-0 w-auto"
          >
            <option value="all">All Assignees</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name || m.email}
              </option>
            ))}
          </Select>

          {/* Tag Filter */}
          <Select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            aria-label="Filter by tag"
            className="shrink-0 w-auto"
          >
            <option value="all">All Tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                #{t.name}
              </option>
            ))}
          </Select>

          {/* Reset Filter Button */}
          {isFiltered && (
            <Chip
              active
              onClick={() => {
                setFilterSearch('');
                setFilterPriority('all');
                setFilterAssignee('all');
                setFilterTag('all');
              }}
              className="shrink-0"
            >
              <X className="w-3 h-3" />
              <span>Reset filters</span>
            </Chip>
          )}

          {/* View Switcher (persisted per board) */}
          <SegmentedControl
            value={viewMode}
            onValueChange={(v) => changeView(v as BoardViewMode)}
            ariaLabel="Board view"
            className="ml-auto shrink-0"
            options={VIEW_TABS.map((tab) => ({
              value: tab.mode,
              label: (
                <span className="flex items-center gap-1.5">
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </span>
              ),
            }))}
          />
        </div>
      </div>

      {/* Active View */}
      {viewMode === 'kanban' ? (
        <KanbanView
          boardId={boardId}
          projectId={projectId}
          columns={columns}
          filteredColumns={filteredColumns}
          isAddingColumn={isAddingColumn}
          setIsAddingColumn={setIsAddingColumn}
          onCardClick={(id) => setSelectedCardId(id)}
        />
      ) : viewMode === 'list' ? (
        <ListView
          boardId={boardId}
          columns={filteredColumns}
          onCardClick={(id) => setSelectedCardId(id)}
        />
      ) : (
        <CalendarView
          boardId={boardId}
          columns={filteredColumns}
          onCardClick={(id) => setSelectedCardId(id)}
        />
      )}

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

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete board"
        message={`Move "${board.name}" to Trash? You can restore it from Trash if needed.`}
        confirmLabel="Delete to Trash"
        danger
        busy={deleteBoardMutation.isPending}
        onConfirm={handleDeleteBoard}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
