import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  CalendarDays,
  Filter,
  Kanban,
  List,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import {
  useBoard,
  useDeleteBoard,
  useMembers,
  useProjectTags,
  useUpdateBoard,
} from '../../lib/queries'
import { CardPanel } from './CardPanel'
import { KanbanView } from './views/KanbanView'
import { ListView } from './views/ListView'
import { CalendarView } from './views/CalendarView'
import type { ColumnItem } from './views/types'

interface BoardViewProps {
  boardId: string
  projectId: string
}

type BoardViewMode = 'kanban' | 'list' | 'calendar'

const VIEW_STORAGE_PREFIX = 'burrow:board-view:'

function readStoredMode(boardId: string): BoardViewMode {
  try {
    const v = localStorage.getItem(VIEW_STORAGE_PREFIX + boardId)
    if (v === 'list' || v === 'calendar' || v === 'kanban') return v
  } catch {
    // localStorage unavailable (private mode) — fall back to kanban
  }
  return 'kanban'
}

const VIEW_TABS: Array<{ mode: BoardViewMode; label: string; icon: typeof Kanban }> = [
  { mode: 'kanban', label: 'Kanban', icon: Kanban },
  { mode: 'list', label: 'List', icon: List },
  { mode: 'calendar', label: 'Calendar', icon: CalendarDays },
]

export function BoardView({ boardId, projectId }: BoardViewProps) {
  const navigate = useNavigate()
  const { data: board, isLoading } = useBoard(boardId)
  const updateBoardMutation = useUpdateBoard()
  const deleteBoardMutation = useDeleteBoard()

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isEditingBoardName, setIsEditingBoardName] = useState(false)
  const [boardName, setBoardName] = useState('')
  const [isAddingColumn, setIsAddingColumn] = useState(false)

  // Board filters
  const [filterSearch, setFilterSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterAssignee, setFilterAssignee] = useState<string>('all')
  const [filterTag, setFilterTag] = useState<string>('all')

  // View switcher, persisted per board (FEATURE_PLAN 2.2)
  const [viewMode, setViewMode] = useState<BoardViewMode>(() => readStoredMode(boardId))
  useEffect(() => {
    setViewMode(readStoredMode(boardId))
    setIsAddingColumn(false)
  }, [boardId])

  const changeView = (mode: BoardViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_STORAGE_PREFIX + boardId, mode)
    } catch {
      // ignore quota/private-mode errors
    }
  }

  const { data: members = [] } = useMembers()
  const { data: tags = [] } = useProjectTags(projectId)

  const columns = useMemo<ColumnItem[]>(() => board?.columns || [], [board?.columns])

  const filteredColumns = useMemo(() => {
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((card) => {
        if (filterSearch.trim()) {
          const q = filterSearch.toLowerCase()
          if (!card.title.toLowerCase().includes(q)) return false
        }
        if (filterPriority !== 'all' && card.priority !== filterPriority) {
          return false
        }
        if (filterAssignee !== 'all') {
          if (!card.assignees.some((a) => a.userId === filterAssignee)) return false
        }
        if (filterTag !== 'all') {
          if (!card.tags.some((t) => t.id === filterTag)) return false
        }
        return true
      }),
    }))
  }, [columns, filterSearch, filterPriority, filterAssignee, filterTag])

  const isFiltered =
    filterSearch.trim() !== '' ||
    filterPriority !== 'all' ||
    filterAssignee !== 'all' ||
    filterTag !== 'all'

  if (isLoading || !board) {
    return (
      <div className="p-8 flex items-center justify-center text-sm text-neutral-400">
        Loading board…
      </div>
    )
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
          {viewMode === 'kanban' && (
            <button
              onClick={() => setIsAddingColumn(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Column</span>
            </button>
          )}
          <button
            onClick={handleDeleteBoard}
            title="Delete Board"
            className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Bar + View Switcher */}
      <div className="px-6 py-2 border-b border-neutral-200/50 dark:border-neutral-800/50 bg-neutral-50/50 dark:bg-neutral-900/30 flex items-center gap-3 flex-wrap text-xs">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="font-semibold uppercase tracking-wider text-[10px]">Filter:</span>
        </div>

        {/* Text Search */}
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-neutral-400 absolute left-2" />
          <input
            type="text"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder="Search cards…"
            className="pl-7 pr-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none focus:border-primary w-32 focus:w-44 transition-all"
          />
        </div>

        {/* Priority Filter */}
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none text-neutral-700 dark:text-neutral-300"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Assignee Filter */}
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none text-neutral-700 dark:text-neutral-300"
        >
          <option value="all">All Assignees</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name || m.email}
            </option>
          ))}
        </select>

        {/* Tag Filter */}
        <select
          value={filterTag}
          onChange={(e) => setFilterTag(e.target.value)}
          className="px-2 py-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs outline-none text-neutral-700 dark:text-neutral-300"
        >
          <option value="all">All Tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.name}
            </option>
          ))}
        </select>

        {/* Reset Filter Button */}
        {isFiltered && (
          <button
            onClick={() => {
              setFilterSearch('')
              setFilterPriority('all')
              setFilterAssignee('all')
              setFilterTag('all')
            }}
            className="flex items-center gap-1 text-[11px] text-rose-500 hover:text-rose-600 font-medium px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
          >
            <X className="w-3 h-3" />
            <span>Reset filters</span>
          </button>
        )}

        {/* View Switcher (persisted per board) */}
        <div className="ml-auto flex items-center gap-0.5 rounded-xl border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon
            const active = viewMode === tab.mode
            return (
              <button
                key={tab.mode}
                type="button"
                onClick={() => changeView(tab.mode)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
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
    </div>
  )
}
