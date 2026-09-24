import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
} from '@blocknote/react'
import { BlockNoteView } from '@blocknote/shadcn'
import '@blocknote/shadcn/style.css'
import { useQueryClient } from '@tanstack/react-query'
import { nanoid } from 'nanoid'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Lock,
  Star,
  X,
} from 'lucide-react'
import { schema } from './schema'
import {
  getAtMenuSuggestions,
  getCustomSlashItems,
  getHashMenuSuggestions,
  type SuggestionDialogState,
} from './suggestionItems'
import { NotepadPickerModal, TaskPickerModal } from './ReferenceDialogs'

function getTabClientId(): string {
  if (typeof window === 'undefined') return nanoid()
  try {
    let id = window.sessionStorage.getItem('burrow_client_id')
    if (!id) {
      id = nanoid()
      window.sessionStorage.setItem('burrow_client_id', id)
    }
    return id
  } catch {
    return nanoid()
  }
}

export interface NotepadEditorProps {
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
  lock: {
    userId: string
    clientId: string
    name: string
    expiresAt: number
    isMe?: boolean
  } | null
}

interface LockBannerState {
  holderName: string
  isMe?: boolean
  expiresAt?: number
}

interface NotepadEditorInnerProps {
  initialData: NotepadData
  hideTitle?: boolean
  hideFavorite?: boolean
  onReload: () => void
}

