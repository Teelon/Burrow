import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Clock,
  FileText,
  Home,
  Inbox,
  Kanban,
  LogOut,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ProjectSwitcher } from './ProjectSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from '../ui/Badge';
import { StatusDiamond } from '../ui/StatusDiamond';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import {
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useMe,
  useMembers,
  useMyTasks,
  useNotepads,
  useProjectTags,
  useSignOut,
  useTrash,
} from '../../lib/queries';
import { THEME_LABELS, useTheme, type BurrowTheme } from '../../lib/theme';
import { NotepadTree } from '../notepads/NotepadTree';
import { NotificationsBell } from './NotificationsBell';

interface SidebarProps {
  onCloseMobile?: () => void;
}

type RailTab = 'overview' | 'notepads' | 'boards' | 'tasks' | 'members' | 'trash' | 'search';

const THEME_OPTIONS: BurrowTheme[] = ['basalt', 'modern', 'light'];

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { isModern, theme, setTheme } = useTheme();
  const { data: me } = useMe();
  const params = useParams({ strict: false }) as {
    projectId?: string;
    boardId?: string;
    notepadId?: string;
  };
  const currentProjectId = params.projectId || me?.lastProjectId || undefined;
  const currentBoardId = params.boardId;
  const currentNotepadId = params.notepadId;

  const { data: boards = [] } = useBoards(currentProjectId);
  const { data: notepads = [] } = useNotepads(currentProjectId);
  const favoriteNotepads = notepads.filter((n) => Boolean(n.isFavorite));
  const { data: projectTags = [] } = useProjectTags(currentProjectId);
  const { data: myTasks = [] } = useMyTasks({ status: 'open' });
  const { data: members = [] } = useMembers();
  const { data: trashData } = useTrash(currentProjectId);

  const createBoardMutation = useCreateBoard();
  const deleteBoardMutation = useDeleteBoard();
  const queryClient = useQueryClient();

  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const signOutMutation = useSignOut();

  // Due tasks calculation
  const todayEnd = new Date().setHours(24, 0, 0, 0);
  const dueTasks = myTasks.filter((t) => t.dueDate !== null && t.dueDate < todayEnd);
  const badgeCount = dueTasks.length;

  const isOverviewActive = currentProjectId
    ? pathname === `/p/${currentProjectId}` || pathname === `/p/${currentProjectId}/`
    : pathname === '/';

  // Active rail tab selection state
  const getInitialRailTab = (): RailTab => {
    if (pathname.startsWith('/my-tasks')) return 'tasks';
    if (pathname.startsWith('/settings')) return 'members';
    if (currentProjectId && pathname.startsWith(`/p/${currentProjectId}/trash`)) return 'trash';
    if (currentBoardId) return 'boards';
    if (currentNotepadId) return 'notepads';
    return 'overview';
  };

  const [activeRailTab, setActiveRailTab] = useState<RailTab>(getInitialRailTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'due'>('all');

  // Synchronize rail tab when URL changes
  useEffect(() => {
    if (pathname.startsWith('/my-tasks')) {
      setActiveRailTab('tasks');
    } else if (pathname.startsWith('/settings')) {
      setActiveRailTab('members');
    } else if (currentProjectId && pathname.startsWith(`/p/${currentProjectId}/trash`)) {
      setActiveRailTab('trash');
    } else if (currentBoardId) {
      setActiveRailTab('boards');
    } else if (currentNotepadId) {
      setActiveRailTab('notepads');
    } else if (isOverviewActive) {
      setActiveRailTab('overview');
    }
  }, [pathname, currentProjectId, currentBoardId, currentNotepadId, isOverviewActive]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    if (accountMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [accountMenuOpen]);

  const [notepadsOpen, setNotepadsOpen] = useState(() => {
    try {
      const val = localStorage.getItem('sidebar:notepads:open');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });
  const [boardsOpen, setBoardsOpen] = useState(() => {
    try {
      const val = localStorage.getItem('sidebar:boards:open');
      return val !== null ? val === 'true' : true;
    } catch {
      return true;
    }
  });

  // Resizable Tier-2 secondary panel width
  const [secondaryPanelWidth, setSecondaryPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('sidebar:secondary-width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 220 && val <= 480) return val;
      }
    } catch {
      /* ignore */
    }
    return 260;
  });
  const [isResizingSecondary, setIsResizingSecondary] = useState(false);
  const secondaryResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    if (!isResizingSecondary) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!secondaryResizeRef.current) return;
      const delta = e.clientX - secondaryResizeRef.current.startX;
      const newWidth = Math.max(220, Math.min(480, secondaryResizeRef.current.startWidth + delta));
      setSecondaryPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSecondary(false);
      secondaryResizeRef.current = null;
      try {
        localStorage.setItem('sidebar:secondary-width', String(secondaryPanelWidth));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSecondary, secondaryPanelWidth]);

  const toggleNotepads = () => {
    setNotepadsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar:notepads:open', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleBoards = () => {
    setBoardsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar:boards:open', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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
    onSuccess: (data: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notepads', currentProjectId] });
      if (currentProjectId && data.id) {
        navigate({
          to: '/p/$projectId/notepads/$notepadId',
          params: { projectId: currentProjectId, notepadId: data.id },
        });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create notepad');
    },
  });

  const openPalette = (query?: string) => {
    window.dispatchEvent(
      new CustomEvent('burrow:open-palette', query ? { detail: { query } } : undefined),
    );
  };

  // Search filtering in secondary panel
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const searchMatchesNotepads = normalizedQuery
    ? notepads.filter((n) => (n.title || 'Untitled').toLowerCase().includes(normalizedQuery))
    : notepads.slice(0, 10);
  const searchMatchesBoards = normalizedQuery
    ? boards.filter((b) => b.name.toLowerCase().includes(normalizedQuery))
    : boards.slice(0, 8);
  const searchMatchesTags = normalizedQuery
    ? projectTags.filter((t) => t.name.toLowerCase().includes(normalizedQuery))
    : projectTags.slice(0, 8);

  const displayedTasks = taskFilter === 'due' ? dueTasks : myTasks;

  const renderAccountMenu = () => (
    <div className="absolute bottom-full left-0 mb-2 w-60 bg-surface border border-line theme-radius-md p-1 z-50 text-xs">
      <div className="px-3 py-2 border-b border-hair">
        <div className="font-semibold text-text truncate">{me?.user?.name || 'Account'}</div>
        {me?.user?.email && <div className="text-[11px] text-muted truncate">{me.user.email}</div>}
        {me?.role && (
          <div className="mt-1">
            <span className="inline-block px-1.5 py-0.5 text-[9px] uppercase font-mono tracking-wider bg-hi text-muted border border-hair theme-radius-xs">
              {me.role}
            </span>
          </div>
        )}
      </div>

      <div className="py-1">
        <button
          type="button"
          onClick={() => {
            setAccountMenuOpen(false);
            navigate({ to: '/settings' });
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-hi theme-radius-xs transition text-left cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Settings</span>
        </button>
        {me?.role === 'owner' && (
          <button
            type="button"
            onClick={() => {
              setAccountMenuOpen(false);
              navigate({ to: '/settings/members' });
            }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-hi theme-radius-xs transition text-left cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workspace Members</span>
          </button>
        )}
      </div>

      <div className="border-t border-hair py-1">
        <div className="px-3 py-1 text-[10px] font-eyebrow">Theme</div>
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => {
              setTheme(opt);
              toast.success(`Theme: ${THEME_LABELS[opt]}`);
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted hover:text-text hover:bg-hi theme-radius-xs transition text-left cursor-pointer"
          >
            <span>{THEME_LABELS[opt]}</span>
            {theme === opt && <Check className="w-3.5 h-3.5 text-accent" />}
          </button>
        ))}
      </div>

      <div className="border-t border-hair pt-1">
        <button
          type="button"
          onClick={() => {
            setAccountMenuOpen(false);
            setConfirmSignOut(true);
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-hi theme-radius-xs transition text-left cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isModern ? (
        <aside className="w-[232px] h-screen flex flex-col bg-side text-side-text border-r border-hair py-3.5 px-2 gap-0.5 select-none">
          {/* Top project header */}
          <div className="flex items-center justify-between px-2.5 pt-0.5 pb-3 gap-1">
            <div className="flex-1 min-w-0">
              <ProjectSwitcher currentProjectId={currentProjectId} />
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <NotificationsBell projectId={currentProjectId} />
              {onCloseMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="md:hidden flex h-8 w-8 items-center justify-center text-muted hover:text-text hover:bg-hi theme-radius-md transition"
                  aria-label="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search button */}
          <button
            type="button"
            onClick={() => openPalette()}
            aria-label="Search or command"
            className="flex items-center gap-2 h-8 theme-radius-md border border-line px-2.5 text-muted text-[13px] mb-2 hover:border-muted/40 transition cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="bg-hi theme-radius-xs px-1.5 py-0.5 text-[11px] font-sans">⌘K</kbd>
          </button>

          {/* Primary nav items */}
          {currentProjectId ? (
            <Link
              to="/p/$projectId"
              params={{ projectId: currentProjectId }}
              className={`flex items-center gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] transition ${
                isOverviewActive
                  ? 'bg-hi text-hi-ink font-medium'
                  : 'text-muted hover:text-text hover:bg-hi'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </Link>
          ) : (
            <Link
              to="/"
              className={`flex items-center gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] transition ${
                isOverviewActive
                  ? 'bg-hi text-hi-ink font-medium'
                  : 'text-muted hover:text-text hover:bg-hi'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>Overview</span>
            </Link>
          )}

          <Link
            to="/my-tasks"
            className={`flex items-center justify-between gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] transition ${
              pathname.startsWith('/my-tasks')
                ? 'bg-hi text-hi-ink font-medium'
                : 'text-muted hover:text-text hover:bg-hi'
            }`}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <Inbox className="w-4 h-4 shrink-0" />
              <span className="truncate">My tasks</span>
            </span>
            {badgeCount > 0 && (
              <Badge tone="neutral" className="min-w-[18px] justify-center">
                {badgeCount}
              </Badge>
            )}
          </Link>

          {/* Scrollable sections */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {/* Favorites */}
            <div>
              <div className="px-2.5 pt-4 pb-1.5 font-eyebrow flex items-center justify-between">
                <span>Favorites</span>
              </div>
              <div id="sidebar-favorites-list" className="space-y-0.5">
                {favoriteNotepads.length === 0 ? (
                  <div className="px-2.5 py-1 text-xs text-muted italic">
                    No favorited notepads yet
                  </div>
                ) : (
                  favoriteNotepads.map((np) => {
                    const isActive = np.id === currentNotepadId;
                    return (
                      <Link
                        key={np.id}
                        to="/p/$projectId/notepads/$notepadId"
                        params={{
                          projectId: currentProjectId!,
                          notepadId: np.id,
                        }}
                        className={`flex items-center gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] transition min-w-0 ${
                          isActive
                            ? 'bg-hi text-hi-ink font-medium'
                            : 'text-muted hover:bg-hi hover:text-text'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span className="truncate">{np.title || 'Untitled'}</span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Notepads */}
            <div>
              <div className="px-2.5 pt-4 pb-1.5 font-eyebrow flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleNotepads}
                  className="flex items-center gap-1 hover:text-text transition focus:outline-none cursor-pointer"
                  aria-expanded={notepadsOpen}
                  title={notepadsOpen ? 'Collapse Notepads' : 'Expand Notepads'}
                >
                  <span>Notepads</span>
                </button>
                {currentProjectId && me?.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!notepadsOpen) setNotepadsOpen(true);
                      createRootNotepad.mutate();
                    }}
                    className="flex h-5 w-5 items-center justify-center hover:bg-hi text-muted hover:text-text theme-radius-xs transition cursor-pointer"
                    title="New notepad"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {notepadsOpen && (
                <div id="sidebar-notepad-tree" className="space-y-0.5">
                  {currentProjectId && <NotepadTree projectId={currentProjectId} />}
                </div>
              )}
            </div>

            {/* Boards */}
            <div>
              <div className="px-2.5 pt-4 pb-1.5 font-eyebrow flex items-center justify-between">
                <button
                  type="button"
                  onClick={toggleBoards}
                  className="flex items-center gap-1 hover:text-text transition focus:outline-none cursor-pointer"
                  aria-expanded={boardsOpen}
                  title={boardsOpen ? 'Collapse Boards' : 'Expand Boards'}
                >
                  <span>Boards</span>
                </button>
                {currentProjectId && me?.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!boardsOpen) setBoardsOpen(true);
                      setCreateBoardOpen(true);
                    }}
                    className="flex h-5 w-5 items-center justify-center hover:bg-hi text-muted hover:text-text theme-radius-xs transition cursor-pointer"
                    title="Create Board"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {boardsOpen && (
                <div id="sidebar-boards-list" className="space-y-0.5">
                  {boards.length === 0 ? (
                    <div className="px-2.5 py-1 text-xs text-muted italic">No boards yet</div>
                  ) : (
                    boards.map((b) => {
                      const isActive = b.id === currentBoardId;
                      return (
                        <div
                          key={b.id}
                          className="group relative flex items-center justify-between"
                        >
                          <Link
                            to="/p/$projectId/boards/$boardId"
                            params={{
                              projectId: currentProjectId!,
                              boardId: b.id,
                            }}
                            className={`flex-1 flex items-center gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] transition min-w-0 ${
                              isActive
                                ? 'bg-hi text-hi-ink font-medium'
                                : 'text-muted hover:bg-hi hover:text-text'
                            }`}
                          >
                            <Kanban className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </Link>
                          {me?.role !== 'viewer' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmDeleteBoard({ id: b.id, name: b.name });
                              }}
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex h-7 w-7 items-center justify-center theme-radius-xs text-muted hover:bg-hi hover:text-[var(--danger)] transition shrink-0 mr-1 cursor-pointer"
                              title="Delete board to Trash"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Project Tags */}
            {projectTags.length > 0 && (
              <div>
                <div className="px-2.5 pt-4 pb-1.5 font-eyebrow">
                  <span>Tags</span>
                </div>
                <div className="space-y-0.5">
                  {projectTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => openPalette(`#${tag.name}`)}
                      className="w-full flex items-center gap-2.5 px-2.5 h-8 theme-radius-md text-[13px] text-muted hover:bg-hi hover:text-text transition text-left cursor-pointer"
                    >
                      <StatusDiamond color={tag.color || '#a855f7'} size={8} />
                      <span className="truncate">#{tag.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom links */}
          {me?.role === 'owner' && (
            <Link
              to="/settings/members"
              className="h-8 px-2.5 theme-radius-md text-[13px] text-muted hover:text-text hover:bg-hi flex items-center gap-2.5 transition"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Workspace Members</span>
            </Link>
          )}
          {currentProjectId && (
            <Link
              to="/p/$projectId/trash"
              params={{ projectId: currentProjectId }}
              className="h-8 px-2.5 theme-radius-md text-[13px] text-muted hover:text-text hover:bg-hi flex items-center gap-2.5 transition"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Trash</span>
            </Link>
          )}

          {/* User footer */}
          <div
            className="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-hair px-2.5 text-[13px] relative"
            ref={accountMenuRef}
          >
            <button
              type="button"
              onClick={() => setAccountMenuOpen(!accountMenuOpen)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left hover:text-text transition cursor-pointer"
              title="Account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              <Avatar
                name={me?.user?.name || 'Account'}
                size="xs"
                className="w-[22px] h-[22px] text-[10px]"
              />
              <span className="truncate font-medium">{me?.user?.name || 'Account'}</span>
            </button>
            <div className="flex items-center gap-0.5">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => setConfirmSignOut(true)}
                className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center theme-radius-md text-muted hover:text-danger hover:bg-hi transition cursor-pointer"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            {accountMenuOpen && renderAccountMenu()}
          </div>
        </aside>
      ) : (
        <aside className="h-screen flex bg-side text-side-text select-none">
          {/* ================================================================= */}
          {/* Tier 1: 64px Left Icon Rail                                      */}
          {/* ================================================================= */}
          <div className="w-16 shrink-0 bg-side border-r border-hair py-3.5 px-3 flex flex-col items-center gap-1.5">
            {/* Top Logo / Home */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('overview');
                if (currentProjectId) {
                  navigate({ to: '/p/$projectId', params: { projectId: currentProjectId } });
                } else {
                  navigate({ to: '/' });
                }
              }}
              className="w-[38px] h-[38px] clip-hex bg-accent text-accent-ink flex items-center justify-center text-base font-display mb-3 shrink-0 cursor-pointer"
              title="Burrow Overview"
              aria-label="Burrow Overview"
            >
              B
            </button>

            {/* 1. Search */}
            <button
              type="button"
              onClick={() => setActiveRailTab('search')}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'search'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="Search"
              aria-label="Search"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* 2. Overview */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('overview');
                if (currentProjectId) {
                  navigate({ to: '/p/$projectId', params: { projectId: currentProjectId } });
                } else {
                  navigate({ to: '/' });
                }
              }}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'overview'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="Overview"
              aria-label="Overview"
            >
              <Home className="w-[18px] h-[18px]" />
            </button>

            {/* 3. My Tasks */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('tasks');
                navigate({ to: '/my-tasks' });
              }}
              className={`relative w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'tasks'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="My Tasks"
              aria-label="My Tasks"
            >
              <Inbox className="w-[18px] h-[18px]" />
              {badgeCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 bg-accent text-accent-ink text-[9px] font-bold flex items-center justify-center">
                  {badgeCount}
                </span>
              )}
            </button>

            {/* 4. Notepads */}
            <button
              type="button"
              onClick={() => setActiveRailTab('notepads')}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'notepads'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="Notepads"
              aria-label="Notepads"
            >
              <FileText className="w-[18px] h-[18px]" />
            </button>

            {/* 5. Boards */}
            <button
              type="button"
              onClick={() => setActiveRailTab('boards')}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'boards'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="Boards"
              aria-label="Boards"
            >
              <Kanban className="w-[18px] h-[18px]" />
            </button>

            <div className="flex-1" />

            {/* 6. Members & Settings */}
            <button
              type="button"
              onClick={() => {
                setActiveRailTab('members');
                navigate({ to: '/settings/members' });
              }}
              className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                activeRailTab === 'members'
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:text-text hover:bg-hi'
              }`}
              title="Members & Settings"
              aria-label="Members & Settings"
            >
              <Users className="w-[18px] h-[18px]" />
            </button>

            {/* 7. Trash */}
            {currentProjectId && (
              <button
                type="button"
                onClick={() => {
                  setActiveRailTab('trash');
                  navigate({ to: '/p/$projectId/trash', params: { projectId: currentProjectId } });
                }}
                className={`w-10 h-10 flex items-center justify-center transition cursor-pointer ${
                  activeRailTab === 'trash'
                    ? 'bg-accent text-accent-ink'
                    : 'text-ink-muted hover:text-text hover:bg-hi'
                }`}
                title="Trash"
                aria-label="Trash"
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Theme Toggle */}
            <ThemeToggle className="w-10 h-10 md:w-10 md:h-10" />

            {/* Account Avatar */}
            <div className="mt-1.5 relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                className="flex items-center justify-center cursor-pointer"
                title="Account menu"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                <Avatar
                  name={me?.user?.name || 'Account'}
                  size="sm"
                  className="w-[30px] h-[30px] text-[10px] font-extrabold cursor-pointer"
                />
              </button>
              {accountMenuOpen && renderAccountMenu()}
            </div>
          </div>

          {/* ================================================================= */}
          {/* Tier 2: Contextual Panel (Changes based on Left Rail, resizable)   */}
          {/* ================================================================= */}
          <div
            style={{ width: `${secondaryPanelWidth}px` }}
            className={`relative shrink-0 bg-side border-r border-hair py-3.5 px-2 flex flex-col text-side-text ${
              isResizingSecondary ? 'select-none' : 'transition-[width] duration-75'
            }`}
          >
            {/* Resizer Handle on right border */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar panel"
              title="Drag to resize panel, double-click to reset"
              onMouseDown={(e) => {
                e.preventDefault();
                secondaryResizeRef.current = { startX: e.clientX, startWidth: secondaryPanelWidth };
                setIsResizingSecondary(true);
              }}
              onDoubleClick={() => {
                setSecondaryPanelWidth(260);
                try {
                  localStorage.setItem('sidebar:secondary-width', '260');
                } catch {
                  /* ignore */
                }
              }}
              className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize hover:bg-accent/40 active:bg-accent transition z-20"
            />

            {/* ------------------------------------------------------------- */}
            {/* Panel 1: SEARCH                                               */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'search' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-2 pt-0.5 pb-2.5">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
                    <input
                      type="text"
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Quick filter…"
                      className="w-full h-8 pl-8 pr-2 bg-surface border border-line text-xs text-text placeholder:text-ink-muted focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 px-1">
                  {/* Matching Notepads */}
                  {searchMatchesNotepads.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 font-eyebrow flex items-center justify-between">
                        <span>Notepads</span>
                        <span>{searchMatchesNotepads.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {searchMatchesNotepads.map((np) => (
                          <Link
                            key={np.id}
                            to="/p/$projectId/notepads/$notepadId"
                            params={{ projectId: currentProjectId!, notepadId: np.id }}
                            className="flex items-center gap-2 h-7 px-2 text-xs text-ink-muted hover:text-text hover:bg-hi truncate"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0 text-accent" />
                            <span className="truncate">{np.title || 'Untitled'}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Boards */}
                  {searchMatchesBoards.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 font-eyebrow flex items-center justify-between">
                        <span>Boards</span>
                        <span>{searchMatchesBoards.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {searchMatchesBoards.map((b) => (
                          <Link
                            key={b.id}
                            to="/p/$projectId/boards/$boardId"
                            params={{ projectId: currentProjectId!, boardId: b.id }}
                            className="flex items-center gap-2 h-7 px-2 text-xs text-ink-muted hover:text-text hover:bg-hi truncate"
                          >
                            <Kanban className="w-3.5 h-3.5 shrink-0 text-accent" />
                            <span className="truncate">{b.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Tags */}
                  {searchMatchesTags.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 font-eyebrow flex items-center justify-between">
                        <span>Tags</span>
                        <span>{searchMatchesTags.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {searchMatchesTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => openPalette(`#${tag.name}`)}
                            className="w-full flex items-center gap-2 h-7 px-2 text-xs text-ink-muted hover:text-text hover:bg-hi text-left truncate cursor-pointer"
                          >
                            <StatusDiamond color={tag.color || '#a855f7'} size={6} />
                            <span className="truncate">#{tag.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchMatchesNotepads.length === 0 &&
                    searchMatchesBoards.length === 0 &&
                    searchMatchesTags.length === 0 && (
                      <div className="px-2 py-4 text-xs text-ink-muted italic text-center">
                        No matches found
                      </div>
                    )}
                </div>

                <button
                  type="button"
                  onClick={() => openPalette(searchQuery || undefined)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 px-2 bg-surface2 border border-line text-xs font-semibold text-text hover:bg-hi transition cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Open ⌘K Palette</span>
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 2: OVERVIEW                                             */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'overview' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 gap-1">
                  <div className="flex-1 min-w-0">
                    <ProjectSwitcher currentProjectId={currentProjectId} />
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <NotificationsBell projectId={currentProjectId} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {/* Favorites section */}
                  <div>
                    <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                      <span>Favorites</span>
                      <span>{favoriteNotepads.length}</span>
                    </div>
                    <div id="sidebar-favorites-list" className="space-y-0.5">
                      {favoriteNotepads.length === 0 ? (
                        <div className="px-3 py-1 text-xs text-ink-muted italic">
                          No favorited notepads yet
                        </div>
                      ) : (
                        favoriteNotepads.map((np) => {
                          const isActive = np.id === currentNotepadId;
                          return (
                            <Link
                              key={np.id}
                              to="/p/$projectId/notepads/$notepadId"
                              params={{ projectId: currentProjectId!, notepadId: np.id }}
                              title={np.title || 'Untitled'}
                              className={`flex items-center gap-2.5 h-[34px] px-3 text-[13px] transition ${
                                isActive
                                  ? 'bg-hi text-hi-ink font-bold'
                                  : 'text-ink-muted font-medium hover:bg-hi hover:text-side-text'
                              }`}
                            >
                              <Star className="w-4 h-4 shrink-0 text-accent" />
                              <span className="flex-1 truncate">{np.title || 'Untitled'}</span>
                              {isActive && <span className="diamond-dot" />}
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Notepads summary */}
                  <div>
                    <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                      <button
                        type="button"
                        onClick={toggleNotepads}
                        className="flex items-center gap-1 hover:text-text transition focus:outline-none cursor-pointer"
                        aria-expanded={notepadsOpen}
                      >
                        <span>Notepads</span>
                      </button>
                      <span>{notepads.length}</span>
                    </div>
                    {notepadsOpen && (
                      <div id="sidebar-notepad-tree" className="space-y-0.5">
                        {currentProjectId && <NotepadTree projectId={currentProjectId} />}
                      </div>
                    )}
                  </div>

                  {/* Boards summary */}
                  <div>
                    <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                      <button
                        type="button"
                        onClick={toggleBoards}
                        className="flex items-center gap-1 hover:text-text transition focus:outline-none cursor-pointer"
                        aria-expanded={boardsOpen}
                      >
                        <span>Boards</span>
                      </button>
                      <span>{boards.length}</span>
                    </div>
                    {boardsOpen && (
                      <div id="sidebar-boards-list" className="space-y-0.5">
                        {boards.slice(0, 5).map((b) => (
                          <Link
                            key={b.id}
                            to="/p/$projectId/boards/$boardId"
                            params={{ projectId: currentProjectId!, boardId: b.id }}
                            title={b.name}
                            className="flex items-center gap-2.5 h-[32px] px-3 text-[13px] text-ink-muted hover:bg-hi hover:text-side-text truncate"
                          >
                            <Kanban className="w-4 h-4 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {projectTags.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                        <span>Tags</span>
                        <span>{projectTags.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {projectTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => openPalette(`#${tag.name}`)}
                            className="w-full flex items-center gap-2.5 h-[34px] px-3 text-[13px] font-medium text-ink-muted hover:bg-hi hover:text-side-text transition text-left cursor-pointer"
                          >
                            <StatusDiamond color={tag.color || '#a855f7'} size={8} />
                            <span className="truncate">#{tag.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {currentProjectId && me?.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={() => createRootNotepad.mutate()}
                    className="mt-2 w-full flex items-center gap-2 h-9 px-3 border border-dashed border-line text-ink-muted hover:text-text hover:border-accent text-[13px] font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New notepad</span>
                  </button>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 3: NOTEPADS                                             */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'notepads' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 gap-1">
                  <div className="flex-1 min-w-0">
                    <ProjectSwitcher currentProjectId={currentProjectId} />
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <NotificationsBell projectId={currentProjectId} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {/* Favorites section */}
                  {favoriteNotepads.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                        <span>Favorites</span>
                        <span>{favoriteNotepads.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {favoriteNotepads.map((np) => {
                          const isActive = np.id === currentNotepadId;
                          return (
                            <Link
                              key={np.id}
                              to="/p/$projectId/notepads/$notepadId"
                              params={{ projectId: currentProjectId!, notepadId: np.id }}
                              title={np.title || 'Untitled'}
                              className={`flex items-center gap-2.5 h-[34px] px-3 text-[13px] transition ${
                                isActive
                                  ? 'bg-hi text-hi-ink font-bold'
                                  : 'text-ink-muted font-medium hover:bg-hi hover:text-side-text'
                              }`}
                            >
                              <Star className="w-4 h-4 shrink-0 text-accent" />
                              <span className="flex-1 truncate">{np.title || 'Untitled'}</span>
                              {isActive && <span className="diamond-dot" />}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Full Notepads Tree */}
                  <div>
                    <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                      <span>All Notepads</span>
                      <div className="flex items-center gap-1.5">
                        <span>{notepads.length}</span>
                        {currentProjectId && me?.role !== 'viewer' && (
                          <button
                            type="button"
                            onClick={() => createRootNotepad.mutate()}
                            className="flex h-5 w-5 items-center justify-center hover:bg-hi text-ink-muted hover:text-text transition cursor-pointer"
                            title="New notepad"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      {currentProjectId && <NotepadTree projectId={currentProjectId} />}
                    </div>
                  </div>
                </div>

                {currentProjectId && me?.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={() => createRootNotepad.mutate()}
                    className="mt-2 w-full flex items-center gap-2 h-9 px-3 border border-dashed border-line text-ink-muted hover:text-text hover:border-accent text-[13px] font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New notepad</span>
                  </button>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 4: BOARDS                                               */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'boards' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 gap-1">
                  <div className="flex-1 min-w-0">
                    <ProjectSwitcher currentProjectId={currentProjectId} />
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <NotificationsBell projectId={currentProjectId} />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {/* Boards section */}
                  <div>
                    <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                      <span>Boards</span>
                      <div className="flex items-center gap-1.5">
                        <span>{boards.length}</span>
                        {currentProjectId && me?.role !== 'viewer' && (
                          <button
                            type="button"
                            onClick={() => setCreateBoardOpen(true)}
                            className="flex h-5 w-5 items-center justify-center hover:bg-hi text-ink-muted hover:text-text transition cursor-pointer"
                            title="Create Board"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      {boards.length === 0 ? (
                        <div className="px-3 py-3 text-xs text-ink-muted italic">
                          No boards created yet
                        </div>
                      ) : (
                        boards.map((b) => {
                          const isActive = b.id === currentBoardId;
                          return (
                            <div
                              key={b.id}
                              className="group relative flex items-center justify-between"
                            >
                              <Link
                                to="/p/$projectId/boards/$boardId"
                                params={{ projectId: currentProjectId!, boardId: b.id }}
                                title={b.name}
                                className={`flex-1 flex items-center gap-2.5 h-[34px] px-3 text-[13px] transition min-w-0 pr-8 ${
                                  isActive
                                    ? 'bg-hi text-hi-ink font-bold'
                                    : 'text-ink-muted font-medium hover:bg-hi hover:text-side-text'
                                }`}
                              >
                                <Kanban className="w-4 h-4 shrink-0" />
                                <span className="flex-1 truncate">{b.name}</span>
                                {isActive && <span className="diamond-dot group-hover:hidden" />}
                              </Link>
                              {me?.role !== 'viewer' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setConfirmDeleteBoard({ id: b.id, name: b.name });
                                  }}
                                  className="hidden group-hover:flex absolute right-1.5 top-1/2 -translate-y-1/2 h-6 w-6 items-center justify-center theme-radius-xs bg-side/95 text-ink-muted hover:bg-hi hover:text-[var(--danger)] transition shrink-0 cursor-pointer z-10"
                                  title="Delete board to Trash"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Workflow Tags */}
                  {projectTags.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-3 pt-4 pb-1.5 font-eyebrow">
                        <span>Workflow Tags</span>
                        <span>{projectTags.length}</span>
                      </div>
                      <div className="space-y-0.5">
                        {projectTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => openPalette(`#${tag.name}`)}
                            className="w-full flex items-center gap-2.5 h-[34px] px-3 text-[13px] font-medium text-ink-muted hover:bg-hi hover:text-side-text transition text-left cursor-pointer"
                          >
                            <StatusDiamond color={tag.color || '#a855f7'} size={8} />
                            <span className="truncate">#{tag.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {currentProjectId && me?.role !== 'viewer' && (
                  <button
                    type="button"
                    onClick={() => setCreateBoardOpen(true)}
                    className="mt-2 w-full flex items-center gap-2 h-9 px-3 border border-dashed border-line text-ink-muted hover:text-text hover:border-accent text-[13px] font-semibold transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New board</span>
                  </button>
                )}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 5: MY TASKS                                             */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'tasks' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 text-[14px] font-display text-side-text">
                  <span className="flex items-center gap-2">
                    <Inbox className="w-4 h-4 text-accent" />
                    <span>My Tasks</span>
                  </span>
                  {badgeCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-accent text-accent-ink text-[10px] font-bold">
                      {badgeCount} due
                    </span>
                  )}
                </div>

                {/* Filter pills */}
                <div className="px-2 pt-2 pb-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTaskFilter('all')}
                    className={`flex-1 py-1 text-[11px] font-semibold transition cursor-pointer text-center ${
                      taskFilter === 'all'
                        ? 'bg-hi text-hi-ink'
                        : 'bg-surface2 text-ink-muted hover:text-text'
                    }`}
                  >
                    All ({myTasks.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskFilter('due')}
                    className={`flex-1 py-1 text-[11px] font-semibold transition cursor-pointer text-center ${
                      taskFilter === 'due'
                        ? 'bg-accent text-accent-ink'
                        : 'bg-surface2 text-ink-muted hover:text-text'
                    }`}
                  >
                    Due ({dueTasks.length})
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1">
                  {displayedTasks.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-ink-muted italic text-center">
                      No active tasks
                    </div>
                  ) : (
                    displayedTasks.map((t) => (
                      <Link
                        key={t.id}
                        to="/p/$projectId/boards/$boardId"
                        params={{ projectId: t.projectId, boardId: t.boardId }}
                        search={{ cardId: t.id }}
                        title={t.title}
                        className="block px-3 py-2 text-xs hover:bg-hi text-ink-muted hover:text-text transition border-b border-hair/50"
                      >
                        <div className="font-semibold text-text truncate" title={t.title}>
                          {t.title}
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[11px] text-ink-muted mt-0.5">
                          <span className="truncate">{t.boardName}</span>
                          {t.dueDate && (
                            <span
                              className={`flex items-center gap-0.5 shrink-0 ${
                                t.dueDate < todayEnd ? 'text-[var(--danger)] font-bold' : ''
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {new Date(t.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>

                <Link
                  to="/my-tasks"
                  className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 px-2 bg-surface2 border border-line text-xs font-semibold text-text hover:bg-hi transition"
                >
                  <Inbox className="w-3.5 h-3.5 text-accent" />
                  <span>Open Tasks Board</span>
                </Link>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 6: MEMBERS & WORKSPACE                                  */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'members' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 text-[14px] font-display text-side-text">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" />
                    <span>Workspace</span>
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pt-2">
                  <div className="space-y-0.5">
                    <Link
                      to="/settings/members"
                      className={`flex items-center gap-2.5 h-[34px] px-3 text-[13px] transition ${
                        pathname.startsWith('/settings/members')
                          ? 'bg-hi text-hi-ink font-bold'
                          : 'text-ink-muted font-medium hover:bg-hi hover:text-side-text'
                      }`}
                    >
                      <Users className="w-4 h-4 shrink-0 text-accent" />
                      <span>Workspace Members</span>
                    </Link>
                    <Link
                      to="/settings"
                      className={`flex items-center gap-2.5 h-[34px] px-3 text-[13px] transition ${
                        pathname === '/settings'
                          ? 'bg-hi text-hi-ink font-bold'
                          : 'text-ink-muted font-medium hover:bg-hi hover:text-side-text'
                      }`}
                    >
                      <Settings className="w-4 h-4 shrink-0" />
                      <span>Project Settings</span>
                    </Link>
                  </div>

                  {/* Members list */}
                  <div>
                    <div className="px-3 pb-1 font-eyebrow flex items-center justify-between">
                      <span>Members</span>
                      <span>{members.length}</span>
                    </div>
                    <div className="space-y-1">
                      {members.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs text-text hover:bg-hi"
                        >
                          <Avatar
                            name={m.name || 'Member'}
                            size="xs"
                            className="w-5 h-5 text-[9px]"
                          />
                          <span className="flex-1 truncate">{m.name || 'Member'}</span>
                          <span className="text-[10px] uppercase font-mono px-1 py-0.5 bg-hi text-ink-muted">
                            {m.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 px-2 bg-surface2 border border-line text-xs font-semibold text-danger hover:bg-hi transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Panel 7: TRASH                                                */}
            {/* ------------------------------------------------------------- */}
            {activeRailTab === 'trash' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 pt-0.5 pb-2 text-[14px] font-display text-side-text">
                  <span className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4 text-ink-muted" />
                    <span>Trash</span>
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pt-2">
                  <div>
                    <div className="px-3 pb-1 font-eyebrow flex items-center justify-between">
                      <span>Deleted Notepads</span>
                      <span>{trashData?.notepads?.length ?? 0}</span>
                    </div>
                    <div className="space-y-0.5">
                      {!trashData?.notepads?.length ? (
                        <div className="px-3 py-1 text-xs text-ink-muted italic">
                          No deleted notepads
                        </div>
                      ) : (
                        trashData.notepads.slice(0, 6).map((np) => (
                          <div
                            key={np.id}
                            title={np.title}
                            className="flex items-center gap-2 px-3 py-1 text-xs text-ink-muted truncate"
                          >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{np.title}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="px-3 pb-1 font-eyebrow flex items-center justify-between">
                      <span>Deleted Boards</span>
                      <span>{trashData?.boards?.length ?? 0}</span>
                    </div>
                    <div className="space-y-0.5">
                      {!trashData?.boards?.length ? (
                        <div className="px-3 py-1 text-xs text-ink-muted italic">
                          No deleted boards
                        </div>
                      ) : (
                        trashData.boards.slice(0, 6).map((b) => (
                          <div
                            key={b.id}
                            title={b.name}
                            className="flex items-center gap-2 px-3 py-1 text-xs text-ink-muted truncate"
                          >
                            <Kanban className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="px-3 py-2 text-[11px] text-ink-muted bg-surface2 border border-line">
                    Items stay in trash until permanently deleted or restored.
                  </div>
                </div>

                {currentProjectId && (
                  <Link
                    to="/p/$projectId/trash"
                    params={{ projectId: currentProjectId }}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 h-8 px-2 bg-surface2 border border-line text-xs font-semibold text-text hover:bg-hi transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Open Trash View</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Confirmation & Prompt dialogs */}
      {confirmDeleteBoard && (
        <ConfirmDialog
          open
          title="Delete board"
          message={`Move "${confirmDeleteBoard.name}" to Trash? You can restore it from Trash if needed.`}
          confirmLabel="Delete to Trash"
          danger
          busy={deleteBoardMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteBoardMutation.mutateAsync(confirmDeleteBoard.id);
              if (confirmDeleteBoard.id === currentBoardId && currentProjectId) {
                navigate({ to: '/p/$projectId', params: { projectId: currentProjectId } });
              }
              setConfirmDeleteBoard(null);
            } catch (err: any) {
              toast.error(err?.message || 'Failed to delete board');
              setConfirmDeleteBoard(null);
            }
          }}
          onCancel={() => setConfirmDeleteBoard(null)}
        />
      )}

      <PromptDialog
        open={createBoardOpen}
        title="Create Board"
        message="Enter a name for the new board."
        defaultValue="Sprint Board"
        placeholder="Board name"
        confirmLabel="Create"
        busy={createBoardMutation.isPending}
        onConfirm={async (name) => {
          if (!currentProjectId) return;
          try {
            const res = await createBoardMutation.mutateAsync({
              projectId: currentProjectId,
              name,
            });
            setCreateBoardOpen(false);
            navigate({
              to: '/p/$projectId/boards/$boardId',
              params: {
                projectId: currentProjectId,
                boardId: res.id,
              },
            });
          } catch (err: any) {
            toast.error(err?.message || 'Failed to create board');
          }
        }}
        onCancel={() => setCreateBoardOpen(false)}
      />

      <ConfirmDialog
        open={confirmSignOut}
        title="Log out"
        message="Are you sure you want to log out of your account?"
        confirmLabel="Log out"
        danger={false}
        busy={signOutMutation.isPending}
        onConfirm={async () => {
          try {
            await signOutMutation.mutateAsync();
          } catch (err: any) {
            toast.error(err?.message || 'Failed to sign out');
            setConfirmSignOut(false);
          }
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </>
  );
}
