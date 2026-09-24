import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { SqlLockAdapter } from '../../src/worker/adapters/lock/sql-lock';
import { createDb } from '../../src/worker/db/client';
import * as schema from '../../src/worker/db/schema';

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const LOCK_TTL_MS = 60_000;

describe('SqlLockAdapter contract', () => {
  let workspaceId = '';
  let projectId = '';

  beforeAll(async () => {
    const db = createDb(env.DB);
    workspaceId = crypto.randomUUID();
    projectId = crypto.randomUUID();
    const now = Date.now();
    await db.insert(schema.workspaces).values({
      id: workspaceId,
      name: 'lock-contract-ws',
      createdBy: 'lock-contract-user',
      createdAt: now,
    });
    await db.insert(schema.projects).values({
      id: projectId,
      workspaceId,
      name: 'lock-contract-project',
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });
  });

  /** Fresh lockable resource per test (edit_locks.notepad_id references notepads). */
  async function seedResource(): Promise<string> {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(schema.notepads).values({
      id,
      workspaceId,
      projectId,
      title: `lock resource ${id}`,
      position: 'a0',
      createdBy: 'lock-contract-user',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  function locks(): SqlLockAdapter {
    return new SqlLockAdapter(createDb(env.DB));
  }

  it('A acquires; a rival client is rejected with the holder user id', async () => {
    const resourceId = await seedResource();
    const userA = `user-a-${crypto.randomUUID()}`;
    const userB = `user-b-${crypto.randomUUID()}`;
    const clientA = `client-a-${crypto.randomUUID()}`;
    const clientB = `client-b-${crypto.randomUUID()}`;

    const acquired = await locks().acquire(resourceId, userA, clientA, LOCK_TTL_MS);
    expect(acquired.acquired).toBe(true);
    expect(acquired.expiresAt).toBeDefined();

    const rival = await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS);
    expect(rival.acquired).toBe(false);
    expect(rival.holderUserId).toBe(userA);

    // Same user on a different tab/client is also rejected while the lock is live.
    const sameUserOtherClient = await locks().acquire(resourceId, userA, clientB, LOCK_TTL_MS);
    expect(sameUserOtherClient.acquired).toBe(false);
    expect(sameUserOtherClient.holderUserId).toBe(userA);
  });

  it('heartbeat keeps the lock alive; release hands it to the waiter', async () => {
    const resourceId = await seedResource();
    const userA = `user-a-${crypto.randomUUID()}`;
    const userB = `user-b-${crypto.randomUUID()}`;
    const clientA = `client-a-${crypto.randomUUID()}`;
    const clientB = `client-b-${crypto.randomUUID()}`;

    expect((await locks().acquire(resourceId, userA, clientA, LOCK_TTL_MS)).acquired).toBe(true);

    expect(await locks().heartbeat(resourceId, clientA, LOCK_TTL_MS)).toBe(true);

    const stillRejected = await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS);
    expect(stillRejected.acquired).toBe(false);
    expect(stillRejected.holderUserId).toBe(userA);

    await locks().release(resourceId, clientA);

    const next = await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS);
    expect(next.acquired).toBe(true);
  });

  it('same holder may re-acquire to refresh its lock', async () => {
    const resourceId = await seedResource();
    const userA = `user-a-${crypto.randomUUID()}`;
    const clientA = `client-a-${crypto.randomUUID()}`;

    expect((await locks().acquire(resourceId, userA, clientA, LOCK_TTL_MS)).acquired).toBe(true);
    expect((await locks().acquire(resourceId, userA, clientA, LOCK_TTL_MS)).acquired).toBe(true);
  });

  it('an expired lock becomes acquirable by a rival', async () => {
    const resourceId = await seedResource();
    const userA = `user-a-${crypto.randomUUID()}`;
    const userB = `user-b-${crypto.randomUUID()}`;
    const clientA = `client-a-${crypto.randomUUID()}`;
    const clientB = `client-b-${crypto.randomUUID()}`;

    expect((await locks().acquire(resourceId, userA, clientA, 20)).acquired).toBe(true);
    await sleep(150);

    const rival = await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS);
    expect(rival.acquired).toBe(true);
  });

  it('release by the wrong client does not free the lock', async () => {
    const resourceId = await seedResource();
    const userA = `user-a-${crypto.randomUUID()}`;
    const userB = `user-b-${crypto.randomUUID()}`;
    const clientA = `client-a-${crypto.randomUUID()}`;
    const clientB = `client-b-${crypto.randomUUID()}`;
    const wrongClient = `client-wrong-${crypto.randomUUID()}`;

    expect((await locks().acquire(resourceId, userA, clientA, LOCK_TTL_MS)).acquired).toBe(true);

    // Wrong-client release is a no-op: the holder still owns the lock.
    await locks().release(resourceId, wrongClient);
    expect(await locks().heartbeat(resourceId, clientA, LOCK_TTL_MS)).toBe(true);

    const rival = await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS);
    expect(rival.acquired).toBe(false);
    expect(rival.holderUserId).toBe(userA);

    // The rightful client can still release, after which the rival acquires.
    await locks().release(resourceId, clientA);
    expect((await locks().acquire(resourceId, userB, clientB, LOCK_TTL_MS)).acquired).toBe(true);
  });
});
