import type { ILockAdapter, LockAcquireResult, LockAcquireOptions } from '../../../adapters/lock';
import { eq, and, lt } from 'drizzle-orm';
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
  ): Promise<LockAcquireResult> {
    const now = Date.now();
    const expiresAt = now + ttlMs;

    // Try to acquire the lock
    // If lock doesn't exist or is expired, or belongs to same user+client, take it
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
        where: lt(editLocks.expiresAt, now),
      })
      .returning({
        notepadId: editLocks.notepadId,
        userId: editLocks.userId,
        clientId: editLocks.clientId,
        expiresAt: editLocks.expiresAt,
      });

    if (result.length > 0) {
      return { acquired: true };
    }

    // Lock exists and is not expired, check who holds it
    const existing = await this.db
      .select({ userId: editLocks.userId, expiresAt: editLocks.expiresAt })
      .from(editLocks)
      .where(eq(editLocks.notepadId, resourceId))
      .limit(1);

    if (existing.length === 0) {
      return { acquired: false };
    }

    // TypeScript doesn't narrow the type properly, so we use a const assertion
    const lock = existing[0] as { userId: string; expiresAt: number };
    if (lock.expiresAt <= now) {
      // Race condition: lock expired between our check and now
      // Try again
      return this.acquire(resourceId, userId, clientId, ttlMs, options);
    }

    // Get holder name from user table
    const holderName = await this.getUserName(lock.userId);

    if (options?.takeover) {
      // Force take over the lock
      await this.db
        .update(editLocks)
        .set({ userId, clientId, expiresAt })
        .where(eq(editLocks.notepadId, resourceId));
      return { acquired: true };
    }

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
      .where(and(eq(editLocks.notepadId, resourceId), eq(editLocks.clientId, clientId)))
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
