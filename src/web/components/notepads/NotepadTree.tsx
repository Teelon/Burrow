import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react'

export interface NotepadNode {
  id: string
  parentId: string | null
  title: string
  icon?: string | null
  position: string
  isFavorite: boolean
}

export function NotepadTree({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient()
  const params = useParams({ strict: false }) as { notepadId?: string }
  const activeNotepadId = params.notepadId

  const { data: notepads = [] } = useQuery<NotepadNode[]>({
    queryKey: ['notepads', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/notepads`)
      if (!res.ok) throw new Error('Failed to load notepads')
      return res.json()
    },
    enabled: Boolean(projectId),
  })

  const createNotepad = useMutation({
    mutationFn: async ({ parentId, title }: { parentId?: string; title?: string }) => {
      const res = await fetch(`/api/projects/${projectId}/notepads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, title }),
      })
      if (!res.ok) throw new Error('Failed to create notepad')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notepads', projectId] })
    },
  })

  const deleteNotepad = useMutation({
    mutationFn: async (notepadId: string) => {
      const res = await fetch(`/api/notepads/${notepadId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete notepad')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notepads', projectId] })
    },
  })

  // Build tree hierarchy
  const roots = notepads.filter((n) => !n.parentId)
  const childrenMap = new Map<string, NotepadNode[]>()
  for (const n of notepads) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId) || []
      list.push(n)
      childrenMap.set(n.parentId, list)
    }
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const renderNode = (node: NotepadNode, depth = 0) => {
    const children = childrenMap.get(node.id) || []
    const hasChildren = children.length > 0
    const isExpanded = expanded[node.id] ?? false
    const isActive = node.id === activeNotepadId

    return (
      <div key={node.id} className="space-y-0.5">
        <div
          className={`group flex items-center justify-between px-2 py-1 rounded-lg text-xs transition cursor-pointer ${
            isActive
              ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <Link
            to="/p/$projectId/notepads/$notepadId"
            params={{ projectId, notepadId: node.id }}
            className="flex items-center gap-1.5 flex-1 min-w-0"
          >
            {hasChildren ? (
              <button
                onClick={(e) => toggleExpand(node.id, e)}
                className="p-0.5 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-neutral-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-neutral-400" />
                )}
              </button>
            ) : (
              <FileText className="w-3 h-3 text-neutral-400 shrink-0" />
            )}
            <span className="truncate">{node.title || 'Untitled'}</span>
          </Link>

          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                createNotepad.mutate({ parentId: node.id, title: 'Untitled' })
                setExpanded((prev) => ({ ...prev, [node.id]: true }))
              }}
              title="Add child notepad"
              className="p-1 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              onClick={() => deleteNotepad.mutate(node.id)}
              title="Delete to Trash"
              className="p-1 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-500"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
          Pages
        </span>
        <button
          onClick={() => createNotepad.mutate({ title: 'Untitled' })}
          className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-neutral-500 dark:text-neutral-400"
          title="New root notepad"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {roots.length === 0 ? (
        <div className="px-2 py-1 text-xs text-neutral-400 italic">
          No notepads yet
        </div>
      ) : (
        roots.map((root) => renderNode(root, 0))
      )}
    </div>
  )
}
