import { useState } from 'react'
import { FileText, Kanban, Plus, Search, X } from 'lucide-react'
import { useBoards, useCreateCard } from '../lib/queries'

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-purple-500" />
            <span>Link Notepad</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-neutral-100 dark:bg-neutral-800 m-4 rounded-xl text-xs font-medium">
          <button
            onClick={() => setTab('new')}
            className={`py-1.5 rounded-lg transition ${
              tab === 'new'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Create New
          </button>
          <button
            onClick={() => setTab('existing')}
            className={`py-1.5 rounded-lg transition ${
              tab === 'existing'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Existing Notepad
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 pt-0">
          {tab === 'new' ? (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 mb-1">
                  Notepad Title
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Project Specifications"
                  className="w-full p-2.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || isSubmitting}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating…' : 'Create & Link'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-3" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search notepads…"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {results.length === 0 ? (
                  <div className="p-4 text-center text-xs text-neutral-400 italic">
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
                      className="w-full p-2 text-left text-xs rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition"
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
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Kanban className="w-4 h-4 text-emerald-500" />
            <span>Create & Link Task Card</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Select Board
            </label>
            <select
              value={selectedBoardId}
              onChange={(e) => handleBoardChange(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
            >
              <option value="" disabled>
                Select a board…
              </option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Column
            </label>
            <select
              value={selectedColId}
              onChange={(e) => setSelectedColId(e.target.value)}
              className="w-full p-2 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
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
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">
              Task Title
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix login bug"
              className="w-full p-2.5 text-xs rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create & Insert Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
