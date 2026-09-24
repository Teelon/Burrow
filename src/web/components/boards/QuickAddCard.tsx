import { useState, useRef, useEffect } from 'react'
import * as chrono from 'chrono-node'
import {
  Calendar,
  FileText,
  Flag,
  Plus,
  Tag,
  User,
  X,
} from 'lucide-react'
import { useCreateCard, useMembers } from '../../lib/queries'

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
  const [menuIndex, setMenuIndex] = useState(0)

  const [notepadPickerOpen, setNotepadPickerOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [memberPickerOpen, setMemberPickerOpen] = useState(false)
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
      setMenuIndex(0)
    } else if (val.endsWith('@')) {
      setMenuMode('at')
      setMenuQuery('')
      setMenuIndex(0)
    } else if (val.endsWith('#')) {
      setMenuMode('hash')
      setMenuQuery('')
      setMenuIndex(0)
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
    setMemberPickerOpen(false)
    setMenuMode('none')
    inputRef.current?.focus()
  }

  const selectTag = (tagId: string, name: string, color?: string | null) => {
    setChips((c) => {
      if (c.tags.some((t) => t.tagId === tagId)) return c
      return { ...c, tags: [...c.tags, { tagId, name, color }] }
    })
    setTitle(cleanLastTrigger(title))
    setTagPickerOpen(false)
    setMenuMode('none')
    inputRef.current?.focus()
  }

  return (
    <div className="p-2 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl shadow-xs space-y-2 relative">
      {/* Active Structured Chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {chips.notepad && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            <FileText className="w-3 h-3 text-purple-500" />
            <span>
              {chips.notepad.mode === 'new' ? 'New Notepad' : chips.notepad.title}
            </span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, notepad: undefined }))}
              className="hover:text-purple-900"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.priority && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Flag className="w-3 h-3 text-amber-500" />
            <span className="capitalize">{chips.priority}</span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, priority: undefined }))}
              className="hover:text-amber-900"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.dueDate && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Calendar className="w-3 h-3 text-blue-500" />
            <span>{chips.dueDate.label}</span>
            <button
              type="button"
              onClick={() => setChips((c) => ({ ...c, dueDate: undefined }))}
              className="hover:text-blue-900"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        )}

        {chips.assignees.map((a) => (
          <span
            key={a.userId}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
          >
            <User className="w-3 h-3 text-neutral-500" />
            <span>{a.name}</span>
            <button
              type="button"
              onClick={() =>
                setChips((c) => ({
                  ...c,
                  assignees: c.assignees.filter((x) => x.userId !== a.userId),
                }))
              }
              className="hover:text-neutral-900"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}

        {chips.tags.map((t) => (
          <span
            key={t.tagId}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium"
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
              onClick={() =>
                setChips((c) => ({
                  ...c,
                  tags: c.tags.filter((x) => x.tagId !== t.tagId),
                }))
              }
            >
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Main Input */}
      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={title}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Type a title, / for commands, @ for members, # for tags…"
        className="w-full text-xs bg-transparent border-none focus:outline-none placeholder-neutral-400"
      />

      {/* Slash Menu Popup */}
      {menuMode === 'slash' && (
        <div className="absolute left-2 bottom-full mb-1 w-64 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 z-30 text-xs space-y-1 animate-in fade-in">
          <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
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
            className="w-full p-1.5 flex items-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
          >
            <FileText className="w-3.5 h-3.5 text-purple-500" />
            <div>
              <div className="font-semibold">/notepad</div>
              <div className="text-[10px] text-neutral-400">Create new linked notepad</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setDateInputOpen(true)
              setMenuMode('none')
            }}
            className="w-full p-1.5 flex items-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <div>
              <div className="font-semibold">/due</div>
              <div className="text-[10px] text-neutral-400">Set due date (e.g., tomorrow)</div>
            </div>
          </button>

          <div className="border-t border-neutral-100 dark:border-neutral-800 pt-1">
            <div className="px-2 py-0.5 text-[10px] text-neutral-400">/priority</div>
            <div className="grid grid-cols-4 gap-1 p-1">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPriority(p)}
                  className="py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-medium capitalize hover:bg-neutral-200"
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
        <div className="absolute left-2 bottom-full mb-1 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 z-30 text-xs space-y-1 animate-in fade-in max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
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
                className="w-full p-1.5 flex items-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px]">
                  {m.name?.[0]?.toUpperCase() || 'U'}
                </span>
                <span className="truncate">{m.name}</span>
              </button>
            ))}
        </div>
      )}

      {/* Hash (#) Menu Popup */}
      {menuMode === 'hash' && (
        <div className="absolute left-2 bottom-full mb-1 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 z-30 text-xs space-y-1 animate-in fade-in max-h-48 overflow-y-auto">
          <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
            Project Tags
          </div>
          {availableTags
            .filter((t) => (menuQuery ? t.name.toLowerCase().includes(menuQuery.toLowerCase()) : true))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTag(t.id, t.name, t.color)}
                className="w-full p-1.5 flex items-center gap-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left"
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
          <input
            type="text"
            autoFocus
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
            className="p-1 text-xs rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => selectDueDate(dateInputValue)}
            className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground font-medium"
          >
            Set
          </button>
        </div>
      )}

      {/* Footer controls: Submit & Hints */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800">
        <span>↵ Enter to save &bull; ⇧↵ to add another &bull; ⌫ backspace clears chips</span>
        <div className="flex items-center gap-1">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-0.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
