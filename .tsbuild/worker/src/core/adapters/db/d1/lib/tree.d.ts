import type { DB } from '../client';
/**
 * Collect all descendant notepad IDs for a given root notepad.
 */
export declare function getDescendantIds(db: DB, rootId: string): Promise<string[]>;
/**
 * Calculate the depth of a notepad from the root (root = 1).
 */
export declare function getNotepadDepth(db: DB, notepadId: string): Promise<number>;
/**
 * Calculate the height of the subtree rooted at rootId (a leaf has height 1).
 */
export declare function getSubtreeHeight(db: DB, rootId: string): Promise<number>;
/**
 * Returns true if moving source under targetParentId would cause a cycle.
 */
export declare function wouldCauseCycle(db: DB, sourceId: string, targetParentId: string | null): Promise<boolean>;