function NotepadEditorInner({
  initialData,
  hideTitle = false,
  hideFavorite = false,
  onReload,
}: NotepadEditorInnerProps) {
  const queryClient = useQueryClient()
  const [data, setData] = useState<NotepadData>(initialData)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'conflict' | 'error'>('saved')
  const [availableBanner, setAvailableBanner] = useState(false)
  const [conflictBanner, setConflictBanner] = useState(false)
  const [showBacklinks, setShowBacklinks] = useState(true)
  const [dialogState, setDialogState] = useState<SuggestionDialogState>({ type: null })

  const clientIdRef = useRef(getTabClientId())
  const hasLockRef = useRef<boolean>(
    Boolean(
      initialData.lock &&
        initialData.lock.expiresAt > Date.now() &&
        initialData.lock.clientId === clientIdRef.current,
    ),
  )
  const [lockBanner, setLockBanner] = useState<LockBannerState | null>(() => {
    if (initialData.lock && initialData.lock.expiresAt > Date.now()) {
      const isCurrentClient = initialData.lock.clientId === clientIdRef.current
      if (!isCurrentClient) {
        return {
          holderName: initialData.lock.name,
          isMe: !!initialData.lock.isMe,
          expiresAt: initialData.lock.expiresAt,
        }
      }
    }
    return null
  })

  const isFocusedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentVersionRef = useRef<number>(initialData.version)
  const isSavingRef = useRef(false)
  const queuedContentRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<number | null>(null)
  const titleTimeoutRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<number | null>(null)
  const heartbeatIntervalRef = useRef<number | null>(null)

  // Parse initial content safely
  const initialContent = useMemo(() => {
    if (!initialData.content) return undefined
    try {
      const parsed = JSON.parse(initialData.content)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch (err) {
      console.warn('Failed to parse initial notepad content', err)
    }
    return undefined
  }, [initialData.content])

  // Instantiate BlockNote editor with preloaded content
  const isEditable = !lockBanner
  const editor = useCreateBlockNote(
    {
      schema,
      initialContent,
    },
    [initialData.id],
  )

  const lastSavedContentRef = useRef<string>(
    initialContent ? initialData.content : JSON.stringify(editor.document),
  )

  // Polling when locked by another client/user (every 10 seconds)
  useEffect(() => {
    if (!lockBanner) return
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/notepads/${initialData.id}`)
        if (!res.ok) return
        const json = (await res.json()) as NotepadData
        if (json.lock && json.lock.expiresAt > Date.now()) {
          const isCurrentClient = json.lock.clientId === clientIdRef.current
          if (!isCurrentClient) {
            setLockBanner({
              holderName: json.lock.name,
              isMe: !!json.lock.isMe,
              expiresAt: json.lock.expiresAt,
            })
          } else {
            hasLockRef.current = true
            setLockBanner(null)
            setAvailableBanner(false)
          }
        } else {
          setLockBanner(null)
          setAvailableBanner(true)
        }
      } catch (err) {
        console.warn('Lock poll error', err)
      }
    }, 10_000)
    return () => window.clearInterval(pollInterval)
  }, [lockBanner, initialData.id])

  // Lock claim & release
  const claimLock = useCallback(
    async (takeover = false) => {
      try {
        const res = await fetch(`/api/notepads/${initialData.id}/lock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: clientIdRef.current,
            takeover,
          }),
        })
        if (res.status === 409) {
          const err = (await res.json()) as {
            error?: { holder?: { name?: string; isMe?: boolean; userId?: string } }
          }
          hasLockRef.current = false
          setLockBanner({
            holderName: err.error?.holder?.name || 'Someone',
            isMe: !!err.error?.holder?.isMe,
          })
          setAvailableBanner(false)
          return false
        }
        if (res.ok) {
          hasLockRef.current = true
          setLockBanner(null)
          setAvailableBanner(false)
          return true
        }
      } catch (err) {
        console.warn('Lock claim error', err)
      }
      return false
    },
    [initialData.id],
  )

  const releaseLock = useCallback(() => {
    hasLockRef.current = false
    fetch(`/api/notepads/${initialData.id}/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientIdRef.current }),
      keepalive: true,
    }).catch(() => {})
  }, [initialData.id])

  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) return
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (isFocusedRef.current) {
        claimLock()
      }
    }, 30_000)
  }, [claimLock])

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      window.clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
  }, [])

  // Save function (single-flight, queued)
  const executeSave = useCallback(
    async (contentToSave: string, options?: { isUnload?: boolean }) => {
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
        const bodyStr = JSON.stringify({
          content: contentToSave,
          baseVersion: currentVersionRef.current,
          clientId: clientIdRef.current,
        })

        // Browsers strictly limit keepalive requests to 64KB across all active requests.
        // Never use keepalive for normal saves; only use keepalive on page unload if safely under 60KB.
        const useKeepalive = Boolean(options?.isUnload && bodyStr.length < 60_000)

        const res = await fetch(`/api/notepads/${initialData.id}/content`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          keepalive: useKeepalive,
          body: bodyStr,
        })

        if (res.status === 409) {
          const err = (await res.json()) as {
            error?: { code?: string; holder?: { name?: string; isMe?: boolean } }
          }
          if (err.error?.code === 'locked') {
            hasLockRef.current = false
            setLockBanner({
              holderName: err.error.holder?.name || 'Someone',
              isMe: !!err.error.holder?.isMe,
            })
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
        if (retryTimeoutRef.current) {
          window.clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
      } catch (err) {
        console.error('Save error', err)
        setSaveStatus('error')
        // Automatically retry saving after 3 seconds
        if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = window.setTimeout(() => {
          if (editor) {
            const currentDoc = JSON.stringify(editor.document)
            if (currentDoc !== lastSavedContentRef.current) {
              executeSave(currentDoc)
            }
          }
        }, 3000)
      } finally {
        isSavingRef.current = false
        if (queuedContentRef.current !== null) {
          const next = queuedContentRef.current
          queuedContentRef.current = null
          executeSave(next)
        }
      }
    },
    [initialData.id, editor],
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

  // Listen to editor changes
  useEffect(() => {
    if (!editor || !isEditable) return
    const unbind = editor.onChange(() => {
      if (!hasLockRef.current && !lockBanner) {
        claimLock()
        startHeartbeat()
      }
      const json = JSON.stringify(editor.document)
      scheduleSave(json)
    })
    return unbind
  }, [editor, isEditable, scheduleSave, lockBanner, claimLock, startHeartbeat])

  // Focus & blur management for lock claiming and releasing
  const handleFocus = useCallback(() => {
    isFocusedRef.current = true
    if (!lockBanner) {
      claimLock()
      startHeartbeat()
    }
  }, [claimLock, lockBanner, startHeartbeat])

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (containerRef.current && containerRef.current.contains(e.relatedTarget as Node)) {
        return
      }
      isFocusedRef.current = false
      stopHeartbeat()
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
      if (editor) {
        const docJson = JSON.stringify(editor.document)
        if (docJson !== lastSavedContentRef.current) {
          executeSave(docJson)
        }
      }
      if (hasLockRef.current) {
        releaseLock()
      }
    },
    [editor, executeSave, releaseLock, stopHeartbeat],
  )

  // Page unload & unmount lock release
  useEffect(() => {
    const handlePageHide = () => {
      if (hasLockRef.current) {
        if (editor) {
          const docJson = JSON.stringify(editor.document)
          if (docJson !== lastSavedContentRef.current) {
            executeSave(docJson, { isUnload: true })
          }
        }
        releaseLock()
      }
    }

    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
      stopHeartbeat()
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current)
      if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current)
      if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current)
      if (hasLockRef.current) {
        if (editor) {
          const docJson = JSON.stringify(editor.document)
          if (docJson !== lastSavedContentRef.current) {
            executeSave(docJson, { isUnload: true })
          }
        }
        releaseLock()
      }
    }
  }, [editor, executeSave, releaseLock, stopHeartbeat])

  const toggleFavorite = async () => {
    const next = !data.isFavorite
    setData((prev) => ({ ...prev, isFavorite: next }))
    await fetch(`/api/notepads/${initialData.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: next }),
    })
    queryClient.invalidateQueries({ queryKey: ['notepads', initialData.projectId] })
  }

  const handleTitleChange = (newTitle: string) => {
    setData((prev) => ({ ...prev, title: newTitle }))
    if (titleTimeoutRef.current) window.clearTimeout(titleTimeoutRef.current)
    titleTimeoutRef.current = window.setTimeout(async () => {
      try {
        await fetch(`/api/notepads/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        })
        queryClient.invalidateQueries({ queryKey: ['notepads', initialData.projectId] })
      } catch (err) {
        console.error('Title save error', err)
      }
    }, 400)
  }

  return (
    <div
      ref={containerRef}
      onFocusCapture={handleFocus}
      onBlurCapture={handleBlur}
      className="max-w-4xl mx-auto py-8 px-6 space-y-6"
    >
      {/* Top Banner: Read-only Lock */}
      {lockBanner && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {lockBanner.isMe ? (
                <>You are currently editing this notepad in another window or tab (read-only).</>
              ) : (
                <>
                  <strong>{lockBanner.holderName}</strong> is currently editing this notepad (read-only).
                </>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lockBanner.isMe && (
              <button
                onClick={() => claimLock(true)}
                className="px-2.5 py-1 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition"
              >
                Edit Here Instead
              </button>
            )}
            <button
              onClick={() => claimLock(false)}
              className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-700 text-xs font-medium hover:bg-amber-100/50 transition"
            >
              Check Availability
            </button>
          </div>
        </div>
      )}

      {/* Top Banner: Now Available */}
      {availableBanner && !lockBanner && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>This notepad is now available to edit.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                const ok = await claimLock(false)
                if (ok) {
                  setAvailableBanner(false)
                }
              }}
              className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition"
            >
              Start Editing
            </button>
            <button
              onClick={() => setAvailableBanner(false)}
              className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
              onClick={onReload}
              className="px-2.5 py-1 rounded bg-white dark:bg-neutral-900 border border-rose-300 dark:border-rose-700 text-xs font-medium hover:bg-rose-100/50"
            >
              Reload
            </button>
            <button
              onClick={() => {
                if (editor) {
                  currentVersionRef.current = data.version + 1
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
                data.isFavorite
                  ? 'text-amber-500 border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30'
                  : 'text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:text-neutral-600'
              }`}
              title="Favorite"
            >
              <Star className={`w-4 h-4 ${data.isFavorite ? 'fill-current' : ''}`} />
            </button>
          )}

          <span className="text-xs text-neutral-400">
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'conflict' && 'Conflict'}
            {saveStatus === 'error' && (
              <button
                type="button"
                onClick={() => {
                  if (editor) {
                    executeSave(JSON.stringify(editor.document))
                  }
                }}
                className="text-rose-500 hover:text-rose-600 underline font-medium cursor-pointer"
                title="Click to retry saving"
              >
                Offline, retrying… (click to retry)
              </button>
            )}
          </span>
        </div>
      </div>

      {/* Notepad Title Input */}
      {!hideTitle && (
        <div>
          <input
            type="text"
            value={data.title || ''}
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
                  data.kind === 'card' ? 'card' : 'notepad',
                  data.projectId || '',
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
                return getAtMenuSuggestions(query, data.projectId || '', editor)
              }}
            />

            {/* Hash (#) Menu: Project Tags */}
            <SuggestionMenuController
              triggerCharacter="#"
              getItems={async (query) => {
                return getHashMenuSuggestions(
                  query,
                  data.projectId || '',
                  initialData.id,
                  editor,
                  async (tagId) => {
                    const currentTags = data.tags.map((t) => t.id) || []
                    if (!currentTags.includes(tagId)) {
                      await fetch(`/api/notepads/${initialData.id}/tags`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tagIds: [...currentTags, tagId] }),
                      })
                      const res = await fetch(`/api/notepads/${initialData.id}`)
                      if (res.ok) {
                        const json = (await res.json()) as NotepadData
                        setData(json)
                      }
                    }
                  },
                )
              }}
            />
          </BlockNoteView>
        )}
      </div>

      {/* Reference Dialogs: /notepad and /task */}
      {dialogState.type === 'notepad' && data.projectId && (
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

      {dialogState.type === 'task' && data.projectId && (
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
      {data.backlinks && data.backlinks.length > 0 && (
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
                  href={`/p/${data.projectId}/notepads/${link.id}`}
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

export function NotepadEditor({
  notepadId,
  hideTitle = false,
  hideFavorite = false,
}: NotepadEditorProps) {
  const [data, setData] = useState<NotepadData | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  const loadNotepad = useCallback(async () => {
    try {
      const res = await fetch(`/api/notepads/${notepadId}`)
      if (!res.ok) throw new Error('Failed to load notepad')
      const json = (await res.json()) as NotepadData
      setData(json)
    } catch (err) {
      console.error('Failed to load notepad', err)
    } finally {
      setLoading(false)
    }
  }, [notepadId])

  useEffect(() => {
    setLoading(true)
    loadNotepad()
  }, [loadNotepad])

  if (loading || !data) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="h-64 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <NotepadEditorInner
      key={`${notepadId}-${reloadKey}`}
      initialData={data}
      hideTitle={hideTitle}
      hideFavorite={hideFavorite}
      onReload={() => {
        setReloadKey((k) => k + 1)
        loadNotepad()
      }}
    />
  )
}
