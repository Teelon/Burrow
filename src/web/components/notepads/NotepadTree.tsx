import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMoveNotepad } from '../../lib/queries'
import type { NotepadNode } from '../../lib/queries'

export type { NotepadNode } from '../../lib/queries'

/** Matches the server-side limit (root depth = 1). */
const MAX_DEPTH = 8
const AUTO_EXPAND_MS = 500
/** Left edge of a row (within this many px) promotes the dragged note to the root level. */
const ROOT_EDGE_PX = 16

type DropMode = 'before' | 'after' | 'inside'

/**
 * A validated drop: where the note will land plus what to highlight.
 * `targetId: null` means "end of the root list" (dropped on blank space).
 */
interface Projection {
  activeId: string
  parentId: string | null
  afterId: string | null
  targetId: string | null
  mode: DropMode
}

/**
 * The blank-space droppable wrapping the root rows: dropping on empty space
 * inside it appends the note to the end of the root list. Must be rendered
 * *inside* the DndContext (a component cannot register droppables from the
 * same component that provides the context).
 */
function RootList({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: '__root__' })
  return (
    <div ref={setNodeRef} className="min-h-4">
      {children}
    </div>
  )
}

interface Structure {
  roots: NotepadNode[]
  childrenMap: Map<string, NotepadNode[]>
  parentById: Map<string, string | null>
  nodeById: Map<string, NotepadNode>
}

/**
 * The flat notepad list comes back ordered by position, which is unique and
 * ascending within each sibling group — so simply bucketing preserves order.
 */
function buildStructure(notepads: NotepadNode[]): Structure {
  const parentById = new Map<string, string | null>()
  const childrenMap = new Map<string, NotepadNode[]>()
  const nodeById = new Map<string, NotepadNode>()
  const roots: NotepadNode[] = []
  for (const n of notepads) {
    parentById.set(n.id, n.parentId)
    nodeById.set(n.id, n)
  }
  for (const n of notepads) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId)
      if (list) list.push(n)
      else childrenMap.set(n.parentId, [n])
    } else {
      roots.push(n)
    }
  }
  return { roots, childrenMap, parentById, nodeById }
}

