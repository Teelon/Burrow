import type { ILockAdapter, LockAcquireResult, LockAcquireOptions } from '../../../adapters/lock';
import { eq, and, lte, gt, or } from 'drizzle-orm';
import type { PostgresDb } from './index';
import { editLocks, user } from './schema';

export class PostgresLockAdapter implements ILockAdapter {
  constructor(private db: PostgresDb) {}

  async acquire(
    resourceId: string,
    userId: string,
    clientId: string,
    ttlMs: number,
    options?: LockAcquireOptions,
    _retryCount = 0,
  ): Promise<LockAcquireResult> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // Try to acquire the lock atomically:
    // If lock doesn't exist, is expired, belongs to same user+client, or is same-user takeover
    const result = await this.db
      .insert(editLocks)
      .values({
        notepadId: resourceId,
        userId,
        clientId,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: editLocks.notepadId,
        set: {
          userId,
          clientId,
          expiresAt,
        },
        where: or(
          lte(editLocks.expiresAt, now),
          and(eq(editLocks.userId, userId), eq(editLocks.clientId, clientId)),
          ...(options?.takeover ? [eq(editLocks.userId, userId)] : []),
        ),
      })
      .returning({
        notepadId: editLocks.notepadId,
        userId: editLocks.userId,
        clientId: editLocks.clientId,
        expiresAt: editLocks.expiresAt,
      });

    if (result.length > 0) {
      return { acquired: true, expiresAt };
    }

    // Lock exists and is held by a live rival (or same user without takeover)
    const existing = await this.db
      .select({ userId: editLocks.userId, expiresAt: editLocks.expiresAt })
      .from(editLocks)
      .where(eq(editLocks.notepadId, resourceId))
      .limit(1);

    if (existing.length === 0) {
      if (_retryCount < 1) {
        return this.acquire(resourceId, userId, clientId, ttlMs, options, _retryCount + 1);
      }
      return { acquired: false };
    }

    const lock = existing[0] as { userId: string; expiresAt: number };
    if (lock.expiresAt <= now) {
      // Race condition: lock expired between our check and now
      if (_retryCount < 1) {
        return this.acquire(resourceId, userId, clientId, ttlMs, options, _retryCount + 1);
      }
    }

    // Get holder name from user table
    const holderName = await this.getUserName(lock.userId);

    return {
      acquired: false,
      holderUserId: lock.userId,
      holderName,
      expiresAt: lock.expiresAt,
    };
  }

  async heartbeat(resourceId: string, clientId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    const result = await this.db
      .update(editLocks)
      .set({ expiresAt })
      .where(
        and(
          eq(editLocks.notepadId, resourceId),
          eq(editLocks.clientId, clientId),
          gt(editLocks.expiresAt, now),
        ),
      )
      .returning({ notepadId: editLocks.notepadId });

    return result.length > 0;
  }

  async release(resourceId: string, clientId: string, options?: { userId: string }): Promise<void> {
    const conditions = [eq(editLocks.notepadId, resourceId), eq(editLocks.clientId, clientId)];
    if (options?.userId) {
      conditions.push(eq(editLocks.userId, options.userId));
    }
    await this.db.delete(editLocks).where(and(...conditions));
  }

  private async getUserName(userId: string): Promise<string | undefined> {
    const result = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return result[0]?.name;
  }
}
