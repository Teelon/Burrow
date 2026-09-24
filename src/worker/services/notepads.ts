import { nanoid } from 'nanoid'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { extractFromContent, extractPlainText } from '../../shared/extract'
import { HttpError } from '../lib/errors'
import { runBatch } from '../lib/batch'
import { positionAfterLast, positionBetween } from '../lib/ordering'
import {
  ftsDeleteStmt,
  ftsInsertNowStmt,
  ftsInsertStmt,
  liveContentCond,
  LIVE_CONTENT_COND_PARAMS,
} from '../lib/search'
import {
  diffLinks,
  filterWorkspaceTargets,
  linkDeleteStatements,
  linkInsertStatements,
  mentionNotificationStatements,
  type StoredLink,
} from '../lib/links'
import {
  getDescendantIds,
  getNotepadDepth,
  getSubtreeHeight,
  wouldCauseCycle,
} from '../lib/tree'
import { chunkByParamBudget } from '../lib/chunk'

/** Root notepads are depth 1; reject anything deeper than 8 (PLAN.md section 6). */
export const MAX_NOTEPAD_DEPTH = 8
/** D1 rows are limited to ~2MB; reject oversized content with 413. */
export const MAX_CONTENT_BYTES = 1_500_000

export interface CreateNotepadArgs {
  workspaceId: string
  projectId: string
  parentId?: string | null
  title?: string
  createdBy: string
  position?: string
}

export interface CreatedNotepad {
  id: string
  position: string
  version: number
}

export async function createNotepad(
  db: DB,
  args: CreateNotepadArgs,
): Promise<CreatedNotepad> {
  const [project] = await db
    .select()
    .from(t.projects)
    .where(eq(t.projects.id, args.projectId))
  if (!project || project.workspaceId !== args.workspaceId) {
    throw new HttpError(404, 'not_found', 'Project not found')
  }

  let position = args.position ?? null
  if (args.parentId) {
    const [parent] = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.id, args.parentId))
    if (
      !parent ||
      parent.projectId !== args.projectId ||
      parent.workspaceId !== args.workspaceId ||
      parent.deletedAt !== null ||
      parent.kind !== 'notepad'
    ) {
      throw new HttpError(404, 'not_found', 'Parent notepad not found')
    }
    const parentDepth = await getNotepadDepth(db, parent.id)
    if (parentDepth + 1 > MAX_NOTEPAD_DEPTH) {
      throw new HttpError(
        400,
        'too_deep',
        `Notepads can nest at most ${MAX_NOTEPAD_DEPTH} deep`,
      )
    }
    if (!position) position = await lastChildPosition(db, parent.id)
  } else if (!position) {
    position = await lastRootPosition(db, args.projectId)
  }

  const id = nanoid()
  const now = Date.now()
  const title = args.title?.trim() || 'Untitled'
  await runBatch(db, [
    db.insert(t.notepads).values({
      id,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      parentId: args.parentId ?? null,
      kind: 'notepad',
      title,
      content: '[]',
      version: 1,
      position,
      isFavorite: false,
      deletedAt: null,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    }),
    db.run(ftsInsertNowStmt(id, title, '')),
  ])
  return { id, position, version: 1 }
}

async function lastChildPosition(db: DB, parentId: string): Promise<string> {
  const [last] = await db
    .select({ position: t.notepads.position })
    .from(t.notepads)
    .where(
      and(eq(t.notepads.parentId, parentId), isNull(t.notepads.deletedAt)),
    )
    .orderBy(desc(t.notepads.position))
    .limit(1)
  return positionAfterLast(last?.position ?? null)
}

async function lastRootPosition(db: DB, projectId: string): Promise<string> {
  const [last] = await db
    .select({ position: t.notepads.position })
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.projectId, projectId),
        isNull(t.notepads.parentId),
        isNull(t.notepads.deletedAt),
        eq(t.notepads.kind, 'notepad'),
      ),
    )
    .orderBy(desc(t.notepads.position))
    .limit(1)
  return positionAfterLast(last?.position ?? null)
}

export interface MoveNotepadArgs {
  workspaceId: string
  notepadId: string
  parentId?: string | null
  afterId?: string | null
}