interface TreeRowProps {
  node: NotepadNode
  depth: number
  projectId: string
  childrenMap: Map<string, NotepadNode[]>
  activeId: string | null
  expanded: Record<string, boolean>
  projection: Projection | null
  onCreateChild: (id: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}

function TreeRow({
  node,
  depth,
  projectId,
  childrenMap,
  activeId,
  expanded,
  projection,
  onCreateChild,
  onDelete,
  onToggle,
}: TreeRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tree:${node.id}`,
  })
  const { setNodeRef: setDropRef } = useDroppable({ id: `tree:${node.id}` })

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el)
    setDropRef(el)
  }

  const children = childrenMap.get(node.id) ?? []
  const hasChildren = children.length > 0
  const isExpanded = Boolean(expanded[node.id])
  const isActive = node.id === activeId
  const mode = projection && projection.targetId === node.id ? projection.mode : null
  const dimmed = isDragging

  return (
    <div>
      <div
        ref={setRefs}
        {...attributes}
        {...listeners}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`group relative flex items-center justify-between rounded-lg py-1 pr-2 text-xs transition select-none cursor-grab active:cursor-grabbing ${
          isActive
            ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
            : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'
        } ${mode === 'inside' ? 'bg-primary/10 ring-2 ring-inset ring-primary/60' : ''} ${
          dimmed ? 'opacity-40' : ''
        }`}
      >
        {/* Insertion indicators */}
        {mode === 'before' && (
          <span className="pointer-events-none absolute -top-px inset-x-1 z-10 h-0.5 rounded bg-primary" />
        )}
        {mode === 'after' && (
          <span className="pointer-events-none absolute -bottom-px inset-x-1 z-10 h-0.5 rounded bg-primary" />
        )}

        <Link
          to="/p/$projectId/notepads/$notepadId"
          params={{ projectId, notepadId: node.id }}
          className="flex min-w-0 flex-1 items-center gap-1.5"
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggle(node.id)
              }}
              className="shrink-0 rounded p-0.5 hover:bg-neutral-300 dark:hover:bg-neutral-700"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-neutral-400" />
              ) : (
                <ChevronRight className="h-3 w-3 text-neutral-400" />
              )}
            </button>
          ) : (
            <FileText className="h-3 w-3 shrink-0 text-neutral-400" />
          )}
          <span className="truncate">{node.title || 'Untitled'}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCreateChild(node.id)
            }}
            title="Add child notepad"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(node.id)
            }}
            title="Delete to Trash"
            className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-500 dark:hover:bg-neutral-800"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <GripVertical
            className="h-3 w-3 cursor-grab text-neutral-300 dark:text-neutral-600"
            aria-hidden
          />
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              projectId={projectId}
              childrenMap={childrenMap}
              activeId={activeId}
              expanded={expanded}
              projection={projection}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notepads', projectId] })

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
    onSuccess: invalidate,
  })

  const deleteNotepad = useMutation({
    mutationFn: async (notepadId: string) => {
      const res = await fetch(`/api/notepads/${notepadId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete notepad')
      return res.json()
    },
    onSuccess: invalidate,
  })

  const moveNote = useMoveNotepad(projectId)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [projection, setProjection] = useState<Projection | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { roots, childrenMap, parentById, nodeById } = useMemo(
    () => buildStructure(notepads),
    [notepads],
  )

  const clearTimer = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current)
      expandTimer.current = null
    }
  }
  useEffect(() => clearTimer, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  /**
   * Rows must be gapless so the pointer always sits inside *some* row while over
   * the list; prefer a row over the root container when both contain the pointer.
   */
  const collisionDetection: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCorners(args)
    const hits = pointerWithin(args)
    if (hits.length === 0) return []
    const row = hits.find((c) => String(c.id).startsWith('tree:'))
    if (row) return [row]
    const first = hits[0]
    return first ? [first] : []
  }

  // -- resolution helpers (closures over the current structure) -------------

  const depthOf = (id: string): number => {
    let depth = 1
    let p = parentById.get(id) ?? null
    while (p !== null && depth <= MAX_DEPTH + 1) {
      depth += 1
      p = parentById.get(p) ?? null
    }
    return depth
  }

  const subtreeHeightOf = (id: string): number => {
    const kids = childrenMap.get(id) ?? []
    if (kids.length === 0) return 1
    return 1 + Math.max(...kids.map((k) => subtreeHeightOf(k.id)))
  }

  /** The drop that corresponds to a note's current placement (for no-op checks). */
  const currentDrop = (id: string): { parentId: string | null; afterId: string | null } => {
    const parentId = parentById.get(id) ?? null
    const group = parentId ? (childrenMap.get(parentId) ?? []) : roots
    const idx = group.findIndex((n) => n.id === id)
    const prev = idx > 0 ? group[idx - 1] : null
    return { parentId, afterId: prev ? prev.id : null }
  }

  const rootAncestorOf = (id: string): string => {
    let cur = id
    let guard = 0
    while (guard <= MAX_DEPTH + 1) {
      const p = parentById.get(cur) ?? null
      if (p === null) return cur
      cur = p
      guard += 1
    }
    return cur
  }

  /** Validate a proposed placement against cycles, the depth cap, and no-ops. */
  const validate = (
    activeId: string,
    parentId: string | null,
    afterId: string | null,
    targetId: string | null,
    mode: DropMode,
  ): Projection | null => {
    // Inserting after yourself is a no-op; a parent inside your own subtree is a cycle.
    if (afterId === activeId) return null
    if (parentId !== null) {
      if (parentId === activeId) return null
      let p = parentById.get(parentId) ?? null
      let guard = 0
      while (p !== null && guard <= MAX_DEPTH + 1) {
        if (p === activeId) return null
        p = parentById.get(p) ?? null
        guard += 1
      }
      if (p !== null) return null // walked past the guard: malformed chain
      if (depthOf(parentId) + subtreeHeightOf(activeId) > MAX_DEPTH) return null
    }
    const cur = currentDrop(activeId)
    if (cur.parentId === parentId && cur.afterId === afterId) return null
    return { activeId, parentId, afterId, targetId, mode }
  }

  /** Pure: derive a validated projection from a drag event (works for move/over/end). */
  const computeProjection = (event: DragMoveEvent): Projection | null => {
    const rawActive = String(event.active.id)
    if (!rawActive.startsWith('tree:')) return null
    const activeId = rawActive.slice(5)
    if (!nodeById.has(activeId)) return null

    const over = event.over
    if (!over) return null
    const rawOver = String(over.id)

    // Pointer position in client coordinates (activation point + drag delta).
    const activator = event.activatorEvent as Partial<PointerEvent>
    const px = typeof activator.clientX === 'number' ? activator.clientX + event.delta.x : null
    const py = typeof activator.clientY === 'number' ? activator.clientY + event.delta.y : null

    // Dropped on the blank area of the list → append to the end of the roots.
    if (rawOver === '__root__') {
      const last = roots.length > 0 ? roots[roots.length - 1] : null
      return validate(activeId, null, last ? last.id : null, null, 'after')
    }

    if (!rawOver.startsWith('tree:')) return null
    const targetId = rawOver.slice(5)
    if (!nodeById.has(targetId)) return null

    const rect = over.rect
    const rectHeight = rect.bottom - rect.top

    // Left edge of any row → promote to root, just above that row's root ancestor.
    if (px !== null && px <= rect.left + ROOT_EDGE_PX) {
      const ancestor = rootAncestorOf(targetId)
      const idx = roots.findIndex((r) => r.id === ancestor)
      if (idx >= 0) {
        const prevRoot = idx > 0 ? roots[idx - 1] : null
        return validate(activeId, null, prevRoot ? prevRoot.id : null, ancestor, 'before')
      }
    }

    if (py === null) return validate(activeId, targetId, null, targetId, 'inside')

    const relY = Math.min(Math.max(py - rect.top, 0), rectHeight)
    if (relY < rectHeight / 3) {
      const parentId = parentById.get(targetId) ?? null
      const group = parentId ? (childrenMap.get(parentId) ?? []) : roots
      const idx = group.findIndex((n) => n.id === targetId)
      const prev = idx > 0 ? group[idx - 1] : null
      return validate(activeId, parentId, prev ? prev.id : null, targetId, 'before')
    }
    if (relY > (rectHeight * 2) / 3) {
      const parentId = parentById.get(targetId) ?? null
      return validate(activeId, parentId, targetId, targetId, 'after')
    }
    return validate(activeId, targetId, null, targetId, 'inside')
  }

  const handleDragStart = (event: DragStartEvent) => {
    clearTimer()
    const raw = String(event.active.id)
    setDragId(raw.startsWith('tree:') ? raw.slice(5) : null)
    setProjection(null)
  }

  const handleDragMove = (event: DragMoveEvent) => {
    const p = computeProjection(event)
    setProjection(p)

    // Auto-expand a collapsed drop target while hovering "inside" it.
    clearTimer()
    if (p && p.mode === 'inside' && p.targetId && !expanded[p.targetId]) {
      const target = p.targetId
      if ((childrenMap.get(target) ?? []).length > 0) {
        expandTimer.current = setTimeout(() => {
          setExpanded((prev) => ({ ...prev, [target]: true }))
          expandTimer.current = null
        }, AUTO_EXPAND_MS)
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    clearTimer()
    setDragId(null)
    const drop = computeProjection(event)
    setProjection(null)
    if (!drop) return
    moveNote.mutate({
      notepadId: drop.activeId,
      parentId: drop.parentId,
      afterId: drop.afterId,
    })
  }

  const handleDragCancel = () => {
    clearTimer()
    setDragId(null)
    setProjection(null)
  }

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))

  const createChild = (parentId: string) => {
    createNotepad.mutate({ parentId, title: 'Untitled' })
    setExpanded((prev) => ({ ...prev, [parentId]: true }))
  }

  const draggedNode = dragId ? (nodeById.get(dragId) ?? null) : null

  return (
    <div className="space-y-1">
      {/* Header: label + new root notepad */}
      <div className="flex items-center justify-between px-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Pages
        </span>
        <button
          type="button"
          onClick={() => createNotepad.mutate({ title: 'Untitled' })}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
          title="New root notepad"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragMove}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <RootList>
          {roots.length === 0 ? (
            <div className="px-2 py-1 text-xs italic text-neutral-400">No notepads yet</div>
          ) : (
            roots.map((root) => (
              <TreeRow
                key={root.id}
                node={root}
                depth={0}
                projectId={projectId}
                childrenMap={childrenMap}
                activeId={activeNotepadId ?? null}
                expanded={expanded}
                projection={projection}
                onCreateChild={createChild}
                onDelete={(id) => deleteNotepad.mutate(id)}
                onToggle={toggleExpand}
              />
            ))
          )}
        </RootList>

        <DragOverlay dropAnimation={null}>
          {draggedNode ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 shadow-lg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <GripVertical className="h-3 w-3 text-neutral-400" />
              <span className="max-w-40 truncate">{draggedNode.title || 'Untitled'}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
