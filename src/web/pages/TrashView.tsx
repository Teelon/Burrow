import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { FileText, Kanban, RefreshCw, Trash2 } from 'lucide-react'
import {
  usePermanentDeleteBoard,
  usePermanentDeleteNotepad,
  useProjects,
  useRestoreBoard,
  useRestoreNotepad,
  useTrash,
} from '../lib/queries'

export function TrashView() {
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const { data: projects = [] } = useProjects()
  const project = projects.find((p) => p.id === projectId) || projects[0]
  const currentProjectId = project?.id

  const { data: trash, isLoading } = useTrash(currentProjectId)
  const restoreNotepad = useRestoreNotepad()
  const permanentDeleteNotepad = usePermanentDeleteNotepad()
  const restoreBoard = useRestoreBoard()
  const permanentDeleteBoard = usePermanentDeleteBoard()

  const [activeTab, setActiveTab] = useState<'all' | 'notepads' | 'boards'>('all')

  const notepads = trash?.notepads || []
  const boards = trash?.boards || []

  const handleRestoreNotepad = (notepadId: string) => {
    if (!currentProjectId) return
    restoreNotepad.mutate({ notepadId, projectId: currentProjectId })
  }

  const handlePermanentDeleteNotepad = (notepadId: string, title: string) => {
    if (!currentProjectId) return
    if (
      window.confirm(
        `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
      )
    ) {
      permanentDeleteNotepad.mutate({ notepadId, projectId: currentProjectId })
    }
  }

  const handleRestoreBoard = (boardId: string) => {
    if (!currentProjectId) return
    restoreBoard.mutate({ boardId, projectId: currentProjectId })
  }

  const handlePermanentDeleteBoard = (boardId: string, name: string) => {
    if (!currentProjectId) return
    if (
      window.confirm(
        `Are you sure you want to permanently delete board "${name}" and all its cards? This cannot be undone.`,
      )
    ) {
      permanentDeleteBoard.mutate({ boardId, projectId: currentProjectId })
    }
  }

  const totalCount = notepads.length + boards.length

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-200/60 dark:border-neutral-800/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-rose-500" />
            <span>Trash</span>
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Items in trash for project <span className="font-semibold">{project?.name}</span>.
            Restored notepads are re-attached to their parent, or to the project root if the parent is still in trash.
          </p>
        </div>

        {/* Tab filters */}
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/80 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'all'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setActiveTab('notepads')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'notepads'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Notepads ({notepads.length})
          </button>
          <button
            onClick={() => setActiveTab('boards')}
            className={`px-3 py-1.5 rounded-lg transition ${
              activeTab === 'boards'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            Boards ({boards.length})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-neutral-400">Loading trash…</div>
      ) : totalCount === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 flex items-center justify-center mx-auto text-neutral-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Trash is empty
          </div>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Deleted notepads and boards will appear here. You can restore them or permanently delete them anytime.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Trashed Notepads */}
          {(activeTab === 'all' || activeTab === 'notepads') &&
            notepads.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center shrink-0 text-base">
                    {item.icon || <FileText className="w-4 h-4 text-purple-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {item.title || 'Untitled'}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Deleted {new Date(item.deletedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestoreNotepad(item.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition flex items-center gap-1.5"
                    title="Restore"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteNotepad(item.id, item.title)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition flex items-center gap-1.5"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}

          {/* Trashed Boards */}
          {(activeTab === 'all' || activeTab === 'boards') &&
            boards.map((b) => (
              <div
                key={b.id}
                className="p-3.5 bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-xl flex items-center justify-between gap-3 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center shrink-0 text-base">
                    {b.icon || <Kanban className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                      {b.name || 'Untitled Board'}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Deleted {new Date(b.deletedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestoreBoard(b.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition flex items-center gap-1.5"
                    title="Restore"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDeleteBoard(b.id, b.name)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 transition flex items-center gap-1.5"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
