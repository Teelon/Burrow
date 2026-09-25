import type { NotepadNode } from '../../lib/queries';
export type DropMode = 'before' | 'after' | 'inside';
export declare const MAX_DEPTH = 8;
export declare const ROOT_EDGE_PX = 24;
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
export declare function buildTreeStructure(notepads: NotepadNode[]): TreeStructure;
export declare function depthOf(structure: TreeStructure, id: string, maxDepth?: number): number;
export declare function subtreeHeightOf(structure: TreeStructure, id: string): number;
/** The drop that corresponds to a note's current placement (for no-op checks). */
export declare function currentDropPlacement(structure: TreeStructure, id: string): {
    parentId: string | null;
    afterId: string | null;
};
export declare function rootAncestorOf(structure: TreeStructure, id: string, maxDepth?: number): string;
/** Validate a proposed placement against cycles, the depth cap, and no-ops. */
export declare function validatePlacement(structure: TreeStructure, params: {
    activeId: string;
    parentId: string | null;
    afterId: string | null;
    targetId: string | null;
    mode: DropMode;
    maxDepth?: number;
}): Projection | null;
export declare function computeBlankRootProjection(structure: TreeStructure, activeId: string, maxDepth?: number): Projection | null;
export declare function computeTargetProjection(structure: TreeStructure, params: {
    activeId: string;
    targetId: string;
    rect: TargetRect;
    pointerX?: number | null;
    pointerY?: number | null;
    rootEdgePx?: number;
    maxDepth?: number;
}): Projection | null;
