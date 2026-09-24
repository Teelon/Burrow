import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate, useParams } from '@tanstack/react-router';
import { Home, Kanban, Search, Settings, Trash2, Users } from 'lucide-react';
import { useBoards, useProjects, useRecentNotepads, useSearch } from '../lib/queries';
import { ModalShell } from './ui/ModalShell';
import { SegmentedControl } from './ui/SegmentedControl';

const ITEM_CLASSES =
  'flex flex-col gap-0.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'project' | 'all'>('project');

  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: projects = [] } = useProjects();
  const activeProject = projects.find((p) => p.id === projectId) || projects[0];
  const currentProjectId = activeProject?.id;

  const { data: recentNotepads = [] } = useRecentNotepads(currentProjectId);
  const { data: boards = [] } = useBoards(currentProjectId);
  const { data: searchResults = [], isLoading: isSearching } = useSearch(
    query,
    scope === 'project' ? currentProjectId : undefined,
    scope,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };

    const handleCustomOpen = () => setOpen(true);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('burrow:open-palette', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('burrow:open-palette', handleCustomOpen);
    };
  }, []);

  const handleSelect = (run: () => void) => {
    run();
    setOpen(false);
    setQuery('');
  };

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      onClose={() => setOpen(false)}
      title="Search and commands"
      className="w-full self-start mt-[8dvh] sm:max-w-xl"
    >
      <Command
        className="w-full flex flex-col"
        shouldFilter={false} // We handle search via FTS API
      >
        {/* Header & Search Input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--hair)]">
          <Search className="w-4 h-4 text-[var(--muted)] shrink-0" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search notepads, cards, or type a command…"
            className="flex-1 bg-transparent text-base sm:text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none"
            autoFocus
          />
          {/* Scope Toggle — geometric segmented control */}
          <SegmentedControl
            value={scope}
            onValueChange={(v) => setScope(v as 'project' | 'all')}
            options={[
              { value: 'project', label: 'Project' },
              { value: 'all', label: 'All' },
            ]}
            size="sm"
          />
        </div>

        {/* Results List */}
        <Command.List className="max-h-80 overflow-y-auto p-2 space-y-1">
          {isSearching && (
            <div className="p-4 text-center text-xs text-[var(--muted)]">Searching…</div>
          )}

          {query.trim().length > 0 && !isSearching && searchResults.length === 0 && (
            <Command.Empty className="p-6 text-center text-xs text-[var(--muted)]">
              No matching results found for "{query}".
            </Command.Empty>
          )}

          {/* FTS Search Results */}
          {query.trim().length > 0 && searchResults.length > 0 && (
            <Command.Group
              heading="Search Results"
              className="text-[11px] font-semibold text-[var(--muted)] px-2 py-1 uppercase tracking-wider"
            >
              {searchResults.map((item) => (
                <Command.Item
                  key={item.id}
                  onSelect={() =>
                    handleSelect(() => {
                      if (item.kind === 'notepad') {
                        navigate({
                          to: '/p/$projectId/notepads/$notepadId',
                          params: { projectId: item.projectId, notepadId: item.id },
                        });
                      } else {
                        // card: navigate to its project
                        navigate({
                          to: '/p/$projectId',
                          params: { projectId: item.projectId },
                        });
                      }
                    })
                  }
                  className={ITEM_CLASSES}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {item.icon || (item.kind === 'notepad' ? '📄' : '📋')}
                    </span>
                    <span className="font-semibold">{item.title || 'Untitled'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-[var(--surface2)] border border-[var(--line)] text-[var(--muted)] ml-auto">
                      {item.projectName}
                    </span>
                  </div>
                  {item.snippet && (
                    <div
                      className="text-[11px] text-[var(--muted)] pl-6 line-clamp-1"
                      dangerouslySetInnerHTML={{ __html: item.snippet }}
                    />
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Quick Navigation and Recent (shown when search query is empty) */}
          {query.trim().length === 0 && (
            <>
              {recentNotepads.length > 0 && (
                <Command.Group
                  heading="Recent Notepads"
                  className="text-[11px] font-semibold text-[var(--muted)] px-2 py-1 uppercase tracking-wider"
                >
                  {recentNotepads.slice(0, 4).map((np) => (
                    <Command.Item
                      key={np.id}
                      onSelect={() =>
                        handleSelect(() => {
                          if (!currentProjectId) return;
                          navigate({
                            to: '/p/$projectId/notepads/$notepadId',
                            params: { projectId: currentProjectId, notepadId: np.id },
                          });
                        })
                      }
                      className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                    >
                      <span className="text-sm">{np.icon || '📄'}</span>
                      <span className="font-medium truncate">{np.title || 'Untitled'}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group
                heading="Navigation"
                className="text-[11px] font-semibold text-[var(--muted)] px-2 py-1 uppercase tracking-wider mt-2"
              >
                {currentProjectId && (
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => {
                        navigate({
                          to: '/p/$projectId',
                          params: { projectId: currentProjectId },
                        });
                      })
                    }
                    className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                  >
                    <Home className="w-4 h-4 text-purple-500" />
                    <span>Project Overview</span>
                  </Command.Item>
                )}

                {boards.map((b) => (
                  <Command.Item
                    key={b.id}
                    onSelect={() =>
                      handleSelect(() => {
                        if (!currentProjectId) return;
                        navigate({
                          to: '/p/$projectId/boards/$boardId',
                          params: { projectId: currentProjectId, boardId: b.id },
                        });
                      })
                    }
                    className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                  >
                    <Kanban className="w-4 h-4 text-emerald-500" />
                    <span>Board: {b.name}</span>
                  </Command.Item>
                ))}

                {currentProjectId && (
                  <Command.Item
                    onSelect={() =>
                      handleSelect(() => {
                        navigate({
                          to: '/p/$projectId/trash',
                          params: { projectId: currentProjectId },
                        });
                      })
                    }
                    className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    <span>Trash</span>
                  </Command.Item>
                )}

                <Command.Item
                  onSelect={() =>
                    handleSelect(() => {
                      navigate({ to: '/settings/members' });
                    })
                  }
                  className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                >
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>Members & Invites</span>
                </Command.Item>

                <Command.Item
                  onSelect={() =>
                    handleSelect(() => {
                      navigate({ to: '/settings' });
                    })
                  }
                  className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] text-xs text-[var(--text)] cursor-pointer select-none data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-ink)]"
                >
                  <Settings className="w-4 h-4 text-[var(--muted)]" />
                  <span>Settings</span>
                </Command.Item>
              </Command.Group>
            </>
          )}
        </Command.List>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--hair)] flex items-center justify-between text-[11px] text-[var(--muted)]">
          <div>
            Use{' '}
            <kbd className="px-1 py-0.5 bg-[var(--surface2)] border border-[var(--line)]">↑</kbd>{' '}
            <kbd className="px-1 py-0.5 bg-[var(--surface2)] border border-[var(--line)]">↓</kbd> to
            navigate,{' '}
            <kbd className="px-1 py-0.5 bg-[var(--surface2)] border border-[var(--line)]">↵</kbd> to
            select
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-[var(--surface2)] border border-[var(--line)] font-mono">
              ESC
            </kbd>{' '}
            to close
          </div>
        </div>
      </Command>
    </ModalShell>
  );
}
