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
export declare function getDescendantIds(getChildren: (parentIds: string[]) => Promise<TreeNode[]>, rootId: string): Promise<string[]>;
/**
 * Calculate the depth of a node from the root (root = 1).
 * Uses the repository's getParent method.
 */
export declare function getDepth(getParent: (id: string) => Promise<TreeNode | null>, nodeId: string): Promise<number>;
/**
 * Calculate the height of the subtree rooted at rootId (a leaf has height 1).
 */
export declare function getSubtreeHeight(getChildren: (parentIds: string[]) => Promise<TreeNode[]>, rootId: string): Promise<number>;
/**
 * Returns true if moving source under targetParentId would cause a cycle.
 */
export declare function wouldCauseCycle(getDescendants: (rootId: string) => Promise<string[]>, sourceId: string, targetParentId: string | null): Promise<boolean>;
