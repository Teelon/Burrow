import { describe, expect, it } from 'vitest';
import type { NotepadNode } from '../../lib/queries';
import {
  buildTreeStructure,
  computeBlankRootProjection,
  computeTargetProjection,
  currentDropPlacement,
  depthOf,
  rootAncestorOf,
  subtreeHeightOf,
  validatePlacement,
} from './treeProjection';

function makeNode(
  id: string,
  parentId: string | null = null,
  position: string = '0',
  title = `Note ${id}`,
): NotepadNode {
  return {
    id,
    parentId,
    title,
    position,
    icon: null,
    isFavorite: false,
  };
}

describe('treeProjection pure spatial algorithm', () => {
  const treeNodes: NotepadNode[] = [
    makeNode('r1', null, 'a'),
    makeNode('r2', null, 'b'),
    makeNode('c1', 'r1', 'a'),
    makeNode('c2', 'r1', 'b'),
    makeNode('gc1', 'c1', 'a'),
    makeNode('r3', null, 'c'),
  ];

  const structure = buildTreeStructure(treeNodes);

  it('buildTreeStructure builds roots, childrenMap, and parentById correctly', () => {
    expect(structure.roots.map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
    expect(structure.childrenMap.get('r1')?.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(structure.childrenMap.get('c1')?.map((c) => c.id)).toEqual(['gc1']);
    expect(structure.parentById.get('gc1')).toBe('c1');
    expect(structure.parentById.get('c1')).toBe('r1');
    expect(structure.parentById.get('r1')).toBeNull();
  });

  it('computes depthOf accurately', () => {
    expect(depthOf(structure, 'r1')).toBe(1);
    expect(depthOf(structure, 'c1')).toBe(2);
    expect(depthOf(structure, 'gc1')).toBe(3);
  });

  it('computes subtreeHeightOf accurately', () => {
    expect(subtreeHeightOf(structure, 'gc1')).toBe(1);
    expect(subtreeHeightOf(structure, 'c1')).toBe(2);
    expect(subtreeHeightOf(structure, 'r1')).toBe(3);
    expect(subtreeHeightOf(structure, 'r2')).toBe(1);
  });

  it('finds rootAncestorOf correctly', () => {
    expect(rootAncestorOf(structure, 'r1')).toBe('r1');
    expect(rootAncestorOf(structure, 'c1')).toBe('r1');
    expect(rootAncestorOf(structure, 'gc1')).toBe('r1');
    expect(rootAncestorOf(structure, 'r3')).toBe('r3');
  });

  it('finds currentDropPlacement for no-op checking', () => {
    expect(currentDropPlacement(structure, 'r1')).toEqual({ parentId: null, afterId: null });
    expect(currentDropPlacement(structure, 'r2')).toEqual({ parentId: null, afterId: 'r1' });
    expect(currentDropPlacement(structure, 'c2')).toEqual({ parentId: 'r1', afterId: 'c1' });
  });

  describe('validatePlacement', () => {
    it('rejects dropping a node after itself', () => {
      const res = validatePlacement(structure, {
        activeId: 'r2',
        parentId: null,
        afterId: 'r2',
        targetId: 'r2',
        mode: 'after',
      });
      expect(res).toBeNull();
    });

    it('rejects parenting a node to itself', () => {
      const res = validatePlacement(structure, {
        activeId: 'r1',
        parentId: 'r1',
        afterId: null,
        targetId: 'r1',
        mode: 'inside',
      });
      expect(res).toBeNull();
    });

    it('rejects cycle: moving an ancestor into its own descendant', () => {
      const res = validatePlacement(structure, {
        activeId: 'r1',
        parentId: 'gc1',
        afterId: null,
        targetId: 'gc1',
        mode: 'inside',
      });
      expect(res).toBeNull();
    });

    it('rejects placement that exceeds maxDepth', () => {
      const res = validatePlacement(structure, {
        activeId: 'r2',
        parentId: 'gc1',
        afterId: null,
        targetId: 'gc1',
        mode: 'inside',
        maxDepth: 3,
      });
      expect(res).toBeNull();
    });

    it('rejects no-op placement (same parent and predecessor)', () => {
      const res = validatePlacement(structure, {
        activeId: 'c2',
        parentId: 'r1',
        afterId: 'c1',
        targetId: 'c1',
        mode: 'after',
      });
      expect(res).toBeNull();
    });

    it('accepts valid moves', () => {
      const res = validatePlacement(structure, {
        activeId: 'c2',
        parentId: null,
        afterId: 'r3',
        targetId: 'r3',
        mode: 'after',
      });
      expect(res).toEqual({
        activeId: 'c2',
        parentId: null,
        afterId: 'r3',
        targetId: 'r3',
        mode: 'after',
      });
    });
  });

  describe('computeTargetProjection', () => {
    const rect = { top: 100, bottom: 200, left: 10, right: 210 };

    it('returns mode before when hovering in top zone (relY < 0.28)', () => {
      const res = computeTargetProjection(structure, {
        activeId: 'r3',
        targetId: 'r2',
        rect,
        pointerX: 100,
        pointerY: 110,
      });
      expect(res).toEqual({
        activeId: 'r3',
        parentId: null,
        afterId: 'r1',
        targetId: 'r2',
        mode: 'before',
      });
    });

    it('returns mode after when hovering in bottom zone (relY > 0.72)', () => {
      const res = computeTargetProjection(structure, {
        activeId: 'r1',
        targetId: 'r2',
        rect,
        pointerX: 100,
        pointerY: 180,
      });
      expect(res).toEqual({
        activeId: 'r1',
        parentId: null,
        afterId: 'r2',
        targetId: 'r2',
        mode: 'after',
      });
    });

    it('returns mode inside when hovering in middle zone', () => {
      const res = computeTargetProjection(structure, {
        activeId: 'r3',
        targetId: 'r2',
        rect,
        pointerX: 100,
        pointerY: 150,
      });
      expect(res).toEqual({
        activeId: 'r3',
        parentId: 'r2',
        afterId: null,
        targetId: 'r2',
        mode: 'inside',
      });
    });

    it('promotes to root before root ancestor when pointer is near left edge', () => {
      const res = computeTargetProjection(structure, {
        activeId: 'r3',
        targetId: 'gc1',
        rect,
        pointerX: 20,
        pointerY: 150,
      });
      expect(res).toEqual({
        activeId: 'r3',
        parentId: null,
        afterId: null,
        targetId: 'r1',
        mode: 'before',
      });
    });
  });

  describe('computeBlankRootProjection', () => {
    it('appends to end of roots', () => {
      const res = computeBlankRootProjection(structure, 'c1');
      expect(res).toEqual({
        activeId: 'c1',
        parentId: null,
        afterId: 'r3',
        targetId: null,
        mode: 'after',
      });
    });
  });
});
