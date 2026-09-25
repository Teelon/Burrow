import type { NotepadNode } from '../../lib/queries';

export type DropMode = 'before' | 'after' | 'inside';

export const MAX_DEPTH = 8;
export const ROOT_EDGE_PX = 24;

export interface Projection {
  activeId: string;
  parentId: string | null;
  afterId: string | null;
  targetId: string | null;
  mode: DropMode;
}

export interface TreeStructure {
  roots: NotepadNode[];
  childrenMap: Map<string, NotepadNode[]>;
  parentById: Map<string, string | null>;
  nodeById: Map<string, NotepadNode>;
}

export interface TargetRect {
  top: number;
  bottom: number;
  left: number;
  right?: number;
}

/**
 * Builds lookup indexes from a flat list of notepad nodes.
 * Preserves sibling ordering based on input position.
 */
export function buildTreeStructure(notepads: NotepadNode[]): TreeStructure {
  const parentById = new Map<string, string | null>();
  const childrenMap = new Map<string, NotepadNode[]>();
  const nodeById = new Map<string, NotepadNode>();
  const roots: NotepadNode[] = [];

  for (const n of notepads) {
    parentById.set(n.id, n.parentId);
    nodeById.set(n.id, n);
  }

  for (const n of notepads) {
    if (n.parentId) {
      const list = childrenMap.get(n.parentId);
      if (list) list.push(n);
      else childrenMap.set(n.parentId, [n]);
    } else {
      roots.push(n);
    }
  }

  return { roots, childrenMap, parentById, nodeById };
}

export function depthOf(
  structure: TreeStructure,
  id: string,
  maxDepth = MAX_DEPTH,
): number {
  let depth = 1;
  let p = structure.parentById.get(id) ?? null;
  while (p !== null && depth <= maxDepth + 1) {
    depth += 1;
    p = structure.parentById.get(p) ?? null;
  }
  return depth;
}

export function subtreeHeightOf(structure: TreeStructure, id: string): number {
  const kids = structure.childrenMap.get(id) ?? [];
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((k) => subtreeHeightOf(structure, k.id)));
}

/** The drop that corresponds to a note's current placement (for no-op checks). */
export function currentDropPlacement(
  structure: TreeStructure,
  id: string,
): { parentId: string | null; afterId: string | null } {
  const parentId = structure.parentById.get(id) ?? null;
  const group = parentId ? (structure.childrenMap.get(parentId) ?? []) : structure.roots;
  const idx = group.findIndex((n) => n.id === id);
  const prev = idx > 0 ? group[idx - 1] : null;
  return { parentId, afterId: prev ? prev.id : null };
}

export function rootAncestorOf(
  structure: TreeStructure,
  id: string,
  maxDepth = MAX_DEPTH,
): string {
  let cur = id;
  let guard = 0;
  while (guard <= maxDepth + 1) {
    const p = structure.parentById.get(cur) ?? null;
    if (p === null) return cur;
    cur = p;
    guard += 1;
  }
  return cur;
}

/** Validate a proposed placement against cycles, the depth cap, and no-ops. */
export function validatePlacement(
  structure: TreeStructure,
  params: {
    activeId: string;
    parentId: string | null;
    afterId: string | null;
    targetId: string | null;
    mode: DropMode;
    maxDepth?: number;
  },
): Projection | null {
  const { activeId, parentId, afterId, targetId, mode, maxDepth = MAX_DEPTH } = params;

  // Inserting after yourself is a no-op
  if (afterId === activeId) return null;

  if (parentId !== null) {
    // Cannot be parented to yourself
    if (parentId === activeId) return null;

    // A parent inside your own subtree is a cycle
    let p = structure.parentById.get(parentId) ?? null;
    let guard = 0;
    while (p !== null && guard <= maxDepth + 1) {
      if (p === activeId) return null;
      p = structure.parentById.get(p) ?? null;
      guard += 1;
    }
    if (p !== null) return null; // Malformed / cyclic chain

    if (depthOf(structure, parentId, maxDepth) + subtreeHeightOf(structure, activeId) > maxDepth) {
      return null;
    }
  }

  const cur = currentDropPlacement(structure, activeId);
  if (cur.parentId === parentId && cur.afterId === afterId) {
    return null;
  }

  return { activeId, parentId, afterId, targetId, mode };
}

export function computeBlankRootProjection(
  structure: TreeStructure,
  activeId: string,
  maxDepth = MAX_DEPTH,
): Projection | null {
  const last = structure.roots.length > 0 ? structure.roots[structure.roots.length - 1] : null;
  return validatePlacement(structure, {
    activeId,
    parentId: null,
    afterId: last ? last.id : null,
    targetId: null,
    mode: 'after',
    maxDepth,
  });
}

export function computeTargetProjection(
  structure: TreeStructure,
  params: {
    activeId: string;
    targetId: string;
    rect: TargetRect;
    pointerX?: number | null;
    pointerY?: number | null;
    rootEdgePx?: number;
    maxDepth?: number;
  },
): Projection | null {
  const {
    activeId,
    targetId,
    rect,
    pointerX,
    pointerY,
    rootEdgePx = ROOT_EDGE_PX,
    maxDepth = MAX_DEPTH,
  } = params;

  if (!structure.nodeById.has(activeId) || !structure.nodeById.has(targetId)) {
    return null;
  }

  const rectHeight = Math.max(rect.bottom - rect.top, 1);

  // Left edge promotion: within rootEdgePx of the row's left edge promotes to root level
  // just above that row's root ancestor.
  if (pointerX !== null && pointerX !== undefined && pointerX <= rect.left + rootEdgePx) {
    const ancestor = rootAncestorOf(structure, targetId, maxDepth);
    const idx = structure.roots.findIndex((r) => r.id === ancestor);
    if (idx >= 0) {
      const prevRoot = idx > 0 ? structure.roots[idx - 1] : null;
      return validatePlacement(structure, {
        activeId,
        parentId: null,
        afterId: prevRoot ? prevRoot.id : null,
        targetId: ancestor,
        mode: 'before',
        maxDepth,
      });
    }
  }

  if (pointerY === null || pointerY === undefined) {
    return validatePlacement(structure, {
      activeId,
      parentId: targetId,
      afterId: null,
      targetId,
      mode: 'inside',
      maxDepth,
    });
  }

  const relY = Math.min(Math.max(pointerY - rect.top, 0), rectHeight);

  // Top zone: insert before target under target's parent
  if (relY < rectHeight * 0.28) {
    const parentId = structure.parentById.get(targetId) ?? null;
    const group = parentId ? (structure.childrenMap.get(parentId) ?? []) : structure.roots;
    const idx = group.findIndex((n) => n.id === targetId);
    const prev = idx > 0 ? group[idx - 1] : null;
    return validatePlacement(structure, {
      activeId,
      parentId,
      afterId: prev ? prev.id : null,
      targetId,
      mode: 'before',
      maxDepth,
    });
  }

  // Bottom zone: insert after target under target's parent
  if (relY > rectHeight * 0.72) {
    const parentId = structure.parentById.get(targetId) ?? null;
    return validatePlacement(structure, {
      activeId,
      parentId,
      afterId: targetId,
      targetId,
      mode: 'after',
      maxDepth,
    });
  }

  // Middle zone: insert inside target as first child
  return validatePlacement(structure, {
    activeId,
    parentId: targetId,
    afterId: null,
    targetId,
    mode: 'inside',
    maxDepth,
  });
}
