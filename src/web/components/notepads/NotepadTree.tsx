import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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
} from '@dnd-kit/core';
import { useMoveNotepad } from '../../lib/queries';
import type { NotepadNode } from '../../lib/queries';
import { StatusDiamond } from '../ui/StatusDiamond';

import {
  buildTreeStructure,
  computeBlankRootProjection,
  computeTargetProjection,
  type Projection,
} from './treeProjection';

export type { NotepadNode } from '../../lib/queries';
export type { Projection } from './treeProjection';

const AUTO_EXPAND_MS = 500;

/**
 * The blank-space droppable wrapping the root rows: dropping on empty space
 * inside it appends the note to the end of the root list. Must be rendered
 * *inside* the DndContext (a component cannot register droppables from the
 * same component that provides the context).
 */
function RootList({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: '__root__' });
  return (
    <div ref={setNodeRef} className="min-h-8 pb-4">
      {children}
    </div>
  );
}



interface TreeRowProps {
  node: NotepadNode;
  depth: number;
  projectId: string;
  childrenMap: Map<string, NotepadNode[]>;
  activeId: string | null;
  expanded: Record<string, boolean>;
  projection: Projection | null;
  isDeleting?: boolean;
  onCreateChild: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

function TreeRow({
  node,
  depth,
  projectId,
  childrenMap,
  activeId,
  expanded,
  projection,
  isDeleting = false,
  onCreateChild,
  onDelete,
  onToggle,
}: TreeRowProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tree:${node.id}`,
  });
  const { setNodeRef: setDropRef } = useDroppable({ id: `tree:${node.id}` });

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    setDropRef(el);
  };

  const children = childrenMap.get(node.id) ?? [];
  const hasChildren = children.length > 0;
  const isExpanded = Boolean(expanded[node.id]);
  const isActive = node.id === activeId;
  const mode = projection && projection.targetId === node.id ? projection.mode : null;
  const dimmed = isDragging;

  return (
    <div>
      <div
        ref={setRefs}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`group relative flex items-center justify-between pr-2 text-xs transition select-none min-h-[44px] md:min-h-0 py-2 md:py-1 ${
          isActive ? 'bg-hi text-text font-medium' : 'text-muted hover:bg-hi hover:text-text'
        } ${mode === 'inside' ? 'bg-accent/10 ring-2 ring-inset ring-accent' : ''} ${
          dimmed ? 'opacity-40' : ''
        }`}
      >
        {isActive && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />}
        {/* Primary insertion indicators (Basalt accent, no rounded pills) */}
        {mode === 'before' && (
          <span className="pointer-events-none absolute -top-px inset-x-1 z-10 h-0.5 bg-accent" />
        )}
        {mode === 'after' && (
          <span className="pointer-events-none absolute -bottom-px inset-x-1 z-10 h-0.5 bg-accent" />
        )}

        <Link
          to="/p/$projectId/notepads/$notepadId"
          params={{ projectId, notepadId: node.id }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hasChildren ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggle(node.id);
              }}
              className="flex shrink-0 h-11 w-11 md:h-6 md:w-6 items-center justify-center hover:bg-hi"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-muted" />
              ) : (
                <ChevronRight className="h-3 w-3 text-muted" />
              )}
            </button>
          ) : (
            <StatusDiamond color="var(--muted)" size={8} className="mx-2" />
          )}
          <span className="truncate">{node.title || 'Untitled'}</span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCreateChild(node.id);
            }}
            title="Add child notepad"
            className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center text-muted hover:bg-hi hover:text-text"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Delete to Trash"
            className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center text-muted hover:bg-hi hover:text-[var(--danger)] cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <div
            {...attributes}
            {...listeners}
            className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center cursor-grab active:cursor-grabbing text-muted hover:text-text touch-none"
            title="Drag to reorder"
          >
            <GripVertical className="h-3 w-3" aria-hidden />
          </div>
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
              isDeleting={isDeleting}
              onCreateChild={onCreateChild}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NotepadTree({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { notepadId?: string };
  const activeNotepadId = params.notepadId;

  const { data: notepads = [] } = useQuery<NotepadNode[]>({
    queryKey: ['notepads', projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/notepads`);
      if (!res.ok) throw new Error('Failed to load notepads');
      return res.json();
    },
    enabled: Boolean(projectId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notepads', projectId] });

  const createNotepad = useMutation({
    mutationFn: async ({ parentId, title }: { parentId?: string; title?: string }) => {
      const res = await fetch(`/api/projects/${projectId}/notepads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId, title }),
      });
      if (!res.ok) throw new Error('Failed to create notepad');
      return res.json();
    },
    onSuccess: invalidate,
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create notepad');
    },
  });

  const deleteNotepad = useMutation({
    mutationFn: async (notepadId: string) => {
      const res = await fetch(`/api/notepads/${notepadId}`, { method: 'DELETE' });
      // 404 means already deleted — treat as success, not an error
      if (res.status === 404) return { ok: true, deletedId: notepadId };
      if (!res.ok) throw new Error('Failed to delete notepad');
      return res.json();
    },
    retry: false,
    onSuccess: (_, deletedId) => {
      invalidate();
      if (deletedId === activeNotepadId) {
        navigate({ to: '/p/$projectId', params: { projectId } });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete notepad');
    },
  });

  const moveNote = useMoveNotepad(projectId);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [projection, setProjection] = useState<Projection | null>(null);
  const projectionRef = useRef<Projection | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const expandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { roots, childrenMap, parentById, nodeById } = useMemo(
    () => buildTreeStructure(notepads),
    [notepads],
  );

  const clearTimer = () => {
    if (expandTimer.current) {
      clearTimeout(expandTimer.current);
      expandTimer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  /**
   * Rows must be gapless so the pointer always sits inside *some* row while over
   * the list; prefer a row over the root container when both contain the pointer.
   * Falls back to closestCorners so moving slightly off the edge doesn't abruptly drop out.
   */
  const collisionDetection: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCorners(args);
    const hits = pointerWithin(args);
    const row = hits.find((c) => String(c.id).startsWith('tree:'));
    if (row) return [row];
    if (hits.length > 0) return [hits[0]!];
    return closestCorners(args);
  };

  /** Pure: derive a validated projection from a drag event (works for move/over/end). */
  const computeProjection = (event: DragMoveEvent): Projection | null => {
    const rawActive = String(event.active.id);
    if (!rawActive.startsWith('tree:')) return null;
    const activeId = rawActive.slice(5);
    if (!nodeById.has(activeId)) return null;

    const over = event.over;
    if (!over) return null;
    const rawOver = String(over.id);

    if (rawOver === '__root__') {
      return computeBlankRootProjection({ roots, childrenMap, parentById, nodeById }, activeId);
    }

    if (!rawOver.startsWith('tree:')) return null;
    const targetId = rawOver.slice(5);

    // Pointer position in client coordinates (activation point + drag delta).
    const activator = event.activatorEvent as Partial<PointerEvent>;
    const px = typeof activator.clientX === 'number' ? activator.clientX + event.delta.x : null;
    const py = typeof activator.clientY === 'number' ? activator.clientY + event.delta.y : null;

    return computeTargetProjection(
      { roots, childrenMap, parentById, nodeById },
      {
        activeId,
        targetId,
        rect: over.rect,
        pointerX: px,
        pointerY: py,
      },
    );
  };

  const handleDragStart = (event: DragStartEvent) => {
    clearTimer();
    const raw = String(event.active.id);
    setDragId(raw.startsWith('tree:') ? raw.slice(5) : null);
    setProjection(null);
    projectionRef.current = null;
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const p = computeProjection(event);
    projectionRef.current = p;
    setProjection(p);

    // Auto-expand a collapsed drop target while hovering "inside" it.
    clearTimer();
    if (p && p.mode === 'inside' && p.targetId && !expanded[p.targetId]) {
      const target = p.targetId;
      if ((childrenMap.get(target) ?? []).length > 0) {
        expandTimer.current = setTimeout(() => {
          setExpanded((prev) => ({ ...prev, [target]: true }));
          expandTimer.current = null;
        }, AUTO_EXPAND_MS);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    clearTimer();
    setDragId(null);
    const drop = projectionRef.current ?? computeProjection(event);
    projectionRef.current = null;
    setProjection(null);
    if (!drop) return;

    // Auto-expand the target parent so newly nested notepads are immediately visible
    if (drop.parentId) {
      setExpanded((prev) => ({ ...prev, [drop.parentId!]: true }));
    }

    moveNote.mutate({
      notepadId: drop.activeId,
      parentId: drop.parentId,
      afterId: drop.afterId,
    });
  };

  const handleDragCancel = () => {
    clearTimer();
    setDragId(null);
    projectionRef.current = null;
    setProjection(null);
  };

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const createChild = (parentId: string) => {
    createNotepad.mutate({ parentId, title: 'Untitled' });
    setExpanded((prev) => ({ ...prev, [parentId]: true }));
  };

  const draggedNode = dragId ? (nodeById.get(dragId) ?? null) : null;

  return (
    <div className="space-y-1">
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
            <div className="px-2 py-1 text-xs italic text-muted">No notepads yet</div>
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
                isDeleting={deleteNotepad.isPending}
                onCreateChild={createChild}
                onDelete={(id) => deleteNotepad.mutate(id)}
                onToggle={toggleExpand}
              />
            ))
          )}
        </RootList>

        <DragOverlay dropAnimation={null}>
          {draggedNode ? (
            <div className="flex items-center gap-1.5 border border-line bg-surface px-3 py-2 text-xs text-text pointer-events-none">
              <GripVertical className="h-3 w-3 text-muted" />
              <span className="max-w-40 truncate">{draggedNode.title || 'Untitled'}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
