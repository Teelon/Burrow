import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Inbox, Kanban, Plus, Search, Star, Tag, Trash2, Users, X } from 'lucide-react';
import { ProjectSwitcher } from './ProjectSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { StatusDiamond } from '../ui/StatusDiamond';
import { Avatar } from '../ui/Avatar';
import { useBoards, useCreateBoard, useMe, useMyTasks, useProjectTags } from '../../lib/queries';
import { NotepadTree } from '../notepads/NotepadTree';
import { NotificationsBell } from './NotificationsBell';

interface SidebarProps {
  onCloseMobile?: () => void;
}

/** Overdue + due-today count among open assigned tasks (for the sidebar badge). */
function useMyTasksBadgeCount(): number {
  const { data } = useMyTasks({ status: 'open' });
  if (!data) return 0;
  const todayEnd = new Date().setHours(24, 0, 0, 0);
  return data.filter((t) => t.dueDate !== null && t.dueDate < todayEnd).length;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const params = useParams({ strict: false }) as {
    projectId?: string;
    boardId?: string;
  };
  const currentProjectId = params.projectId || me?.lastProjectId || undefined;
  const currentBoardId = params.boardId;
  const { data: boards = [] } = useBoards(currentProjectId);
  const { data: projectTags = [] } = useProjectTags(currentProjectId);
  const createBoardMutation = useCreateBoard();
  const badgeCount = useMyTasksBadgeCount();
  const queryClient = useQueryClient();
  const createRootNotepad = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${currentProjectId}/notepads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled' }),
      });
      if (!res.ok) throw new Error('Failed to create notepad');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notepads', currentProjectId] }),
  });

  return (
    <aside className="w-64 h-screen flex flex-col bg-side text-text border-r border-line select-none">
      {/* Top Header: Project Switcher & Mobile Close */}
      <div className="p-3 flex items-center justify-between gap-2 border-b border-hair">
        <div className="flex-1 min-w-0">
          <ProjectSwitcher currentProjectId={currentProjectId} />
        </div>
        <NotificationsBell projectId={currentProjectId} />
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden flex h-11 w-11 items-center justify-center text-muted hover:text-text hover:bg-hi transition"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Actions: Search & Notifications */}
      <div className="px-3 pt-3 space-y-1">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <Input
            readOnly
            placeholder="Search or command"
            aria-label="Search or command"
            onClick={() => {
              // Trigger command palette event
              window.dispatchEvent(new CustomEvent('burrow:open-palette'));
            }}
            onFocus={(e) => {
              e.target.blur();
              window.dispatchEvent(new CustomEvent('burrow:open-palette'));
            }}
            className="pl-8 pr-12 cursor-pointer"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono bg-surface2 border border-line text-muted">
            ⌘K
          </kbd>
        </div>

        {currentProjectId ? (
          <Link
            to="/p/$projectId"
            params={{ projectId: currentProjectId }}
            className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
          >
            <span className="text-base leading-none">🏠</span>
            <span>Project Overview</span>
          </Link>
        ) : (
          <Link
            to="/"
            className="relative flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
          >
            <span className="text-base leading-none">🏠</span>
            <span>Project Overview</span>
          </Link>
        )}

        {/* My Tasks: global assignee inbox, pinned above project sections */}
        <Link
          to="/my-tasks"
          activeProps={{
            className: 'bg-hi text-text font-semibold',
          }}
          className="relative flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
        >
          <span className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-accent" />
            <span>My Tasks</span>
          </span>
          {badgeCount > 0 && (
            <Badge tone="neutral" className="min-w-[18px] justify-center">
              {badgeCount}
            </Badge>
          )}
        </Link>
      </div>

      {/* Main Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Favorites Section */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
            <Star className="w-3 h-3 text-accent" />
            <span>Favorites</span>
          </div>
          <div className="px-2 py-1 text-xs text-muted italic">No favorited notepads yet</div>
        </div>

        {/* Notepads Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              <span>Notepads</span>
            </div>
            {currentProjectId && me?.role !== 'viewer' && (
              <button
                onClick={() => createRootNotepad.mutate()}
                className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center hover:bg-hi text-muted hover:text-text transition"
                title="New notepad"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div id="sidebar-notepad-tree" className="space-y-0.5 mt-1">
            {currentProjectId && <NotepadTree projectId={currentProjectId} />}
          </div>
        </div>

        {/* Boards Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Kanban className="w-3 h-3" />
              <span>Boards</span>
            </div>
            {currentProjectId && me?.role !== 'viewer' && (
              <button
                onClick={async () => {
                  const name = window.prompt('New Board Name:', 'Sprint Board');
                  if (!name?.trim()) return;
                  const res = await createBoardMutation.mutateAsync({
                    projectId: currentProjectId,
                    name: name.trim(),
                  });
                  navigate({
                    to: '/p/$projectId/boards/$boardId',
                    params: {
                      projectId: currentProjectId,
                      boardId: res.id,
                    },
                  });
                }}
                className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center hover:bg-hi text-muted hover:text-text transition"
                title="Create Board"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div id="sidebar-boards-list" className="space-y-0.5 mt-1">
            {boards.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted italic">No boards yet</div>
            ) : (
              boards.map((b) => {
                const isActive = b.id === currentBoardId;
                return (
                  <Link
                    key={b.id}
                    to="/p/$projectId/boards/$boardId"
                    params={{
                      projectId: currentProjectId!,
                      boardId: b.id,
                    }}
                    className={`relative w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition min-h-[44px] md:min-h-0 ${
                      isActive
                        ? 'bg-hi text-text font-semibold'
                        : 'text-muted hover:bg-hi hover:text-text'
                    }`}
                  >
                    {isActive && (
                      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                    )}
                    <span className="text-sm leading-none">{b.icon || '📋'}</span>
                    <span className="truncate">{b.name}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Project Tags Section */}
        {projectTags.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-muted uppercase tracking-wider">
              <Tag className="w-3 h-3 text-accent" />
              <span>Tags</span>
            </div>
            <div className="space-y-0.5 mt-1 px-1">
              {projectTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('burrow:open-palette'));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted hover:bg-hi hover:text-text transition text-left min-h-[44px] md:min-h-0"
                >
                  <StatusDiamond color={tag.color || '#a855f7'} size={8} />
                  <span className="truncate">#{tag.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Trash, Members, Settings, Theme */}
      <div className="p-3 border-t border-hair space-y-1">
        {currentProjectId && (
          <Link
            to="/p/$projectId/trash"
            params={{ projectId: currentProjectId }}
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted hover:text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash</span>
          </Link>
        )}

        {me?.role === 'owner' && (
          <Link
            to="/settings/members"
            className="flex items-center gap-2 px-3 py-2 text-xs text-muted hover:text-text hover:bg-hi transition min-h-[44px] md:min-h-0"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workspace Members</span>
          </Link>
        )}

        <div className="pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2 truncate text-xs text-text">
            <Avatar name={me?.user?.name || 'Account'} size="xs" />
            <span className="truncate">{me?.user?.name || 'Account'}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
