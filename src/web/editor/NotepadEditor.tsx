import { useEffect, useRef, useState, useCallback } from 'react'
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { nanoid } from 'nanoid'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  FileText,
  Lock,
  Star,
} from 'lucide-react'
import { schema } from './schema'
import {
  getAtMenuSuggestions,
  getCustomSlashItems,
  getHashMenuSuggestions,
  type SuggestionDialogState,
} from './suggestionItems'
import { NotepadPickerModal, TaskPickerModal } from './ReferenceDialogs'

interface NotepadEditorProps {
  notepadId: string
  hideTitle?: boolean
  hideFavorite?: boolean
}

interface NotepadData {
  id: string
  projectId: string
  kind: 'notepad' | 'card'
  title: string
  icon?: string | null
  coverKey?: string | null
  content: string
  version: number
  isFavorite: boolean
  tags: Array<{ id: string; name: string; color?: string | null }>
  backlinks: Array<{ id: string; title: string; icon?: string | null }>
  lock: { userId: string; name: string; expiresAt: number } | null
}

export function NotepadEditor({
  notepadId,
  hideTitle = false,
  hideFavorite = false,
}: NotepadEditorProps) {
  const [data, setData] = useState<NotepadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'conflict' | 'error'>('saved')
  const [lockBanner, setLockBanner] = useState<{ holderName: string } | null>(null)
  const [conflictBanner, setConflictBanner] = useState(false)
  const [showBacklinks, setShowBacklinks] = useState(true)
  const [dialogState, setDialogState] = useState<SuggestionDialogState>({ type: null })

  const clientIdRef = useRef(nanoid())
  const currentVersionRef = useRef(1)
  const isSavingRef = useRef(false)
  const queuedContentRef = useRef<string | null>(null)
  const lastSavedContentRef = useRef<string>('')
  const saveTimeoutRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)

  // 1. Load notepad data
  const loadNotepad = useCallback(async () => {
    try {
      const res = await fetch(`/api/notepads/${notepadId}`)
      if (!res.ok) throw new Error('Failed to load notepad')
      const json = (await res.json()) as NotepadData
      setData(json)
      currentVersionRef.current = json.version
      lastSavedContentRef.current = json.content

      if (json.lock && json.lock.expiresAt > Date.now()) {
        setLockBanner({ holderName: json.lock.name })
      } else {
        setLockBanner(null)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [notepadId])

  useEffect(() => {
    loadNotepad()
  }, [loadNotepad])

  // 2. Lock heartbeat
  const claimLock = useCallback(async () => {
    try {
      const res = await fetch(`/api/notepads/${notepadId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: clientIdRef.current }),
      })
      if (res.status === 409) {
        const err = (await res.json()) as { error?: { holder?: { name?: string } } }
        setLockBanner({ holderName: err.error?.holder?.name || 'Someone' })
        return false
      }
      if (res.ok) {
        setLockBanner(null)
        return true
      }
    } catch (err) {
      console.warn('Lock claim error', err)
    }
    return false
  }, [notepadId])

  const releaseLock = useCallback(() => {
    fetch(`/api/notepads/${notepadId}/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientIdRef.current }),
      keepalive: true,
    }).catch(() => {})
  }, [notepadId])

  // 3. Save function (single-flight, queued)
  const executeSave = useCallback(
    async (contentToSave: string) => {
      if (contentToSave === lastSavedContentRef.current) {
        setSaveStatus('saved')
        return
      }

      if (isSavingRef.current) {
        queuedContentRef.current = contentToSave
        return
      }

      isSavingRef.current = true
      setSaveStatus('saving')

      try {
        const res = await fetch(`/api/notepads/${notepadId}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: contentToSave,
            baseVersion: currentVersionRef.current,
            clientId: clientIdRef.current,
          }),
        })

        if (res.status === 409) {
          const err = (await res.json()) as { error?: { code?: string; holder?: { name?: string } } }
          if (err.error?.code === 'locked') {
            setLockBanner({ holderName: err.error.holder?.name || 'Someone' })
          } else {
            setConflictBanner(true)
            setSaveStatus('conflict')
          }
          return
        }

        if (!res.ok) {
          throw new Error('Save failed')
        }

        const result = (await res.json()) as { version: number }
        currentVersionRef.current = result.version
        lastSavedContentRef.current = contentToSave
        setSaveStatus('saved')
        setConflictBanner(false)
      } catch (err) {
        console.error('Save error', err)
        setSaveStatus('error')
      } finally {
        isSavingRef.current = false
        if (queuedContentRef.current !== null) {
          const next = queuedContentRef.current
          queuedContentRef.current = null
          executeSave(next)
        }
      }
    },
    [notepadId],
  )

  const scheduleSave = useCallback(
    (content: string) => {
      setSaveStatus('saving')
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = window.setTimeout(() => {
        executeSave(content)
      }, 800)
    },
    [executeSave],
  )

  // 4. BlockNote editor instantiation
  const isEditable = !lockBanner
  const editor = useCreateBlockNote({
    schema,
    initialContent: data?.content ? JSON.parse(data.content) : undefined,
  })

  // Listen to editor changes
  useEffect(() => {
    if (!editor || !isEditable) return
    const unbind = editor.onChange(() => {
      const json = JSON.stringify(editor.document)
      scheduleSave(json)
    })
    return unbind
  }, [editor, isEditable, scheduleSave])

  // Manage heartbeat and lock release
  useEffect(() => {
    heartbeatIntervalRef.current = window.setInterval(() => {
      claimLock()
    }, 30_000)

    return () => {
      if (heartbeatIntervalRef.current) window.clearInterval(heartbeatIntervalRef.current)
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
      // Flush any pending save before releasing lock
      if (editor) {
        executeSave(JSON.stringify(editor.document))
      }
      releaseLock()
    }
  }, [claimLock, releaseLock, executeSave, editor])

  const toggleFavorite = async () => {
    if (!data) return
    const next = !data.isFavorite
    setData({ ...data, isFavorite: next })
    await fetch(`/api/notepads/${notepadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: next }),
    })
  }

  const handleTitleChange = (newTitle: string) => {
    if (!data) return
    setData({ ...data, title: newTitle })
    fetch(`/api/notepads/${notepadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    })
  }

  if (loading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-64 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Top Banner: Read-only Lock */}
      {lockBanner && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600" />
            <span>
              <strong>{lockBanner.holderName}</strong> is currently editing this notepad (read-only).
            </span>
          </div>
          <button
            onClick={claimLock}
            className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 text-xs font-medium hover:bg-amber-100/50"
          >
            Check Availability
          </button>
        </div>
      )}

      {/* Top Banner: Version Conflict */}
      {conflictBanner && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>This notepad changed elsewhere. Reload to get latest changes or overwrite.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadNotepad()
                setConflictBanner(false)
              }}
              className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-rose-300 dark:border-rose-700 text-xs font-medium hover:bg-rose-100/50"
            >
              Reload
            </button>
            <button
              onClick={() => {
                if (editor) {
                  currentVersionRef.current = data?.version ? data.version + 1 : 1
                  executeSave(JSON.stringify(editor.document))
                }
              }}
              className="px-2.5 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-700"
            >
              Overwrite
            </button>
          </div>
        </div>
      )}

      {/* Header controls: icon, favorite, save status */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {!hideFavorite && (
            <button
              onClick={toggleFavorite}
              className={`p-1.5 rounded-lg border transition ${
                data?.isFavorite
                  ? 'text-amber-500 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30'
                  : 'text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-600'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${data?.isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}

          <span className="text-xs text-neutral-400">
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'conflict' && 'Conflict'}
            {saveStatus === 'error' && 'Offline, retrying'}
          </span>
        </div>
      </div>

      {/* Notepad Title Input */}
      {!hideTitle && (
        <div>
          <input
            type="text"
            value={data?.title || ''}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled"
            disabled={!isEditable}
            className="w-full text-3xl font-bold tracking-tight bg-transparent border-none focus:outline-none placeholder-neutral-300 dark:placeholder-neutral-700"
          />
        </div>
      )}

      {/* BlockNote Editor Surface */}
      <div className="border-t border-neutral-100 dark:border-neutral-800/60 pt-4 min-h-[350px]">
        {editor && (
          <BlockNoteView
            editor={editor}
            editable={isEditable}
            slashMenu={false}
            theme={
              typeof document !== 'undefined' &&
              document.documentElement.classList.contains('dark')
                ? 'dark'
                : 'light'
            }
          >
            {/* Custom Slash Menu */}
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                const defaultItems = getDefaultReactSlashMenuItems(editor)
                const customItems = getCustomSlashItems(
                  editor,
                  data?.kind === 'card' ? 'card' : 'notepad',
                  data?.projectId || '',
                  setDialogState,
                )
                const all = [...customItems, ...defaultItems]
                const q = query.toLowerCase()
                return all.filter(
                  (item) =>
                    item.title.toLowerCase().includes(q) ||
                    item.aliases?.some((a) => a.toLowerCase().includes(q)),
                )
              }}
            />

            {/* At (@) Menu: People, Notepads, Cards, Dates */}
            <SuggestionMenuController
              triggerCharacter="@"
              getItems={async (query) => {
                return getAtMenuSuggestions(query, data?.projectId || '', editor)
              }}
            />

            {/* Hash (#) Menu: Project Tags */}
            <SuggestionMenuController
              triggerCharacter="#"
              getItems={async (query) => {
                return getHashMenuSuggestions(
                  query,
                  data?.projectId || '',
                  notepadId,
                  editor,
                  async (tagId) => {
                    const currentTags = data?.tags.map((t) => t.id) || []
                    if (!currentTags.includes(tagId)) {
                      await fetch(`/api/notepads/${notepadId}/tags`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tagIds: [...currentTags, tagId] }),
                      })
                      loadNotepad()
                    }
                  },
                )
              }}
            />
          </BlockNoteView>
        )}
      </div>

      {/* Reference Dialogs: /notepad and /task */}
      {dialogState.type === 'notepad' && data?.projectId && (
        <NotepadPickerModal
          projectId={data.projectId}
          onClose={() => setDialogState({ type: null })}
          onSelectNotepad={(selectedId) => {
            if (editor) {
              const currentBlock = editor.getTextCursorPosition().block
              editor.insertBlocks(
                [{ type: 'notepadLink', props: { notepadId: selectedId } }],
                currentBlock,
                'after',
              )
            }
          }}
        />
      )}

      {dialogState.type === 'task' && data?.projectId && (
        <TaskPickerModal
          projectId={data.projectId}
          onClose={() => setDialogState({ type: null })}
          onCardCreated={(createdCardId) => {
            if (editor) {
              const currentBlock = editor.getTextCursorPosition().block
              editor.insertBlocks(
                [{ type: 'cardLink', props: { cardId: createdCardId } }],
                currentBlock,
                'after',
              )
            }
          }}
        />
      )}

      {/* Backlinks Section */}
      {data && data.backlinks && data.backlinks.length > 0 && (
        <div className="border-t border-neutral-200/60 dark:border-neutral-800/60 pt-6">
          <button
            onClick={() => setShowBacklinks(!showBacklinks)}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 hover:text-neutral-600"
          >
            {showBacklinks ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Backlinks ({data.backlinks.length})</span>
          </button>

          {showBacklinks && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.backlinks.map((link) => (
                <a
                  key={link.id}
                  href={`/p/${data.id}/notepads/${link.id}`}
                  className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 flex items-center gap-2 text-xs transition"
                >
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  <span className="truncate font-medium">{link.title}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
