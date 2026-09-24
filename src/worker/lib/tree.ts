import { eq, inArray } from 'drizzle-orm';
import type { DB } from '../db/client';
import * as t from '../db/schema';

/**
 * Collect all descendant notepad IDs for a given root notepad.
 */
export async function getDescendantIds(db: DB, rootId: string): Promise<string[]> {
  const descendants: string[] = [];
  let currentParentIds = [rootId];

  while (currentParentIds.length > 0) {
    const children = await db
      .select({ id: t.notepads.id })
      .from(t.notepads)
      .where(inArray(t.notepads.parentId, currentParentIds));

    if (children.length === 0) break;
    const childIds = children.map((c) => c.id);
    descendants.push(...childIds);
    currentParentIds = childIds;
  }

  return descendants;
}

/**
 * Calculate the depth of a notepad from the root (root = 1).
 */
export async function getNotepadDepth(db: DB, notepadId: string): Promise<number> {
  let depth = 1;
  let currentId: string | null = notepadId;

  while (currentId && depth <= 20) {
    const [row] = await db
      .select({ parentId: t.notepads.parentId })
      .from(t.notepads)
      .where(eq(t.notepads.id, currentId));

    if (!row || !row.parentId) break;
    depth++;
    currentId = row.parentId;
  }

  return depth;
}

/**
 * Calculate the height of the subtree rooted at rootId (a leaf has height 1).
 */
export async function getSubtreeHeight(db: DB, rootId: string): Promise<number> {
  let height = 1;
  let currentParentIds = [rootId];

  while (currentParentIds.length > 0) {
    const children = await db
      .select({ id: t.notepads.id })
      .from(t.notepads)
      .where(inArray(t.notepads.parentId, currentParentIds));

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
  db: DB,
  sourceId: string,
  targetParentId: string | null,
): Promise<boolean> {
  if (!targetParentId) return false;
  if (sourceId === targetParentId) return true;

  const descendants = await getDescendantIds(db, sourceId);
  return descendants.includes(targetParentId);
}
