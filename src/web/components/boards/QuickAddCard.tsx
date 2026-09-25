import { useState, useRef, useEffect, useMemo } from 'react';
import * as chrono from 'chrono-node';
import { Calendar, FileText, Flag, Plus, Tag, User, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import { useCreateCard, useMembers } from '../../lib/queries';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface QuickAddCardProps {
  boardId: string;
  columnId: string;
  projectId: string;
  onClose?: () => void;
}

interface QuickAddChips {
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: { timestamp: number; label: string };
  assignees: Array<{ userId: string; name: string }>;
  tags: Array<{ tagId: string; name: string; color?: string | null }>;
  notepad?: { mode: 'new'; title?: string } | { mode: 'existing'; id: string; title: string };
}

export function QuickAddCard({ boardId, columnId, projectId, onClose }: QuickAddCardProps) {
  const [title, setTitle] = useState('');
  const [chips, setChips] = useState<QuickAddChips>({ assignees: [], tags: [] });
  const [menuMode, setMenuMode] = useState<'none' | 'slash' | 'at' | 'hash'>('none');
  const [menuQuery, setMenuQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [dateInputOpen, setDateInputOpen] = useState(false);
  const [dateInputValue, setDateInputValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const createCardMutation = useCreateCard();
  const { data: members = [] } = useMembers();

  const [availableTags, setAvailableTags] = useState<
    Array<{ id: string; name: string; color?: string | null }>
  >([]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tags`)
      .then((r) => r.ok && r.json())
      .then((data) => data && setAvailableTags(data))
      .catch(() => {});
  }, [projectId]);

  const cleanLastTrigger = (text: string) => {
    const lastSlash = text.lastIndexOf('/');
    const lastAt = text.lastIndexOf('@');
    const lastHash = text.lastIndexOf('#');
    const maxIdx = Math.max(lastSlash, lastAt, lastHash);
    if (maxIdx === -1) return text;
    return text.slice(0, maxIdx).trimEnd() + (maxIdx > 0 ? ' ' : '');
  };

  const selectPriority = (p: 'low' | 'medium' | 'high' | 'urgent') => {
    setChips((c) => ({ ...c, priority: p }));
    setTitle(cleanLastTrigger(title));
    setMenuMode('none');
    inputRef.current?.focus();
  };

  const selectDueDate = (text: string) => {
    const parsed = chrono.parseDate(text);
    if (parsed) {
      setChips((c) => ({
        ...c,
        dueDate: {
          timestamp: parsed.getTime(),
          label: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        },
      }));
    }
    setTitle(cleanLastTrigger(title));
    setDateInputOpen(false);
    setMenuMode('none');
    inputRef.current?.focus();
  };

  const selectAssignee = (userId: string, name: string) => {
    setChips((c) => {
      if (c.assignees.some((a) => a.userId === userId)) return c;
      return { ...c, assignees: [...c.assignees, { userId, name }] };
    });
    setTitle(cleanLastTrigger(title));
    setMenuMode('none');
    inputRef.current?.focus();
  };

  const selectTag = (tagId: string, name: string, color?: string | null) => {
    setChips((c) => {
      if (c.tags.some((t) => t.tagId === tagId)) return c;
      return { ...c, tags: [...c.tags, { tagId, name, color }] };
    });
    setTitle(cleanLastTrigger(title));
    setMenuMode('none');
    inputRef.current?.focus();
  };

  const createAndSelectTag = async (tagName: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName }),
      });
      if (res.ok) {
        const newTag = await res.json();
        setAvailableTags((prev) => [...prev, newTag]);
        selectTag(newTag.id, newTag.name, newTag.color);
      } else {
        selectTag(nanoid(), tagName, null);
      }
    } catch {
      selectTag(nanoid(), tagName, null);
    }
  };

  const slashCommands = useMemo(
    () => [
      {
        id: 'notepad',
        label: '/notepad',
        desc: 'Create new linked notepad',
        icon: FileText,
        action: () => {
          setChips((c) => ({ ...c, notepad: { mode: 'new' } }));
          setTitle(cleanLastTrigger(title));
          setMenuMode('none');
          inputRef.current?.focus();
        },
      },
      {
        id: 'due',
        label: '/due',
        desc: 'Set due date (e.g. tomorrow, Oct 12)',
        icon: Calendar,
        action: () => {
          setTitle(cleanLastTrigger(title));
          setDateInputOpen(true);
          setMenuMode('none');
        },
      },
      {
        id: 'priority',
        label: '/priority',
        desc: 'Set priority (urgent, high, medium, low)',
        icon: Flag,
        action: () => selectPriority('urgent'),
      },
      {
        id: 'urgent',
        label: '/urgent',
        desc: 'Set priority: Urgent',
        icon: Flag,
        action: () => selectPriority('urgent'),
      },
      {
        id: 'high',
        label: '/high',
        desc: 'Set priority: High',
        icon: Flag,
        action: () => selectPriority('high'),
      },
      {
        id: 'medium',
        label: '/medium',
        desc: 'Set priority: Medium',
        icon: Flag,
        action: () => selectPriority('medium'),
      },
      {
        id: 'low',
        label: '/low',
        desc: 'Set priority: Low',
        icon: Flag,
        action: () => selectPriority('low'),
      },
      {
        id: 'assign',
        label: '/assign',
        desc: 'Assign member (@)',
        icon: User,
        action: () => {
          setTitle(cleanLastTrigger(title) + '@');
          setMenuMode('at');
          setMenuQuery('');
          setSelectedIndex(0);
          inputRef.current?.focus();
        },
      },
      {
        id: 'tag',
        label: '/tag',
        desc: 'Add project tag (#)',
        icon: Tag,
        action: () => {
          setTitle(cleanLastTrigger(title) + '#');
          setMenuMode('hash');
          setMenuQuery('');
          setSelectedIndex(0);
          inputRef.current?.focus();
        },
      },
    ],
    [title],
  );

  const filteredSlashCommands = useMemo(() => {
    if (!menuQuery) return slashCommands;
    const q = menuQuery.toLowerCase();
    return slashCommands
      .filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(q) ||
          cmd.id.toLowerCase().includes(q) ||
          cmd.desc.toLowerCase().includes(q),
      )
      .sort((a, b) => {
        const aStart = a.id.startsWith(q) || a.label.slice(1).startsWith(q);
        const bStart = b.id.startsWith(q) || b.label.slice(1).startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return 0;
      });
  }, [slashCommands, menuQuery]);

  const filteredMembers = useMemo(() => {
    if (!menuQuery) return members;
    const q = menuQuery.toLowerCase();
    return members
      .filter((m) => {
        const name = (m.name || '').toLowerCase();
        const email = (m.email || '').toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .sort((a, b) => {
        const aName = (a.name || a.email || '').toLowerCase();
        const bName = (b.name || b.email || '').toLowerCase();
        const aStart = aName.startsWith(q);
        const bStart = bName.startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return 0;
      });
  }, [members, menuQuery]);

  const filteredTags = useMemo(() => {
    if (!menuQuery) return availableTags;
    const q = menuQuery.toLowerCase();
    return availableTags
      .filter((t) => t.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aStart = a.name.toLowerCase().startsWith(q);
        const bStart = b.name.toLowerCase().startsWith(q);
        if (aStart && !bStart) return -1;
        if (!aStart && bStart) return 1;
        return 0;
      });
  }, [availableTags, menuQuery]);

  const getActiveItemCount = () => {
    if (menuMode === 'slash') return filteredSlashCommands.length;
    if (menuMode === 'at') return filteredMembers.length;
    if (menuMode === 'hash') {
      const exactMatch = filteredTags.some((t) => t.name.toLowerCase() === menuQuery.toLowerCase());
      return filteredTags.length + (menuQuery.trim() && !exactMatch ? 1 : 0);
    }
    return 0;
  };

  const executeSelection = (index: number) => {
    if (menuMode === 'slash') {
      const item = filteredSlashCommands[index];
      if (item) item.action();
    } else if (menuMode === 'at') {
      const member = filteredMembers[index];
      if (member) {
        selectAssignee(member.userId, member.name || member.email || 'Member');
      }
    } else if (menuMode === 'hash') {
      if (index < filteredTags.length) {
        const tag = filteredTags[index];
        if (tag) selectTag(tag.id, tag.name, tag.color);
      } else if (menuQuery.trim()) {
        createAndSelectTag(menuQuery.trim());
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);

    // Check if ends with a trigger (either at start or preceded by space)
    const match = val.match(/(?:^|\s)([/@#])([^\s]*)$/);
    if (match) {
      const trigger = match[1];
      const query = match[2] || '';
      if (trigger === '/') setMenuMode('slash');
      else if (trigger === '@') setMenuMode('at');
      else if (trigger === '#') setMenuMode('hash');
      setMenuQuery(query);
      setSelectedIndex(0);
    } else {
      setMenuMode('none');
      setSelectedIndex(0);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (menuMode !== 'none') {
        e.preventDefault();
        setMenuMode('none');
      } else if (onClose) {
        onClose();
      }
      return;
    }

    if (menuMode !== 'none') {
      const count = getActiveItemCount();
      if (count > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % count);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + count) % count);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          executeSelection(selectedIndex);
          return;
        }
      }
    }

    if (e.key === 'Backspace' && title === '') {
      // Remove last chip
      if (chips.notepad) {
        setChips((c) => ({ ...c, notepad: undefined }));
      } else if (chips.tags.length > 0) {
        setChips((c) => ({ ...c, tags: c.tags.slice(0, -1) }));
      } else if (chips.assignees.length > 0) {
        setChips((c) => ({ ...c, assignees: c.assignees.slice(0, -1) }));
      } else if (chips.dueDate) {
        setChips((c) => ({ ...c, dueDate: undefined }));
      } else if (chips.priority) {
        setChips((c) => ({ ...c, priority: undefined }));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      await handleSave(e.shiftKey);
    }
  };

  const handleSave = async (keepOpen = false) => {
    let cleanTitle = title.trim();
    if (!cleanTitle || createCardMutation.isPending) return;

    // Extract inline priority if present: e.g. /urgent, /high, /medium, /low or /priority urgent
    let priority = chips.priority;
    const priorityMatch = cleanTitle.match(
      /(?:^|\s)\/(urgent|high|medium|low|priority\s+(urgent|high|medium|low))(?:\s|$)/i,
    );
    if (priorityMatch && (priorityMatch[2] || priorityMatch[1])) {
      const matchedPriority = priorityMatch[2] || priorityMatch[1] || '';
      const p = matchedPriority.toLowerCase() as 'low' | 'medium' | 'high' | 'urgent';
      priority = p;
      cleanTitle = cleanTitle.replace(priorityMatch[0], ' ').trim();
    }

    // Extract inline notepad: /notepad
    let notepad = chips.notepad;
    if (/(?:^|\s)\/notepad(?:\s|$)/i.test(cleanTitle)) {
      notepad = { mode: 'new' };
      cleanTitle = cleanTitle.replace(/(?:^|\s)\/notepad(?:\s|$)/i, ' ').trim();
    }

    // Extract inline due date: /due tomorrow, /due next fri, etc.
    let dueDate = chips.dueDate?.timestamp;
    const dueMatch = cleanTitle.match(/(?:^|\s)\/due\s+([^/@#]+)/i);
    if (dueMatch && dueMatch[1]) {
      const parsed = chrono.parseDate(dueMatch[1].trim());
      if (parsed) {
        dueDate = parsed.getTime();
        cleanTitle = cleanTitle.replace(dueMatch[0], ' ').trim();
      }
    }

    // Extract inline assignees: @name
    const assigneeIds = [...chips.assignees.map((a) => a.userId)];
    const atMatches = Array.from(cleanTitle.matchAll(/(?:^|\s)@([a-zA-Z0-9._-]+)/g));
    for (const match of atMatches) {
      const rawMatch = match[1];
      if (!rawMatch) continue;
      const q = rawMatch.toLowerCase();
      const found = members.find(
        (m) =>
          (m.name && m.name.toLowerCase().includes(q)) ||
          (m.email && m.email.toLowerCase().includes(q)),
      );
      if (found && !assigneeIds.includes(found.userId)) {
        assigneeIds.push(found.userId);
      }
      cleanTitle = cleanTitle.replace(match[0], ' ').trim();
    }

    // Extract inline tags: #tag
    const tagIds = [...chips.tags.map((t) => t.tagId)];
    const hashMatches = Array.from(cleanTitle.matchAll(/(?:^|\s)#([a-zA-Z0-9._-]+)/g));
    for (const match of hashMatches) {
      const rawMatch = match[1];
      if (!rawMatch) continue;
      const q = rawMatch.toLowerCase();
      let found = availableTags.find((t) => t.name.toLowerCase() === q);
      if (!found) {
        try {
          const res = await fetch(`/api/projects/${projectId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: rawMatch }),
          });
          if (res.ok) {
            found = await res.json();
            if (found) {
              setAvailableTags((prev) => [...prev, found!]);
            }
          }
        } catch (err) {
          console.error('Failed to create tag', err);
        }
      }
      if (found && !tagIds.includes(found.id)) {
        tagIds.push(found.id);
      }
      cleanTitle = cleanTitle.replace(match[0], ' ').trim();
    }

    // Strip trailing bare trigger characters e.g. "Buy milk /" -> "Buy milk"
    cleanTitle = cleanTitle.replace(/(?:^|\s)[/@#]$/, '').trim();
    cleanTitle = cleanTitle || 'Untitled';

    try {
      await createCardMutation.mutateAsync({
        boardId,
        columnId,
        title: cleanTitle,
        priority: priority ?? undefined,
        dueDate: dueDate ?? undefined,
        assigneeIds,
        tagIds,
        notepad: notepad
          ? notepad.mode === 'new'
            ? { mode: 'new' }
            : { mode: 'existing', id: notepad.id }
          : undefined,
      });

      setTitle('');
      setChips({ assignees: [], tags: [] });
      setMenuMode('none');
      if (!keepOpen && onClose) {
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create card');
    }
  };

  return (
    <div className="border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] p-2.5 space-y-2 relative">
      {/* Active Structured Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.notepad && (
          <span className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)]">
            <FileText className="w-3 h-3 text-[var(--muted)]" />
            <span>{chips.notepad.mode === 'new' ? 'New Notepad' : chips.notepad.title}</span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, notepad: undefined }))}
              aria-label="Remove notepad"
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center hover:text-[var(--danger)]"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.priority && (
          <span className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/40">
            <Flag className="w-3 h-3" />
            <span className="capitalize">{chips.priority}</span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, priority: undefined }))}
              aria-label="Remove priority"
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.dueDate && (
          <span className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)]">
            <Calendar className="w-3 h-3 text-[var(--muted)]" />
            <span>{chips.dueDate.label}</span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, dueDate: undefined }))}
              aria-label="Remove due date"
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.assignees.map((a) => (
          <span
            key={a.userId}
            className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)]"
          >
            <User className="w-3 h-3 text-[var(--muted)]" />
            <span>{a.name}</span>
            <button
              type="button"
              onClick={() =>
                setChips((c) => ({
                  ...c,
                  assignees: c.assignees.filter((x) => x.userId !== a.userId),
                }))
              }
              aria-label={`Remove ${a.name}`}
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {chips.tags.map((t) => (
          <span
            key={t.tagId}
            className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border"
            style={{
              backgroundColor: `${t.color || '#64748b'}20`,
              color: t.color || '#64748b',
              borderColor: `${t.color || '#64748b'}40`,
            }}
          >
            <Tag className="w-3 h-3" />
            <span>#{t.name}</span>
            <button
              type="button"
              aria-label={`Remove tag ${t.name}`}
              onClick={() =>
                setChips((c) => ({
                  ...c,
                  tags: c.tags.filter((x) => x.tagId !== t.tagId),
                }))
              }
              className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Main Input */}
      <Input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a title, / for commands, @ for members, # for tags…"
        className="border-none bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
      />

      {/* Slash Menu Popup */}
      {menuMode === 'slash' && filteredSlashCommands.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-[var(--surface)] border border-[var(--line)] chamfer-sm p-1.5 z-50 text-xs space-y-0.5 max-h-56 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Quick-Add Commands
          </div>
          {filteredSlashCommands.map((cmd, idx) => {
            const Icon = cmd.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={cmd.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  cmd.action();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full p-2 min-h-[36px] flex items-center gap-2 rounded text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--hi)] text-[var(--text)] font-semibold'
                    : 'hover:bg-[var(--hi)]/50 text-[var(--text)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-xs leading-none">{cmd.label}</div>
                  <div className="text-[10px] text-[var(--muted)] truncate mt-0.5">{cmd.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* At (@) Menu Popup */}
      {menuMode === 'at' && (
        <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-[var(--surface)] border border-[var(--line)] chamfer-sm p-1.5 z-50 text-xs space-y-0.5 max-h-56 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Assign Member
          </div>
          {filteredMembers.length === 0 ? (
            <div className="px-2 py-2 text-xs text-[var(--muted)] italic">No members found</div>
          ) : (
            filteredMembers.map((m, idx) => {
              const isSelected = idx === selectedIndex;
              const displayName = m.name || m.email || 'Member';
              return (
                <button
                  key={m.userId}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectAssignee(m.userId, displayName);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full p-2 min-h-[36px] flex items-center gap-2 rounded text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--hi)] text-[var(--text)] font-semibold'
                      : 'hover:bg-[var(--hi)]/50 text-[var(--text)]'
                  }`}
                >
                  <Avatar name={displayName} size="xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-xs leading-none">{displayName}</div>
                    {m.name && m.email && (
                      <div className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                        {m.email}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* Hash (#) Menu Popup */}
      {menuMode === 'hash' && (
        <div className="absolute left-0 bottom-full mb-1.5 w-64 bg-[var(--surface)] border border-[var(--line)] chamfer-sm p-1.5 z-50 text-xs space-y-0.5 max-h-56 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Project Tags
          </div>
          {filteredTags.map((t, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={t.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectTag(t.id, t.name, t.color);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`w-full p-2 min-h-[36px] flex items-center gap-2 rounded text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--hi)] text-[var(--text)] font-semibold'
                    : 'hover:bg-[var(--hi)]/50 text-[var(--text)]'
                }`}
              >
                <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: t.color || '#64748b' }} />
                <span className="truncate">#{t.name}</span>
              </button>
            );
          })}
          {menuQuery.trim() &&
            !filteredTags.some((t) => t.name.toLowerCase() === menuQuery.toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  createAndSelectTag(menuQuery.trim());
                }}
                onMouseEnter={() => setSelectedIndex(filteredTags.length)}
                className={`w-full p-2 min-h-[36px] flex items-center gap-2 rounded text-left transition-colors cursor-pointer border-t border-[var(--hair)] ${
                  selectedIndex === filteredTags.length
                    ? 'bg-[var(--hi)] text-[var(--accent)] font-semibold'
                    : 'hover:bg-[var(--hi)]/50 text-[var(--accent)]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Create tag &quot;#{menuQuery.trim()}&quot;</span>
              </button>
            )}
          {filteredTags.length === 0 && !menuQuery.trim() && (
            <div className="px-2 py-2 text-xs text-[var(--muted)] italic">
              No tags yet. Type to create one!
            </div>
          )}
        </div>
      )}

      {/* Inline Date Input if /due selected */}
      {dateInputOpen && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--hair)]">
          <Calendar className="w-3.5 h-3.5 text-[var(--accent)] shrink-0 ml-1" />
          <Input
            autoFocus
            type="text"
            value={dateInputValue}
            onChange={(e) => setDateInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                selectDueDate(dateInputValue);
              }
              if (e.key === 'Escape') setDateInputOpen(false);
            }}
            placeholder="e.g. tomorrow, next fri, Oct 3"
            className="flex-1 text-xs py-1"
          />
          <Button variant="primary" size="sm" onClick={() => selectDueDate(dateInputValue)}>
            Set
          </Button>
          <button
            type="button"
            onClick={() => setDateInputOpen(false)}
            className="p-1 hover:text-[var(--danger)] text-[var(--muted)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Footer controls: Submit & Hints */}
      <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--hair)] gap-2">
        <span className="truncate">
          ↵ Enter to save &bull; ⇧↵ to add another &bull; ⌫ clears chips
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 min-h-[44px] md:min-h-0 hover:bg-[var(--hi)] hover:text-[var(--text)] text-xs text-[var(--muted)] transition-colors"
            >
              Cancel
            </button>
          )}
          <Button
            size="sm"
            variant="primary"
            disabled={!title.trim() || createCardMutation.isPending}
            onClick={() => handleSave(false)}
          >
            {createCardMutation.isPending ? 'Adding…' : 'Add card'}
          </Button>
        </div>
      </div>
    </div>
  );
}
