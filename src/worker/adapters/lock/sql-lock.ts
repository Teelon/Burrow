import { and, eq } from 'drizzle-orm'
import type { DB } from '../../db/client'
import * as t from '../../db/schema'
import type { ILockAdapter, LockAcquireResult } from './types'

export interface LockAcquireOptions {
  takeover?: boolean
}

export interface LockReleaseOptions {
  userId?: string
}

export class SqlLockAdapter implements ILockAdapter {
  constructor(
    private readonly db: DB,
    private readonly resolveHolderName?: (
      userId: string,
    ) => Promise<string | null>,
  ) {}

  async acquire(
    resourceId: string,
    userId: string,
    clientId: string,
    ttlMs: number,
    opts?: LockAcquireOptions,
  ): Promise<LockAcquireResult> {
    const now = Date.now()
    const expiresAt = now + ttlMs

    const [existing] = await this.db
      .select()
      .from(t.editLocks)
      .where(eq(t.editLocks.notepadId, resourceId))

    if (
      existing &&
      existing.expiresAt > now &&
      (existing.userId !== userId || existing.clientId !== clientId)
    ) {
      if (!(existing.userId === userId && opts?.takeover)) {
        let holderName: string | undefined
        if (this.resolveHolderName) {
          const name = await this.resolveHolderName(existing.userId)
          if (name) holderName = name
        }
        return {
          acquired: false,
          holderUserId: existing.userId,
          holderName,
          expiresAt: existing.expiresAt,
        }
      }
    }

    await this.db
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
      })

    return { acquired: true, expiresAt }
  }

  async heartbeat(
    resourceId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<boolean> {
    const now = Date.now()
    const [existing] = await this.db
      .select()
      .from(t.editLocks)
      .where(eq(t.editLocks.notepadId, resourceId))

    if (!existing || existing.expiresAt <= now || existing.clientId !== clientId) {
      return false
    }

    await this.db
      .update(t.editLocks)
      .set({ expiresAt: now + ttlMs })
      .where(eq(t.editLocks.notepadId, resourceId))

    return true
  }

  async release(
    resourceId: string,
    clientId: string,
    opts?: LockReleaseOptions,
  ): Promise<void> {
    const conditions = [
      eq(t.editLocks.notepadId, resourceId),
      eq(t.editLocks.clientId, clientId),
    ]
    if (opts?.userId !== undefined) {
      conditions.push(eq(t.editLocks.userId, opts.userId))
    }
    await this.db.delete(t.editLocks).where(and(...conditions))
  }
}

// NOTE (follow-up): acquire() uses check-then-upsert (read row, then
// insert ... onConflictDoUpdate). Two concurrent acquirers can both read a
// missing/expired row and both upsert; last writer wins. Fix with a single
// conditional write (e.g. INSERT ... WHERE not exists live rival row, or an
// UPDATE ... WHERE expired-or-absent with affected-row check). Left as-is to
// preserve current Cloudflare behavior.