export async function moveNotepad(db: DB, args: MoveNotepadArgs) {
  const [notepad] = await db
    .select()
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.id, args.notepadId),
        eq(t.notepads.workspaceId, args.workspaceId),
      ),
    )

  if (!notepad || notepad.deletedAt !== null) {
    throw new HttpError(404, 'not_found', 'Notepad not found')
  }

  if (notepad.kind === 'card') {
    throw new HttpError(400, 'cannot_move_card_notepad', 'Cards cannot be moved in the notepad tree')
  }

  const targetParentId = args.parentId === undefined ? notepad.parentId : args.parentId

  // Cycle check
  if (targetParentId) {
    if (await wouldCauseCycle(db, args.notepadId, targetParentId)) {
      throw new HttpError(400, 'cycle_detected', 'Cannot move a notepad under its own descendant')
    }

    const [parent] = await db
      .select()
      .from(t.notepads)
      .where(
        and(
          eq(t.notepads.id, targetParentId),
          eq(t.notepads.projectId, notepad.projectId),
          eq(t.notepads.workspaceId, args.workspaceId),
        ),
      )
    if (!parent || parent.deletedAt !== null || parent.kind !== 'notepad') {
      throw new HttpError(404, 'not_found', 'Target parent not found')
    }

    const parentDepth = await getNotepadDepth(db, parent.id)
    const subtreeHeight = await getSubtreeHeight(db, args.notepadId)
    if (parentDepth + subtreeHeight > MAX_NOTEPAD_DEPTH) {
      throw new HttpError(400, 'too_deep', `Move would exceed max depth of ${MAX_NOTEPAD_DEPTH}`)
    }
  }

  // Calculate new position among target siblings
  const siblings = await db
    .select({ id: t.notepads.id, position: t.notepads.position })
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.projectId, notepad.projectId),
        targetParentId ? eq(t.notepads.parentId, targetParentId) : isNull(t.notepads.parentId),
        isNull(t.notepads.deletedAt),
        eq(t.notepads.kind, 'notepad'),
      ),
    )
    .orderBy(asc(t.notepads.position))

  const otherSiblings = siblings.filter((s) => s.id !== args.notepadId)

  let newPosition: string
  if (!args.afterId) {
    const next = otherSiblings[0]?.position ?? null
    newPosition = positionBetween(null, next)
  } else {
    const afterIndex = otherSiblings.findIndex((s) => s.id === args.afterId)
    if (afterIndex === -1) {
      throw new HttpError(400, 'invalid_after_id', 'afterId not found among siblings')
    }
    const prev = otherSiblings[afterIndex]!.position
    const next = otherSiblings[afterIndex + 1]?.position ?? null
    newPosition = positionBetween(prev, next)
  }

  await db
    .update(t.notepads)
    .set({
      parentId: targetParentId,
      position: newPosition,
      updatedAt: Date.now(),
    })
    .where(eq(t.notepads.id, args.notepadId))

  return { parentId: targetParentId, position: newPosition }
}

export interface SoftDeleteNotepadArgs {
  workspaceId: string
  notepadId: string
}

