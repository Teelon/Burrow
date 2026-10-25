import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createD1Db } from '../../src/core/adapters/db/d1/client';
import { createBoardRepository } from '../../src/core/adapters/db/d1/repositories/board';
import { createCardRepository } from '../../src/core/adapters/db/d1/repositories/card';
import { createNotepadRepository } from '../../src/core/adapters/db/d1/repositories/notepad';
import { getDescendantIds, getSubtreeHeight } from '../../src/core/adapters/db/d1/lib/tree';
import * as schema from '../../src/core/adapters/db/d1/schema';

describe('D1 Limits Contract (150+ entities: batch size & parameter limits)', () => {
  let workspaceId = '';
  let userId = '';

  beforeAll(async () => {
    const db = createD1Db(env.DB);
    workspaceId = crypto.randomUUID();
    userId = crypto.randomUUID();

    await db.insert(schema.user).values({
      id: userId,
      name: 'limits-test-user',
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(schema.workspaces).values({
      id: workspaceId,
      name: 'limits-test-ws',
      createdBy: userId,
      createdAt: Date.now(),
    });
  });

  async function seedProject(): Promise<string> {
    const db = createD1Db(env.DB);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(schema.projects).values({
      id,
      workspaceId,
      name: `limits-project-${id}`,
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function bulkInsertNotepads(db: any, rows: any[]) {
    const BATCH_SIZE = 5; // 5 rows * ~12-16 params = 60-80 params <= 100
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db.insert(schema.notepads).values(rows.slice(i, i + BATCH_SIZE));
    }
  }

  async function bulkInsertCards(db: any, rows: any[]) {
    const BATCH_SIZE = 10; // 10 rows * 7 params = 70 params <= 100
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await db.insert(schema.cards).values(rows.slice(i, i + BATCH_SIZE));
    }
  }

  // -------------------------------------------------------------------------
  // Case A: Board with 150+ cards
  // -------------------------------------------------------------------------
  it('handles a board with 150+ cards through lookup, soft-delete, restore, and delete', async () => {
    const db = createD1Db(env.DB);
    const boardRepo = createBoardRepository(db);
    const cardRepo = createCardRepository(db);

    const projectId = await seedProject();
    const boardId = crypto.randomUUID();
    const columnId = crypto.randomUUID();
    const now = Date.now();

    await boardRepo.create({
      id: boardId,
      workspaceId,
      projectId,
      name: 'High Capacity Board',
      icon: null,
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });

    await boardRepo.createColumn({
      id: columnId,
      boardId,
      name: 'Column 1',
      color: null,
      wipLimit: null,
      position: 'a0',
    });

    const CARD_COUNT = 160;
    const cardIds: string[] = [];
    const notepadIds: string[] = [];

    // Seed 160 cards + notepads
    const notepadRows = [];
    const cardRows = [];

    for (let i = 0; i < CARD_COUNT; i++) {
      const cId = crypto.randomUUID();
      const npId = crypto.randomUUID();
      cardIds.push(cId);
      notepadIds.push(npId);

      notepadRows.push({
        id: npId,
        workspaceId,
        projectId,
        kind: 'card' as const,
        title: `Card ${i}`,
        content: JSON.stringify([{ type: 'paragraph', children: [{ text: `Body of card ${i}` }] }]),
        version: 1,
        position: `p${String(i).padStart(4, '0')}`,
        isFavorite: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });

      cardRows.push({
        id: cId,
        boardId,
        columnId,
        notepadId: npId,
        position: `p${String(i).padStart(4, '0')}`,
        priority: 'medium' as const,
        createdAt: now,
      });
    }

    await bulkInsertNotepads(db, notepadRows);
    await bulkInsertCards(db, cardRows);

    // Also seed assignees and subtasks on some cards to test relations chunking
    await db.insert(schema.cardAssignees).values([
      { cardId: cardIds[0]!, userId },
      { cardId: cardIds[1]!, userId },
    ]);
    await db.insert(schema.cardSubtasks).values([
      {
        id: crypto.randomUUID(),
        cardId: cardIds[0]!,
        title: 'Subtask 1',
        completed: false,
        position: 'a0',
        createdAt: now,
      },
    ]);

    // 1. LOOKUP: getBoardWithDetails (fetches cards, assignees, subtasks, tags with chunked inArray)
    const boardWithDetails = await boardRepo.getBoardWithDetails(boardId, workspaceId);
    expect(boardWithDetails).not.toBeNull();
    expect(boardWithDetails?.columns[0]?.cards).toHaveLength(CARD_COUNT);

    // 1b. LOOKUP: getCardsSummary (exercises chunkInList on 160 IDs)
    const summaries = await cardRepo.getCardsSummary(workspaceId, cardIds);
    expect(summaries).toHaveLength(CARD_COUNT);

    // 2. SOFT DELETE: soft-deletes board and all 160 cards without exceeding batch limit
    const deleteTimestamp = Date.now();
    await boardRepo.softDelete(boardId, deleteTimestamp);

    const deletedBoard = await boardRepo.findById(boardId);
    expect(deletedBoard?.deletedAt).toBe(deleteTimestamp);

    const boardAfterSoftDelete = await boardRepo.getBoardWithDetails(boardId, workspaceId);
    expect(boardAfterSoftDelete).toBeNull();

    // 3. RESTORE: restores board, cards, and re-inserts 160 FTS rows split across batches
    await boardRepo.restore(boardId);

    // 3b. IDEMPOTENT RESTORE: re-running restore succeeds without error or duplicate index rows
    await boardRepo.restore(boardId);

    const restoredBoard = await boardRepo.getBoardWithDetails(boardId, workspaceId);
    expect(restoredBoard).not.toBeNull();
    expect(restoredBoard?.columns[0]?.cards).toHaveLength(CARD_COUNT);

    // 4. HARD DELETE: deletes board, columns, 160 cards, and notepads across batches
    await boardRepo.hardDelete(boardId);

    const nonExistent = await boardRepo.findById(boardId);
    expect(nonExistent).toBeNull();

    const nonExistentCards = await cardRepo.getCardsSummary(workspaceId, cardIds);
    expect(nonExistentCards).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Case B: Notepad subtree with 150+ descendants
  // -------------------------------------------------------------------------
  it('handles a notepad subtree with 150+ descendants through lookup, soft-delete, restore, and delete', async () => {
    const db = createD1Db(env.DB);
    const notepadRepo = createNotepadRepository(db);

    const projectId = await seedProject();
    const rootId = crypto.randomUUID();
    const now = Date.now();

    await notepadRepo.create({
      id: rootId,
      workspaceId,
      projectId,
      parentId: null,
      kind: 'notepad',
      title: 'Root Notepad',
      content: '[]',
      version: 1,
      position: 'a0',
      isFavorite: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const DESCENDANT_COUNT = 160;
    const descendantIds: string[] = [];
    const rows = [];

    for (let i = 0; i < DESCENDANT_COUNT; i++) {
      const id = crypto.randomUUID();
      descendantIds.push(id);
      rows.push({
        id,
        workspaceId,
        projectId,
        parentId: rootId,
        kind: 'notepad' as const,
        title: `Descendant ${i}`,
        content: JSON.stringify([{ type: 'paragraph', children: [{ text: `Content ${i}` }] }]),
        version: 1,
        position: `p${String(i).padStart(4, '0')}`,
        isFavorite: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }

    await bulkInsertNotepads(db, rows);

    // 1. LOOKUP: getDescendantIds & findById
    const descendants = await getDescendantIds(db, rootId);
    expect(descendants).toHaveLength(DESCENDANT_COUNT);
    for (const dId of descendantIds) {
      expect(descendants).toContain(dId);
    }

    // 2. SOFT DELETE: soft-deletes root and 160 descendants (161 statements across batch limit)
    const deleteTimestamp = Date.now();
    await notepadRepo.softDelete(rootId, deleteTimestamp);

    const trashedRoot = await notepadRepo.findById(rootId);
    expect(trashedRoot?.deletedAt).toBe(deleteTimestamp);

    const trashedList = await notepadRepo.listDeletedByProject(projectId);
    expect(trashedList).toHaveLength(DESCENDANT_COUNT + 1);

    // 3. RESTORE: restores root and 160 descendants (re-indexes FTS across batch limit)
    await notepadRepo.restore(rootId, deleteTimestamp);

    // 3b. IDEMPOTENT RESTORE: re-running restore succeeds without error or duplicate index rows
    await notepadRepo.restore(rootId, deleteTimestamp);

    const restoredRoot = await notepadRepo.findById(rootId);
    expect(restoredRoot?.deletedAt).toBeNull();

    const liveList = await notepadRepo.listByProject(projectId);
    expect(liveList).toHaveLength(DESCENDANT_COUNT + 1);

    // 4. HARD DELETE: hard deletes root and 160 descendants across batch limit
    await notepadRepo.hardDelete(rootId);

    const deletedRoot = await notepadRepo.findById(rootId);
    expect(deletedRoot).toBeNull();

    const descendantsAfterDelete = await getDescendantIds(db, rootId);
    expect(descendantsAfterDelete).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Case C: Tree level with 150+ parents
  // -------------------------------------------------------------------------
  it('handles a tree level with 150+ parents through lookup, soft-delete, and delete', async () => {
    const db = createD1Db(env.DB);
    const notepadRepo = createNotepadRepository(db);

    const projectId = await seedProject();
    const rootId = crypto.randomUUID();
    const now = Date.now();

    await notepadRepo.create({
      id: rootId,
      workspaceId,
      projectId,
      parentId: null,
      kind: 'notepad',
      title: 'Deep Root Notepad',
      content: '[]',
      version: 1,
      position: 'a0',
      isFavorite: false,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const PARENT_COUNT = 160;
    const level1Ids: string[] = [];
    const level2Ids: string[] = [];

    // Seed 160 children directly under root (level 1 parents)
    const level1Rows = [];
    for (let i = 0; i < PARENT_COUNT; i++) {
      const id = crypto.randomUUID();
      level1Ids.push(id);
      level1Rows.push({
        id,
        workspaceId,
        projectId,
        parentId: rootId,
        kind: 'notepad' as const,
        title: `Level 1 Node ${i}`,
        content: '[]',
        version: 1,
        position: `p${String(i).padStart(4, '0')}`,
        isFavorite: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    await bulkInsertNotepads(db, level1Rows);

    // Seed 1 child under each level 1 parent (level 2 leaves)
    const level2Rows = [];
    for (let i = 0; i < PARENT_COUNT; i++) {
      const id = crypto.randomUUID();
      level2Ids.push(id);
      level2Rows.push({
        id,
        workspaceId,
        projectId,
        parentId: level1Ids[i],
        kind: 'notepad' as const,
        title: `Level 2 Node ${i}`,
        content: '[]',
        version: 1,
        position: 'a0',
        isFavorite: false,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
    await bulkInsertNotepads(db, level2Rows);

    // 1. LOOKUP:
    // a) getDescendantIds: queries level 2 with 160 currentParentIds chunked by chunkInList
    const allDescendants = await getDescendantIds(db, rootId);
    expect(allDescendants).toHaveLength(PARENT_COUNT * 2);

    // b) getSubtreeHeight: traverses height with 160 currentParentIds chunked
    const height = await getSubtreeHeight(db, rootId);
    expect(height).toBe(3); // root -> level 1 -> level 2

    // c) getChildren: passing 160 parent IDs exercises chunkInList(parentIds, 1)
    const level2Children = await notepadRepo.getChildren(level1Ids);
    expect(level2Children).toHaveLength(PARENT_COUNT);

    // 2. SOFT DELETE: soft-deletes root, 160 level-1 parents, and 160 level-2 children (321 total)
    const deleteTimestamp = Date.now();
    await notepadRepo.softDelete(rootId, deleteTimestamp);

    const trashedRoot = await notepadRepo.findById(rootId);
    expect(trashedRoot?.deletedAt).toBe(deleteTimestamp);

    // 3. HARD DELETE: hard deletes all 321 notepads across split batches
    await notepadRepo.hardDelete(rootId);

    const deletedRoot = await notepadRepo.findById(rootId);
    expect(deletedRoot).toBeNull();

    const descendantsAfterDelete = await getDescendantIds(db, rootId);
    expect(descendantsAfterDelete).toHaveLength(0);
  });
});

