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
});