export async function softDeleteNotepad(db: DB, args: SoftDeleteNotepadArgs) {
  const [notepad] = await db
    .select()
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.id, args.notepadId),
        eq(t.notepads.workspaceId, args.workspaceId),
      ),
    )

  if (!notepad || notepad.deletedAt !== null) {
    throw new HttpError(404, 'not_found', 'Notepad not found')
  }

  if (notepad.kind === 'card') {
    throw new HttpError(400, 'cannot_delete_card_notepad', 'Card notepads must be deleted via card service')
  }

  const descendants = await getDescendantIds(db, args.notepadId)
  const allIds = [args.notepadId, ...descendants]
  const now = Date.now()

  // Invariant I6 & I7: Set identical deleted_at timestamp on subtree and remove from FTS
  const statements: BatchItem<'sqlite'>[] = []
  for (const chunk of chunkByParamBudget(allIds, 1, 1)) {
    statements.push(
      db
        .update(t.notepads)
        .set({ deletedAt: now, updatedAt: now })
        .where(
          and(
            inArray(t.notepads.id, chunk),
            isNull(t.notepads.deletedAt),
          ),
        ),
    )
  }

  for (const chunk of chunkByParamBudget(allIds, 1, 0)) {
    statements.push(
      db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`),
    )
  }

  await runBatch(db, statements)
}

export interface RestoreNotepadArgs {
  workspaceId: string
  notepadId: string
}

export async function restoreNotepad(db: DB, args: RestoreNotepadArgs) {
  const [notepad] = await db
    .select()
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.id, args.notepadId),
        eq(t.notepads.workspaceId, args.workspaceId),
      ),
    )

  if (!notepad || notepad.deletedAt === null) {
    throw new HttpError(404, 'not_found', 'Deleted notepad not found')
  }

  if (notepad.kind === 'card') {
    throw new HttpError(400, 'cannot_restore_card_notepad', 'Card notepads must be restored via card service')
  }

  const deleteTimestamp = notepad.deletedAt

  // Restore exactly the rows sharing this deletion timestamp
  const matchingNotepads = await db
    .select({
      id: t.notepads.id,
      parentId: t.notepads.parentId,
      title: t.notepads.title,
      content: t.notepads.content,
      projectId: t.notepads.projectId,
    })
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.projectId, notepad.projectId),
        eq(t.notepads.deletedAt, deleteTimestamp),
      ),
    )

  // Check if restored root's parent is still deleted or missing
  let newParentId = notepad.parentId
  let newPosition: string | null = null
  if (notepad.parentId) {
    const [parent] = await db
      .select({ id: t.notepads.id, deletedAt: t.notepads.deletedAt })
      .from(t.notepads)
      .where(eq(t.notepads.id, notepad.parentId))

    if (!parent || parent.deletedAt !== null) {
      // Re-attach at project root
      newParentId = null
      newPosition = await lastRootPosition(db, notepad.projectId)
    }
  }

  const now = Date.now()
  const matchingIds = matchingNotepads.map((n) => n.id)

  const statements: BatchItem<'sqlite'>[] = []
  for (const chunk of chunkByParamBudget(matchingIds, 1, 1)) {
    statements.push(
      db
        .update(t.notepads)
        .set({ deletedAt: null, updatedAt: now })
        .where(inArray(t.notepads.id, chunk)),
    )
  }

  if (newParentId !== notepad.parentId || newPosition) {
    statements.push(
      db
        .update(t.notepads)
        .set({
          parentId: newParentId,
          position: newPosition ?? notepad.position,
          updatedAt: now,
        })
        .where(eq(t.notepads.id, notepad.id)),
    )
  }

  // Restore FTS entries (I7)
  for (const item of matchingNotepads) {
    statements.push(
      db.run(
        ftsInsertNowStmt(
          item.id,
          item.title,
          extractPlainText(item.content),
        ),
      ),
    )
  }

  await runBatch(db, statements)
}

export interface PermanentDeleteNotepadArgs {
  workspaceId: string
  notepadId: string
  filesBucket?: R2Bucket | null
}

export async function permanentDeleteNotepad(
  db: DB,
  args: PermanentDeleteNotepadArgs,
) {
  const [notepad] = await db
    .select()
    .from(t.notepads)
    .where(
      and(
        eq(t.notepads.id, args.notepadId),
        eq(t.notepads.workspaceId, args.workspaceId),
      ),
    )

  if (!notepad) {
    throw new HttpError(404, 'not_found', 'Notepad not found')
  }

  if (notepad.deletedAt === null) {
    throw new HttpError(400, 'not_in_trash', 'Only items in trash can be permanently deleted')
  }

  const descendants = await getDescendantIds(db, args.notepadId)
  const allIds = [args.notepadId, ...descendants]

  // Collect cover keys for R2 cleanup
  const allRows = await db
    .select({ id: t.notepads.id, coverKey: t.notepads.coverKey })
    .from(t.notepads)
    .where(inArray(t.notepads.id, allIds))

  const r2Keys = allRows.map((r) => r.coverKey).filter((k): k is string => Boolean(k))

  const statements: BatchItem<'sqlite'>[] = []
  for (const chunk of chunkByParamBudget(allIds, 1, 0)) {
    statements.push(
      db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`),
      db.run(sql`DELETE FROM notepad_links WHERE target_id IN ${chunk}`),
      db.delete(t.notepads).where(inArray(t.notepads.id, chunk)),
    )
  }

  await runBatch(db, statements)

  if (args.filesBucket && r2Keys.length > 0) {
    try {
      await Promise.allSettled(r2Keys.map((k) => args.filesBucket!.delete(k)))
    } catch (err) {
      console.warn('R2 cleanup error', err)
    }
  }
}

