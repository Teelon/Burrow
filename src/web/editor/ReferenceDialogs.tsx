import { useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { useBoards, useCreateCard } from '../lib/queries'
import { ModalShell } from '../components/ui/ModalShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { SegmentedControl } from '../components/ui/SegmentedControl'

interface NotepadPickerModalProps {
  projectId: string
  onClose: () => void
  onSelectNotepad: (notepadId: string) => void
}

export function NotepadPickerModal({
  projectId,
  onClose,
  onSelectNotepad,
}: NotepadPickerModalProps) {
  const [tab, setTab] = useState<'new' | 'existing'>('new')
  const [newTitle, setNewTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; label: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/notepads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })
      if (res.ok) {
        const data = (await res.json()) as { id: string }
        onSelectNotepad(data.id)
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setResults([])
      return
    }
    try {
      const res = await fetch(
        `/api/suggest?type=notepad&projectId=${projectId}&q=${encodeURIComponent(q.trim())}`,
      )
      if (res.ok) {
        const data = (await res.json()) as Array<{ id: string; label: string }>
        setResults(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <ModalShell open onClose={onClose} title="Link Notepad" className="sm:max-w-md">
      {/* Tab Switcher — geometric segmented control */}

        {/* Tab Switcher — geometric segmented control */}
        <div className="m-4">
          <SegmentedControl
            value={tab}
            onValueChange={(v) => setTab(v as 'new' | 'existing')}
            options={[
              { value: 'new', label: 'Create New' },
              { value: 'existing', label: 'Existing Notepad' },
            ]}
            fullWidth
          />
        </div>

        {/* Tab Body */}
        <div className="pt-3">
          {tab === 'new' ? (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Notepad Title
                </label>
                <Input
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Project Specifications"
                  className="w-full p-2.5 text-base sm:text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose} className="px-3 py-1.5 text-xs min-h-[44px] sm:min-h-0">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-3 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0"
                >
                  {isSubmitting ? 'Creating…' : 'Create & Link'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-3" />
                <Input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search notepads…"
                  className="w-full pl-9 pr-3 py-2 text-base sm:text-xs"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {results.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[var(--muted)] italic">
                    {searchQuery ? 'No matching notepads' : 'Type to search'}
                  </div>
                ) : (
                  results.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelectNotepad(r.id)
                        onClose()
                      }}
                      className="w-full p-2 min-h-[44px] sm:min-h-0 text-left text-xs text-[var(--text)] hover:bg-[var(--hi)] flex items-center gap-2 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                      <span className="truncate">{r.label || 'Untitled'}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
    </ModalShell>
  )
}

interface TaskPickerModalProps {
  projectId: string
  onClose: () => void
  onCardCreated: (cardId: string) => void
}

export function TaskPickerModal({
  projectId,
  onClose,
  onCardCreated,
}: TaskPickerModalProps) {
  const { data: boards = [] } = useBoards(projectId)
  const createCardMutation = useCreateCard()

  const [selectedBoardId, setSelectedBoardId] = useState(boards[0]?.id || '')
  const [selectedColId, setSelectedColId] = useState('')
  const [title, setTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load columns for selected board
  const [columns, setColumns] = useState<Array<{ id: string; name: string }>>([])

  const handleBoardChange = async (bId: string) => {
    setSelectedBoardId(bId)
    try {
      const res = await fetch(`/api/boards/${bId}`)
      if (res.ok) {
        const board = (await res.json()) as { columns: Array<{ id: string; name: string }> }
        setColumns(board.columns || [])
        setSelectedColId(board.columns?.[0]?.id || '')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !selectedColId || isSubmitting) return
    setIsSubmitting(true)
    try {
      const res = await createCardMutation.mutateAsync({
        boardId: selectedBoardId,
        columnId: selectedColId,
        title: title.trim(),
      })
      onCardCreated(res.cardId)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalShell open onClose={onClose} title="Create & Link Task Card" className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="pt-3 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Select Board
            </label>
            <Select
              value={selectedBoardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              className="w-full p-2 text-base sm:text-xs min-h-[44px] sm:min-h-0"
            >
              <option value="" disabled>
                Select a board…
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Column
            </label>
            <Select
              value={selectedColId}
              onChange={(e) => setSelectedColId(e.target.value)}
              className="w-full p-2 text-base sm:text-xs min-h-[44px] sm:min-h-0"
            >
              {columns.length === 0 ? (
                <option value="">Select board first</option>
              ) : (
                columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Task Title
            </label>
            <Input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix login bug"
              className="w-full p-2.5 text-base sm:text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--hair)]">
            <Button type="button" variant="ghost" onClick={onClose} className="px-3 py-1.5 text-xs min-h-[44px] sm:min-h-0">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!title.trim() || isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0"
            >
              {isSubmitting ? 'Creating…' : 'Create & Insert Link'}
            </Button>
          </div>
        </form>
    </ModalShell>
  )
}
