/**
 * Tree utilities for notepad hierarchy operations.
 * These are pure functions that work with repository interfaces.
 */

export interface TreeNode {
  id: string;
  parentId: string | null;
}

/**
 * Collect all descendant IDs for a given root node.
 * Uses the repository's getChildren method.
 */
export async function getDescendantIds(
  getChildren: (parentIds: string[]) => Promise<TreeNode[]>,
  rootId: string,
): Promise<string[]> {
  const descendants: string[] = [];
  let currentParentIds = [rootId];

  while (currentParentIds.length > 0) {
    const children = await getChildren(currentParentIds);
    if (children.length === 0) break;
    const childIds = children.map((c) => c.id);
    descendants.push(...childIds);
    currentParentIds = childIds;
  }

  return descendants;
}

/**
 * Calculate the depth of a node from the root (root = 1).
 * Uses the repository's getParent method.
 */
export async function getDepth(
  getParent: (id: string) => Promise<TreeNode | null>,
  nodeId: string,
): Promise<number> {
  let depth = 1;
  let currentId: string | null = nodeId;

  while (currentId && depth <= 20) {
    const parent = await getParent(currentId);
    if (!parent || !parent.parentId) break;
    depth++;
    currentId = parent.parentId;
  }

  return depth;
}

/**
 * Calculate the height of the subtree rooted at rootId (a leaf has height 1).
 */
export async function getSubtreeHeight(
  getChildren: (parentIds: string[]) => Promise<TreeNode[]>,
  rootId: string,
): Promise<number> {
  let height = 1;
  let currentParentIds = [rootId];

  while (currentParentIds.length > 0) {
    const children = await getChildren(currentParentIds);
    if (children.length === 0) break;
    height++;
    currentParentIds = children.map((c) => c.id);
  }

  return height;
}

/**
 * Returns true if moving source under targetParentId would cause a cycle.
 */
export async function wouldCauseCycle(
  getDescendants: (rootId: string) => Promise<string[]>,
  sourceId: string,
  targetParentId: string | null,
): Promise<boolean> {
  if (!targetParentId) return false;
  if (sourceId === targetParentId) return true;

  const descendants = await getDescendants(sourceId);
  return descendants.includes(targetParentId);
}