export interface SaveContentArgs {
  notepadId: string
  content: string
  baseVersion: number
  actorId: string
  clientId?: string
}

export interface SaveContentResult {
  version: number
}

interface PreparedSave {
  row: { id: string; workspaceId: string; title: string; version: number }
  validLinks: StoredLink[]
  previousLinks: StoredLink[]
}

export async function prepareSave(
  db: DB,
  args: SaveContentArgs,
): Promise<PreparedSave> {
  const [row] = await db
    .select()
    .from(t.notepads)
    .where(eq(t.notepads.id, args.notepadId))
  if (!row) throw new HttpError(404, 'not_found', 'Notepad not found')
  const extraction = extractFromContent(args.content)
  const validLinks = await filterWorkspaceTargets(
    db,
    row.workspaceId,
    extraction.links,
  )
  const previousLinks = await db
    .select({
      targetType: t.notepadLinks.targetType,
      targetId: t.notepadLinks.targetId,
    })
    .from(t.notepadLinks)
    .where(eq(t.notepadLinks.sourceId, row.id))
  return {
    row: {
      id: row.id,
      workspaceId: row.workspaceId,
      title: row.title,
      version: row.version,
    },
    validLinks,
    previousLinks,
  }
}

export async function saveContent(
  db: DB,
  args: SaveContentArgs,
): Promise<SaveContentResult> {
  if (byteLength(args.content) > MAX_CONTENT_BYTES) {
    throw new HttpError(
      413,
      'content_too_large',
      'Notepad content exceeds 1.5 MB',
    )
  }

  // Check live edit lock
  const now = Date.now()
  const [lock] = await db
    .select()
    .from(t.editLocks)
    .where(eq(t.editLocks.notepadId, args.notepadId))

  if (
    lock &&
    lock.expiresAt > now &&
    (lock.userId !== args.actorId || (args.clientId && lock.clientId !== args.clientId))
  ) {
    const [holder] = await db
      .select({ name: t.user.name })
      .from(t.user)
      .where(eq(t.user.id, lock.userId))

    throw new HttpError(
      409,
      'locked',
      JSON.stringify({
        code: 'locked',
        holder: { userId: lock.userId, name: holder?.name || 'Someone' },
        expiresAt: lock.expiresAt,
      }),
    )
  }

  const prepared = await prepareSave(db, args)
  if (prepared.row.version !== args.baseVersion) {
    throw new HttpError(
      409,
      'version_conflict',
      'This notepad changed elsewhere',
    )
  }

  await runBatch(
    db,
    buildSaveContentStatements(db, {
      row: prepared.row,
      content: args.content,
      baseVersion: args.baseVersion,
      actorId: args.actorId,
      validLinks: prepared.validLinks,
      previousLinks: prepared.previousLinks,
      now,
    }),
  )

  const [after] = await db
    .select({ content: t.notepads.content, version: t.notepads.version })
    .from(t.notepads)
    .where(eq(t.notepads.id, prepared.row.id))
  if (!after || after.content !== args.content) {
    throw new HttpError(
      409,
      'version_conflict',
      'This notepad changed elsewhere',
    )
  }
  return { version: after.version }
}

export interface SaveStatementArgs {
  row: { id: string; workspaceId: string; title: string }
  content: string
  baseVersion: number
  actorId: string
  validLinks: StoredLink[]
  previousLinks: StoredLink[]
  now: number
}

