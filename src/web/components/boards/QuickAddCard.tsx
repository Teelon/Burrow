import { useState, useRef, useEffect } from 'react'
import * as chrono from 'chrono-node'
import {
  Calendar,
  FileText,
  Flag,
  Tag,
  User,
  X,
} from 'lucide-react'
import { useCreateCard, useMembers } from '../../lib/queries'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'

interface QuickAddCardProps {
  boardId: string
  columnId: string
  projectId: string
  onClose?: () => void
}

interface QuickAddChips {
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: { timestamp: number; label: string }
  assignees: Array<{ userId: string; name: string }>
  tags: Array<{ tagId: string; name: string; color?: string | null }>
  notepad?: { mode: 'new'; title?: string } | { mode: 'existing'; id: string; title: string }
}

export function QuickAddCard({
  boardId,
  columnId,
  projectId,
  onClose,
}: QuickAddCardProps) {
  const [title, setTitle] = useState('')
  const [chips, setChips] = useState<QuickAddChips>({ assignees: [], tags: [] })
  const [menuMode, setMenuMode] = useState<'none' | 'slash' | 'at' | 'hash'>('none')
  const [menuQuery, setMenuQuery] = useState('')

  const [dateInputOpen, setDateInputOpen] = useState(false)
  const [dateInputValue, setDateInputValue] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const createCardMutation = useCreateCard()
  const { data: members = [] } = useMembers()

  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/tags`)
      .then((r) => r.ok && r.json())
      .then((data) => data && setAvailableTags(data))
      .catch(() => {})
  }, [projectId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)

    if (val.endsWith('/')) {
      setMenuMode('slash')
      setMenuQuery('')
    } else if (val.endsWith('@')) {
      setMenuMode('at')
      setMenuQuery('')
    } else if (val.endsWith('#')) {
      setMenuMode('hash')
      setMenuQuery('')
    } else if (menuMode !== 'none') {
      const lastWord = val.split(' ').pop() || ''
      if (lastWord.startsWith('/') || lastWord.startsWith('@') || lastWord.startsWith('#')) {
        setMenuQuery(lastWord.slice(1))
      } else {
        setMenuMode('none')
      }
    }
  }

  const cleanLastTrigger = (text: string) => {
    const words = text.split(' ')
    words.pop()
    return words.join(' ') + (words.length > 0 ? ' ' : '')
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (menuMode !== 'none') {
        setMenuMode('none')
      } else if (onClose) {
        onClose()
      }
      return
    }

    if (e.key === 'Backspace' && title === '') {
      // Remove last chip
      if (chips.notepad) {
        setChips((c) => ({ ...c, notepad: undefined }))
      } else if (chips.tags.length > 0) {
        setChips((c) => ({ ...c, tags: c.tags.slice(0, -1) }))
      } else if (chips.assignees.length > 0) {
        setChips((c) => ({ ...c, assignees: c.assignees.slice(0, -1) }))
      } else if (chips.dueDate) {
        setChips((c) => ({ ...c, dueDate: undefined }))
      } else if (chips.priority) {
        setChips((c) => ({ ...c, priority: undefined }))
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      if (menuMode !== 'none') {
        // Selection handled via menu click or select
        return
      }

      const cleanTitle = title.trim()
      if (!cleanTitle) return

      await createCardMutation.mutateAsync({
        boardId,
        columnId,
        title: cleanTitle,
        priority: chips.priority,
        dueDate: chips.dueDate?.timestamp,
        assigneeIds: chips.assignees.map((a) => a.userId),
        tagIds: chips.tags.map((t) => t.tagId),
        notepad: chips.notepad
          ? chips.notepad.mode === 'new'
            ? { mode: 'new' }
            : { mode: 'existing', id: chips.notepad.id }
          : undefined,
      })

      setTitle('')
      setChips({ assignees: [], tags: [] })
      if (!e.shiftKey && onClose) {
        onClose()
      }
    }
  }

  const selectPriority = (p: 'low' | 'medium' | 'high' | 'urgent') => {
    setChips((c) => ({ ...c, priority: p }))
    setTitle(cleanLastTrigger(title))
    setMenuMode('none')
    inputRef.current?.focus()
  }

  const selectDueDate = (text: string) => {
    const parsed = chrono.parseDate(text)
    if (parsed) {
      setChips((c) => ({
        ...c,
        dueDate: {
          timestamp: parsed.getTime(),
          label: parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        },
      }))
    }
    setTitle(cleanLastTrigger(title))
    setDateInputOpen(false)
    setMenuMode('none')
    inputRef.current?.focus()
  }

  const selectAssignee = (userId: string, name: string) => {
    setChips((c) => {
      if (c.assignees.some((a) => a.userId === userId)) return c
      return { ...c, assignees: [...c.assignees, { userId, name }] }
    })
    setTitle(cleanLastTrigger(title))
    setMenuMode('none')
    inputRef.current?.focus()
  }

  const selectTag = (tagId: string, name: string, color?: string | null) => {
    setChips((c) => {
      if (c.tags.some((t) => t.tagId === tagId)) return c
      return { ...c, tags: [...c.tags, { tagId, name, color }] }
    })
    setTitle(cleanLastTrigger(title))
    setMenuMode('none')
    inputRef.current?.focus()
  }

  return (
    <Card className="p-2 space-y-2 relative">
      {/* Active Structured Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.notepad && (
          <span className="chamfer-sm inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)]">
            <FileText className="w-3 h-3 text-[var(--muted)]" />
            <span>
              {chips.notepad.mode === 'new' ? 'New Notepad' : chips.notepad.title}
            </span>
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
        className="border-none bg-transparent px-0"
      />

      {/* Slash Menu Popup */}
      {menuMode === 'slash' && (
        <div className="absolute left-2 bottom-full mb-1 w-64 bg-[var(--surface)] border border-[var(--line)] p-1.5 z-30 text-xs space-y-1">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Quick-Add Commands
          </div>
          <button
            type="button"
            onClick={() => {
              setChips((c) => ({ ...c, notepad: { mode: 'new' } }))
              setTitle(cleanLastTrigger(title))
              setMenuMode('none')
              inputRef.current?.focus()
            }}
            className="w-full p-1.5 min-h-[44px] flex items-center gap-2 hover:bg-[var(--hi)] text-left text-[var(--text)]"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--muted)]" />
            <div>
              <div className="font-semibold">/notepad</div>
              <div className="text-[10px] text-[var(--muted)]">Create new linked notepad</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setDateInputOpen(true)
              setMenuMode('none')
            }}
            className="w-full p-1.5 min-h-[44px] flex items-center gap-2 hover:bg-[var(--hi)] text-left text-[var(--text)]"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--muted)]" />
            <div>
              <div className="font-semibold">/due</div>
              <div className="text-[10px] text-[var(--muted)]">Set due date (e.g., tomorrow)</div>
            </div>
          </button>

          <div className="border-t border-[var(--hair)] pt-1">
            <div className="px-2 py-0.5 text-[10px] text-[var(--muted)]">/priority</div>
            <div className="grid grid-cols-4 gap-1 p-1">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPriority(p)}
                  className="chamfer-sm py-1 min-h-[44px] md:min-h-0 bg-[var(--surface2)] text-[10px] font-medium capitalize hover:bg-[var(--hi)] text-[var(--text)]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* At (@) Menu Popup */}
      {menuMode === 'at' && (
        <div className="absolute left-2 bottom-full mb-1 w-56 bg-[var(--surface)] border border-[var(--line)] p-1.5 z-30 text-xs space-y-1 max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Assign Member
          </div>
          {members
            .filter((m) =>
              menuQuery
                ? m.name.toLowerCase().includes(menuQuery.toLowerCase()) ||
                  m.email.toLowerCase().includes(menuQuery.toLowerCase())
                : true,
            )
            .map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => selectAssignee(m.userId, m.name)}
                className="w-full p-1.5 min-h-[44px] flex items-center gap-2 hover:bg-[var(--hi)] text-left text-[var(--text)]"
              >
                <Avatar name={m.name || m.email} size="xs" />
                <span className="truncate">{m.name}</span>
              </button>
            ))}
        </div>
      )}

      {/* Hash (#) Menu Popup */}
      {menuMode === 'hash' && (
        <div className="absolute left-2 bottom-full mb-1 w-56 bg-[var(--surface)] border border-[var(--line)] p-1.5 z-30 text-xs space-y-1 max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">
            Project Tags
          </div>
          {availableTags
            .filter((t) => (menuQuery ? t.name.toLowerCase().includes(menuQuery.toLowerCase()) : true))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTag(t.id, t.name, t.color)}
                className="w-full p-1.5 min-h-[44px] flex items-center gap-2 hover:bg-[var(--hi)] text-left text-[var(--text)]"
              >
                <Tag className="w-3.5 h-3.5" style={{ color: t.color || '#64748b' }} />
                <span>#{t.name}</span>
              </button>
            ))}
        </div>
      )}

      {/* Inline Date Input if /due selected */}
      {dateInputOpen && (
        <div className="flex items-center gap-1.5 pt-1">
          <Input
            autoFocus
            type="text"
            value={dateInputValue}
            onChange={(e) => setDateInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                selectDueDate(dateInputValue)
              }
              if (e.key === 'Escape') setDateInputOpen(false)
            }}
            placeholder="e.g. tomorrow, next fri, Oct 3"
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => selectDueDate(dateInputValue)}
          >
            Set
          </Button>
        </div>
      )}

      {/* Footer controls: Submit & Hints */}
      <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-1 border-t border-[var(--hair)]">
        <span>↵ Enter to save &bull; ⇧↵ to add another &bull; ⌫ backspace clears chips</span>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-0.5 min-h-[44px] md:min-h-0 hover:bg-[var(--hi)] hover:text-[var(--text)]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
