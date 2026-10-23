import { and, eq, gt, lte, or } from 'drizzle-orm';
import type { DB } from '../../db/client';
import * as t from '../../db/schema';
import type { ILockAdapter, LockAcquireResult } from './types';

export interface LockAcquireOptions {
  takeover?: boolean;
}

export interface LockReleaseOptions {
  userId?: string;
}

export class SqlLockAdapter implements ILockAdapter {
  constructor(
    private readonly db: DB,
    private readonly resolveHolderName?: (userId: string) => Promise<string | null>,
  ) {}

  async acquire(
    resourceId: string,
    userId: string,
    clientId: string,
    ttlMs: number,
    opts?: LockAcquireOptions,
    _retryCount = 0,
  ): Promise<LockAcquireResult> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // Single atomic conditional upsert: succeeds if absent, expired, same user+client, or same-user takeover
    const result = await this.db
      .insert(t.editLocks)
      .values({
        notepadId: resourceId,
        userId,
        clientId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: t.editLocks.notepadId,
        set: {
          userId,
          clientId,
          expiresAt,
        },
        where: or(
          lte(t.editLocks.expiresAt, now),
          and(eq(t.editLocks.userId, userId), eq(t.editLocks.clientId, clientId)),
          ...(opts?.takeover ? [eq(t.editLocks.userId, userId)] : []),
        ),
      })
      .returning({
        notepadId: t.editLocks.notepadId,
        userId: t.editLocks.userId,
        clientId: t.editLocks.clientId,
        expiresAt: t.editLocks.expiresAt,
      });

    if (result.length > 0) {
      return { acquired: true, expiresAt };
    }

    const [existing] = await this.db
      .select()
      .from(t.editLocks)
      .where(eq(t.editLocks.notepadId, resourceId));

    if (!existing || existing.expiresAt <= now) {
      if (_retryCount < 1) {
        return this.acquire(resourceId, userId, clientId, ttlMs, opts, _retryCount + 1);
      }
    }

    let holderName: string | undefined;
    if (this.resolveHolderName && existing) {
      const name = await this.resolveHolderName(existing.userId);
      if (name) holderName = name;
    }

    return {
      acquired: false,
      holderUserId: existing?.userId,
      holderName,
      expiresAt: existing?.expiresAt,
    };
  }

  async heartbeat(resourceId: string, clientId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const result = await this.db
      .update(t.editLocks)
      .set({ expiresAt: now + ttlMs })
      .where(
        and(
          eq(t.editLocks.notepadId, resourceId),
          eq(t.editLocks.clientId, clientId),
          gt(t.editLocks.expiresAt, now),
        ),
      )
      .returning({ notepadId: t.editLocks.notepadId });

    return result.length > 0;
  }

  async release(resourceId: string, clientId: string, opts?: LockReleaseOptions): Promise<void> {
    const conditions = [eq(t.editLocks.notepadId, resourceId), eq(t.editLocks.clientId, clientId)];
    if (opts?.userId !== undefined) {
      conditions.push(eq(t.editLocks.userId, opts.userId));
    }
    await this.db.delete(t.editLocks).where(and(...conditions));
  }
}
