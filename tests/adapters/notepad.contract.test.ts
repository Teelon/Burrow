import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createD1Db } from '../../src/core/adapters/db/d1/client';
import { createNotepadRepository } from '../../src/core/adapters/db/d1/repositories/notepad';
import * as schema from '../../src/core/adapters/db/d1/schema';

describe('createNotepadRepository contract', () => {
  let workspaceId = '';

  beforeAll(async () => {
    const db = createD1Db(env.DB);
    workspaceId = crypto.randomUUID();
    await db.insert(schema.workspaces).values({
      id: workspaceId,
      name: 'notepad-contract-ws',
      createdBy: 'notepad-contract-user',
      createdAt: Date.now(),
    });
  });

  function repo(): ReturnType<typeof createNotepadRepository> {
    return createNotepadRepository(createD1Db(env.DB));
  }

  /** Fresh project per test so list assertions stay isolated. */
  async function seedProject(): Promise<string> {
    const db = createD1Db(env.DB);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(schema.projects).values({
      id,
      workspaceId,
      name: `notepad-contract-project-${id}`,
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async function seedNotepad(args: {
    projectId: string;
    title: string;
    position: string;
    parentId?: string | null;
    kind?: 'notepad' | 'card';
  }): Promise<string> {
    const id = crypto.randomUUID();
    const now = Date.now();
    await repo().create({
      id,
      workspaceId,
      projectId: args.projectId,
      parentId: args.parentId ?? null,
      kind: args.kind ?? 'notepad',
      title: args.title,
      content: '[]',
      version: 1,
      position: args.position,
      isFavorite: false,
      createdBy: 'notepad-contract-user',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  it('listByProject returns only live notepad-kind rows ordered by position', async () => {
    const projectId = await seedProject();
    const parentId = await seedNotepad({ projectId, title: 'parent', position: 'a0' });
    const otherId = await seedNotepad({ projectId, title: 'other root', position: 'a2' });
    const childId = await seedNotepad({
      projectId,
      title: 'child',
      position: 'a1',
      parentId,
    });
    const cardId = await seedNotepad({
      projectId,
      title: 'card body',
      position: 'a3',
      kind: 'card',
    });
    const trashedId = await seedNotepad({ projectId, title: 'trashed', position: 'a4' });
    await repo().softDelete(trashedId, Date.now());

    const rows = await repo().listByProject(projectId);
    expect(rows.map((r) => r.id)).toEqual([parentId, childId, otherId]);
    expect(rows.some((r) => r.id === cardId)).toBe(false);
    expect(rows.some((r) => r.id === trashedId)).toBe(false);
    for (const row of rows) {
      expect(row.kind).toBe('notepad');
      expect(row.deletedAt).toBeNull();
    }
  });

  it('listDeletedByProject returns the trashed rows', async () => {
    const projectId = await seedProject();
    const liveId = await seedNotepad({ projectId, title: 'live', position: 'a0' });
    const trashedId = await seedNotepad({ projectId, title: 'trashed', position: 'a1' });
    await repo().softDelete(trashedId, Date.now());

    const rows = await repo().listDeletedByProject(projectId);
    expect(rows.some((r) => r.id === trashedId)).toBe(true);
    expect(rows.some((r) => r.id === liveId)).toBe(false);
  });

  it('softDelete removes the subtree from the tree and surfaces it in trash', async () => {
    const projectId = await seedProject();
    const parentId = await seedNotepad({ projectId, title: 'parent', position: 'a0' });
    const childId = await seedNotepad({
      projectId,
      title: 'child',
      position: 'a1',
      parentId,
    });
    const siblingId = await seedNotepad({ projectId, title: 'sibling', position: 'a2' });

    expect((await repo().listByProject(projectId)).map((r) => r.id)).toEqual(
      expect.arrayContaining([parentId, childId, siblingId]),
    );

    const now = Date.now();
    await repo().softDelete(parentId, now);

    const live = await repo().listByProject(projectId);
    expect(live.map((r) => r.id)).toEqual([siblingId]);

    const trashed = await repo().listDeletedByProject(projectId);
    expect(trashed.map((r) => r.id)).toEqual(expect.arrayContaining([parentId, childId]));
    expect(trashed.some((r) => r.id === siblingId)).toBe(false);
    expect(trashed.find((r) => r.id === childId)?.deletedAt).toBe(now);
  });

  it('move updates parentId and position and reflects in tree ordering', async () => {
    const projectId = await seedProject();
    const p1 = await seedNotepad({ projectId, title: 'p1', position: 'a0' });
    const p2 = await seedNotepad({ projectId, title: 'p2', position: 'a1' });
    const child = await seedNotepad({ projectId, title: 'child', position: 'a0', parentId: p1 });

    // Move child out of p1 to root after p2
    await repo().move(child, null, 'a2');
    let rows = await repo().listByProject(projectId);
    const movedChild = rows.find((r) => r.id === child);
    expect(movedChild?.parentId).toBeNull();
    expect(movedChild?.position).toBe('a2');

    // Move p2 to root before p1
    await repo().move(p2, null, 'Zz');
    rows = await repo().listByProject(projectId);
    const roots = rows.filter((r) => r.parentId === null);
    expect(roots.map((r) => r.id)).toEqual([p2, p1, child]);
  });

  it('getLastRootPosition and getLastChildPosition exclude deleted and card-kind notepads', async () => {
    const projectId = await seedProject();
    // Empty root
    expect(await repo().getLastRootPosition(projectId)).toBeNull();

    const root1 = await seedNotepad({ projectId, title: 'root1', position: 'a0' });
    const nextRootPos = await repo().getLastRootPosition(projectId);
    expect(nextRootPos).toBeDefined();
    expect(nextRootPos! > 'a0').toBe(true);

    // Soft-deleted root shouldn't advance position
    const root2 = await seedNotepad({ projectId, title: 'root2', position: 'a5' });
    await repo().softDelete(root2, Date.now());
    expect(await repo().getLastRootPosition(projectId)).toBe(nextRootPos);

    // Card kind shouldn't advance root position
    await seedNotepad({ projectId, title: 'card', position: 'a9', kind: 'card' });
    expect(await repo().getLastRootPosition(projectId)).toBe(nextRootPos);

    // Empty children
    expect(await repo().getLastChildPosition(root1)).toBeNull();
    await seedNotepad({ projectId, title: 'c1', position: 'a0', parentId: root1 });
    const nextChildPos = await repo().getLastChildPosition(root1);
    expect(nextChildPos).toBeDefined();
    expect(nextChildPos! > 'a0').toBe(true);
  });

  it('getLock reads active lock and deleteLock removes it', async () => {
    const projectId = await seedProject();
    const notepadId = await seedNotepad({ projectId, title: 'lock test', position: 'a0' });
    const db = createD1Db(env.DB);

    expect(await repo().getLock(notepadId)).toBeNull();

    const expiresAt = Date.now() + 60_000;
    await db.insert(schema.editLocks).values({
      notepadId,
      userId: 'lock-test-user',
      clientId: 'lock-test-client',
      expiresAt,
    });

    const lock = await repo().getLock(notepadId);
    expect(lock).not.toBeNull();
    expect(lock?.userId).toBe('lock-test-user');
    expect(lock?.clientId).toBe('lock-test-client');

    await repo().deleteLock(notepadId);
    expect(await repo().getLock(notepadId)).toBeNull();
  });

  it('countByCoverKey accurately counts notepads referencing coverKey and supports excludeNotepadId', async () => {
    const projectId = await seedProject();
    const coverKey = `${workspaceId}/cover-shared-${crypto.randomUUID()}.png`;

    // 0 before any notepad uses it
    expect(await repo().countByCoverKey(coverKey)).toBe(0);

    const np1 = await seedNotepad({ projectId, title: 'cover test 1', position: 'a0' });
    await repo().update(np1, { coverKey, updatedAt: Date.now() });

    expect(await repo().countByCoverKey(coverKey)).toBe(1);
    expect(await repo().countByCoverKey(coverKey, np1)).toBe(0);

    const np2 = await seedNotepad({ projectId, title: 'cover test 2', position: 'a1' });
    await repo().update(np2, { coverKey, updatedAt: Date.now() });

    expect(await repo().countByCoverKey(coverKey)).toBe(2);
    expect(await repo().countByCoverKey(coverKey, np1)).toBe(1);
    expect(await repo().countByCoverKey(coverKey, np2)).toBe(1);

    // After np1 changes coverKey
    await repo().update(np1, { coverKey: null, updatedAt: Date.now() });
    expect(await repo().countByCoverKey(coverKey)).toBe(1);
    expect(await repo().countByCoverKey(coverKey, np2)).toBe(0);
  });

  it('isValidLink checks validity strictly scoped to workspaceId', async () => {
    const projectId = await seedProject();
    const liveNotepadId = await seedNotepad({ projectId, title: 'target notepad', position: 'a0' });
    const trashedNotepadId = await seedNotepad({ projectId, title: 'trashed target', position: 'a1' });
    await repo().softDelete(trashedNotepadId, Date.now());

    const otherWorkspaceId = crypto.randomUUID();

    // Valid within workspace (both as string and target object)
    expect(await repo().isValidLink(liveNotepadId, workspaceId)).toBe(true);
    expect(
      await repo().isValidLink({ targetType: 'notepad', targetId: liveNotepadId }, workspaceId),
    ).toBe(true);

    // Cross-workspace lookup fails
    expect(await repo().isValidLink(liveNotepadId, otherWorkspaceId)).toBe(false);
    expect(
      await repo().isValidLink({ targetType: 'notepad', targetId: liveNotepadId }, otherWorkspaceId),
    ).toBe(false);

    // Trashed notepad fails
    expect(await repo().isValidLink(trashedNotepadId, workspaceId)).toBe(false);

    // Non-existent id fails
    expect(await repo().isValidLink('non-existent-id', workspaceId)).toBe(false);
  });

  it('listBacklinks returns backlinks strictly scoped to workspaceId with updatedAt', async () => {
    const projectId = await seedProject();
    const targetId = await seedNotepad({ projectId, title: 'target', position: 'a0' });
    const source1Id = await seedNotepad({ projectId, title: 'source 1', position: 'a1' });
    const source2Id = await seedNotepad({ projectId, title: 'source 2', position: 'a2' });

    const db = createD1Db(env.DB);
    await db.insert(schema.notepadLinks).values([
      { sourceId: source1Id, targetType: 'notepad', targetId },
      { sourceId: source2Id, targetType: 'notepad', targetId },
    ]);

    const backlinks = await repo().listBacklinks(targetId, workspaceId);
    expect(backlinks).toHaveLength(2);
    expect(backlinks.map((b) => b.id).sort()).toEqual([source1Id, source2Id].sort());
    for (const link of backlinks) {
      expect(link.title).toBeDefined();
      expect(typeof link.updatedAt).toBe('number');
    }

    // Different workspace returns empty
    const otherWorkspaceId = crypto.randomUUID();
    const otherBacklinks = await repo().listBacklinks(targetId, otherWorkspaceId);
    expect(otherBacklinks).toHaveLength(0);

    // Soft-deleting one source removes it from backlinks
    await repo().softDelete(source1Id, Date.now());
    const afterDelete = await repo().listBacklinks(targetId, workspaceId);
    expect(afterDelete.map((b) => b.id)).toEqual([source2Id]);
  });
});