export function buildSaveContentStatements(
  db: DB,
  args: SaveStatementArgs,
): BatchItem<'sqlite'>[] {
  const { row, content, baseVersion, actorId, validLinks, previousLinks, now } =
    args
  const newVersion = baseVersion + 1
  const cond = liveContentCond(row.id, newVersion, content)
  const plain = extractPlainText(content)
  const { added, removed } = diffLinks(previousLinks, validLinks)

  return [
    db
      .update(t.notepads)
      .set({
        content,
        version: sql`${t.notepads.version} + 1`,
        updatedAt: now,
      })
      .where(
        and(eq(t.notepads.id, row.id), eq(t.notepads.version, baseVersion)),
      ),
    db.run(ftsDeleteStmt(row.id, cond)),
    db.run(ftsInsertStmt(row.id, row.title, plain, cond)),
    ...mentionNotificationStatements(db, {
      workspaceId: row.workspaceId,
      notepadId: row.id,
      actorId,
      addedUserIds: added
        .filter((l) => l.targetType === 'user')
        .map((l) => l.targetId),
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
      now,
    }),
    ...linkDeleteStatements(db, {
      sourceId: row.id,
      removed,
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
    }),
    ...linkInsertStatements(db, {
      sourceId: row.id,
      added,
      cond,
      condParams: LIVE_CONTENT_COND_PARAMS,
    }),
  ]
}

// ---------------------------------------------------------------------------
// Edit Locks
// ---------------------------------------------------------------------------

export interface ClaimLockArgs {
  notepadId: string
  userId: string
  clientId: string
}

export async function claimLock(db: DB, args: ClaimLockArgs) {
  const now = Date.now()
  const expiresAt = now + 60_000 // 60-second rolling window

  const [existingLock] = await db
    .select()
    .from(t.editLocks)
    .where(eq(t.editLocks.notepadId, args.notepadId))

  if (
    existingLock &&
    existingLock.expiresAt > now &&
    (existingLock.userId !== args.userId || existingLock.clientId !== args.clientId)
  ) {
    const [holder] = await db
      .select({ name: t.user.name })
      .from(t.user)
      .where(eq(t.user.id, existingLock.userId))

    throw new HttpError(
      409,
      'locked',
      JSON.stringify({
        code: 'locked',
        holder: { userId: existingLock.userId, name: holder?.name || 'Someone' },
        expiresAt: existingLock.expiresAt,
      }),
    )
  }

  // Atomic claim / upsert
  await db
    .insert(t.editLocks)
    .values({
      notepadId: args.notepadId,
      userId: args.userId,
      clientId: args.clientId,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: t.editLocks.notepadId,
      set: {
        userId: args.userId,
        clientId: args.clientId,
        expiresAt,
      },
    })

  return { expiresAt }
}

export async function releaseLock(db: DB, args: ClaimLockArgs) {
  await db
    .delete(t.editLocks)
    .where(
      and(
        eq(t.editLocks.notepadId, args.notepadId),
        eq(t.editLocks.userId, args.userId),
        eq(t.editLocks.clientId, args.clientId),
      ),
    )
}

// ---------------------------------------------------------------------------
// Tags on notepads
// ---------------------------------------------------------------------------

export async function setNotepadTags(
  db: DB,
  notepadId: string,
  tagIds: string[],
  workspaceId: string,
) {
  const [notepad] = await db
    .select()
    .from(t.notepads)
    .where(and(eq(t.notepads.id, notepadId), eq(t.notepads.workspaceId, workspaceId)))

  if (!notepad) throw new HttpError(404, 'not_found', 'Notepad not found')

  // Invariant I9: Every tag must belong to the notepad's project
  const uniqueTagIds = [...new Set(tagIds)]
  if (uniqueTagIds.length > 0) {
    const tags = await db
      .select({ id: t.tags.id })
      .from(t.tags)
      .where(and(eq(t.tags.projectId, notepad.projectId), inArray(t.tags.id, uniqueTagIds)))

    if (tags.length !== uniqueTagIds.length) {
      throw new HttpError(400, 'invalid_tags', 'All tags must belong to the notepad project')
    }
  }

  const statements: BatchItem<'sqlite'>[] = [
    db.delete(t.notepadTags).where(eq(t.notepadTags.notepadId, notepadId)),
  ]

  if (uniqueTagIds.length > 0) {
    for (const chunk of chunkByParamBudget(uniqueTagIds, 2, 0)) {
      statements.push(
        db.insert(t.notepadTags).values(
          chunk.map((tagId) => ({ notepadId, tagId })),
        ),
      )
    }
  }

  await runBatch(db, statements)
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
