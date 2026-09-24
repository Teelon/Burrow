import { nanoid } from 'nanoid'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { extractFromContent, extractPlainText } from '../../shared/extract'
import { HttpError } from '../lib/errors'
import { runBatch } from '../lib/batch'
import { positionAfterLast } from '../lib/ordering'
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

export async function createNotepad(db: DB, args: CreateNotepadArgs): Promise<CreatedNotepad> {
  const [project] = await db.select().from(t.projects).where(eq(t.projects.id, args.projectId))
  if (!project || project.workspaceId !== args.workspaceId) {
    throw new HttpError(404, 'not_found', 'Project not found')
  }

  let position = args.position ?? null
  if (args.parentId) {
    const [parent] = await db.select().from(t.notepads).where(eq(t.notepads.id, args.parentId))
    if (
      !parent ||
      parent.projectId !== args.projectId ||
      parent.workspaceId !== args.workspaceId ||
      parent.deletedAt !== null ||
      parent.kind !== 'notepad'
    ) {
      throw new HttpError(404, 'not_found', 'Parent notepad not found')
    }
    const parentDepth = await depthOf(db, parent)
    if (parentDepth + 1 > MAX_NOTEPAD_DEPTH) {
      throw new HttpError(400, 'too_deep', `Notepads can nest at most ${MAX_NOTEPAD_DEPTH} deep`)
    }
    if (!position) position = await lastChildPosition(db, parent.id)
  } else if (!position) {
    position = await lastRootPosition(db, args.projectId)
  }

  const id = nanoid()
  const now = Date.now()
  const title = args.title?.trim() || 'Untitled'
  await db.batch([
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

async function depthOf(db: DB, notepad: { id: string; parentId: string | null }): Promise<number> {
  let depth = 1
  let currentId = notepad.parentId
  while (currentId && depth <= MAX_NOTEPAD_DEPTH + 1) {
    const [parent] = await db
      .select({ id: t.notepads.id, parentId: t.notepads.parentId })
      .from(t.notepads)
      .where(eq(t.notepads.id, currentId))
    if (!parent) break
    depth++
    currentId = parent.parentId
  }
  return depth
}

async function lastChildPosition(db: DB, parentId: string): Promise<string> {
  const [last] = await db
    .select({ position: t.notepads.position })
    .from(t.notepads)
    .where(and(eq(t.notepads.parentId, parentId), isNull(t.notepads.deletedAt)))
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

export interface SaveContentArgs {
  notepadId: string
  content: string
  baseVersion: number
  /** Acting user — mentioned users other than this one get notifications. */
  actorId: string
}

export interface SaveContentResult {
  version: number
}

interface PreparedSave {
  row: { id: string; workspaceId: string; title: string; version: number }
  validLinks: StoredLink[]
  previousLinks: StoredLink[]
}

/**
 * Read everything the save batch needs: the notepad row, its existing links,
 * and the extracted link targets filtered to this workspace (I8).
 */
export async function prepareSave(db: DB, args: SaveContentArgs): Promise<PreparedSave> {
  const [row] = await db.select().from(t.notepads).where(eq(t.notepads.id, args.notepadId))
  if (!row) throw new HttpError(404, 'not_found', 'Notepad not found')
  const extraction = extractFromContent(args.content)
  const validLinks = await filterWorkspaceTargets(db, row.workspaceId, extraction.links)
  const previousLinks = await db
    .select({ targetType: t.notepadLinks.targetType, targetId: t.notepadLinks.targetId })
    .from(t.notepadLinks)
    .where(eq(t.notepadLinks.sourceId, row.id))
  return {
    row: { id: row.id, workspaceId: row.workspaceId, title: row.title, version: row.version },
    validLinks,
    previousLinks,
  }
}

/**
 * Version-gated, atomic content save. The batch:
 *   1. UPDATE the notepad only when version = baseVersion
 *   2. rebuild the FTS row
 *   3. insert mention notifications for newly added user mentions
 *   4. diff notepad_links (delete removed, insert added)
 * Statements 2-4 only take effect while the row holds the exact content this
 * save just wrote (see liveContentCond), so a stale save changes NOTHING
 * anywhere — including FTS, links and notifications.
 */
export async function saveContent(db: DB, args: SaveContentArgs): Promise<SaveContentResult> {
  if (byteLength(args.content) > MAX_CONTENT_BYTES) {
    throw new HttpError(413, 'content_too_large', 'Notepad content exceeds 1.5 MB')
  }
  const prepared = await prepareSave(db, args)
  if (prepared.row.version !== args.baseVersion) {
    throw new HttpError(409, 'version_conflict', 'This notepad changed elsewhere')
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
      now: Date.now(),
    }),
  )

  const [after] = await db
    .select({ content: t.notepads.content, version: t.notepads.version })
    .from(t.notepads)
    .where(eq(t.notepads.id, prepared.row.id))
  if (!after || after.content !== args.content) {
    throw new HttpError(409, 'version_conflict', 'This notepad changed elsewhere')
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

/** Exported for the Phase 0 atomicity spike, which drives the batch directly. */
export function buildSaveContentStatements(db: DB, args: SaveStatementArgs): BatchItem<'sqlite'>[] {
  const { row, content, baseVersion, actorId, validLinks, previousLinks, now } = args
  const newVersion = baseVersion + 1
  const cond = liveContentCond(row.id, newVersion, content)
  const plain = extractPlainText(content)
  const { added, removed } = diffLinks(previousLinks, validLinks)

  return [
    db
      .update(t.notepads)
      .set({ content, version: sql`${t.notepads.version} + 1`, updatedAt: now })
      .where(and(eq(t.notepads.id, row.id), eq(t.notepads.version, baseVersion))),
    db.run(ftsDeleteStmt(row.id, cond)),
    db.run(ftsInsertStmt(row.id, row.title, plain, cond)),
    // Notifications must run before link inserts so NOT EXISTS sees prior state.
    ...mentionNotificationStatements(db, {
      workspaceId: row.workspaceId,
      notepadId: row.id,
      actorId,
      addedUserIds: added.filter((l) => l.targetType === 'user').map((l) => l.targetId),
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

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}
