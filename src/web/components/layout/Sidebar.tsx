import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  FileText,
  Inbox,
  Kanban,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { ProjectSwitcher } from './ProjectSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { useBoards, useCreateBoard, useMe, useMyTasks, useProjectTags } from '../../lib/queries'
import { NotepadTree } from '../notepads/NotepadTree'
import { NotificationsBell } from './NotificationsBell'

interface SidebarProps {
  onCloseMobile?: () => void
}

/** Overdue + due-today count among open assigned tasks (for the sidebar badge). */
function useMyTasksBadgeCount(): number {
  const { data } = useMyTasks({ status: 'open' })
  if (!data) return 0
  const todayEnd = new Date().setHours(24, 0, 0, 0)
  return data.filter((t) => t.dueDate !== null && t.dueDate < todayEnd).length
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate()
  const { data: me } = useMe()
  const params = useParams({ strict: false }) as {
    projectId?: string
    boardId?: string
  }
  const currentProjectId = params.projectId || me?.lastProjectId || undefined
  const currentBoardId = params.boardId
  const { data: boards = [] } = useBoards(currentProjectId)
  const { data: projectTags = [] } = useProjectTags(currentProjectId)
  const createBoardMutation = useCreateBoard()
  const badgeCount = useMyTasksBadgeCount()

  return (
    <aside className="w-64 h-screen flex flex-col bg-neutral-50/70 dark:bg-neutral-950/70 border-r border-neutral-200 dark:border-neutral-800 select-none">
      {/* Top Header: Project Switcher & Mobile Close */}
      <div className="p-3 flex items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800/60">
        <div className="flex-1 min-w-0">
          <ProjectSwitcher currentProjectId={currentProjectId} />
        </div>
        <NotificationsBell projectId={currentProjectId} />
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Actions: Search & Notifications */}
      <div className="px-3 pt-3 space-y-1">
        <button
          onClick={() => {
            // Trigger command palette event
            window.dispatchEvent(new CustomEvent('burrow:open-palette'))
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg hover:border-neutral-300 dark:hover:border-neutral-700 transition shadow-xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            <span>Search or command</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-neutral-100 dark:bg-neutral-800 rounded border border-neutral-200 dark:border-neutral-700">
            ⌘K
          </kbd>
        </button>

        {currentProjectId ? (
          <Link
            to="/p/$projectId"
            params={{ projectId: currentProjectId }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition"
          >
            <span className="text-base leading-none">🏠</span>
            <span>Project Overview</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition"
          >
            <span className="text-base leading-none">🏠</span>
            <span>Project Overview</span>
          </Link>
        )}

        {/* My Tasks: global assignee inbox, pinned above project sections */}
        <Link
          to="/my-tasks"
          activeProps={{
            className:
              'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold',
          }}
          className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm font-medium text-neutral-600 dark:text-neutral-300 rounded-lg hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition"
        >
          <span className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-primary" />
            <span>My Tasks</span>
          </span>
          {badgeCount > 0 && (
            <span className="min-w-[18px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/30 text-[10px] font-bold text-center">
              {badgeCount}
            </span>
          )}
        </Link>
      </div>

      {/* Main Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Favorites Section */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            <Star className="w-3 h-3 text-amber-500" />
            <span>Favorites</span>
          </div>
          <div className="px-2 py-1 text-xs text-neutral-400 italic">
            No favorited notepads yet
          </div>
        </div>

        {/* Notepads Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              <span>Notepads</span>
            </div>
          </div>
          <div id="sidebar-notepad-tree" className="space-y-0.5 mt-1">
            {currentProjectId && <NotepadTree projectId={currentProjectId} />}
          </div>
        </div>

        {/* Boards Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Kanban className="w-3 h-3" />
              <span>Boards</span>
            </div>
            {currentProjectId && me?.role !== 'viewer' && (
              <button
                onClick={async () => {
                  const name = window.prompt('New Board Name:', 'Sprint Board')
                  if (!name?.trim()) return
                  const res = await createBoardMutation.mutateAsync({
                    projectId: currentProjectId,
                    name: name.trim(),
                  })
                  navigate({
                    to: '/p/$projectId/boards/$boardId',
                    params: {
                      projectId: currentProjectId,
                      boardId: res.id,
                    },
                  })
                }}
                className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition"
                title="Create Board"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div id="sidebar-boards-list" className="space-y-0.5 mt-1">
            {boards.length === 0 ? (
              <div className="px-2 py-1 text-xs text-neutral-400 italic">
                No boards yet
              </div>
            ) : (
              boards.map((b) => {
                const isActive = b.id === currentBoardId
                return (
                  <Link
                    key={b.id}
                    to="/p/$projectId/boards/$boardId"
                    params={{
                      projectId: currentProjectId!,
                      boardId: b.id,
                    }}
                    className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-neutral-200/80 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-neutral-200'
                    }`}
                  >
                    <span className="text-sm leading-none">{b.icon || '📋'}</span>
                    <span className="truncate">{b.name}</span>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* Project Tags Section */}
        {projectTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              <Tag className="w-3 h-3 text-purple-400" />
              <span>Tags</span>
            </div>
            <div className="space-y-0.5 mt-1 px-1">
              {projectTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('burrow:open-palette'))
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/40 dark:hover:bg-neutral-800/40 hover:text-neutral-900 dark:hover:text-neutral-200 transition text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color || '#a855f7' }}
                  />
                  <span className="truncate">#{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Trash, Members, Settings, Theme */}
      <div className="p-3 border-t border-neutral-200/60 dark:border-neutral-800/60 space-y-1">
        {currentProjectId && (
          <Link
            to="/p/$projectId/trash"
            params={{ projectId: currentProjectId }}
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash</span>
          </Link>
        )}

        {me?.role === 'owner' && (
          <Link
            to="/settings/members"
            className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 rounded-lg transition"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workspace Members</span>
          </Link>
        )}

        <div className="pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate text-xs text-neutral-700 dark:text-neutral-300">
            <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium text-xs">
              {me?.user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="truncate">{me?.user?.name || 'Account'}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}
