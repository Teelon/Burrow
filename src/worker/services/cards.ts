import { nanoid } from 'nanoid'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { extractPlainText } from '../../shared/extract'
import { HttpError } from '../lib/errors'
import { positionAfterLast } from '../lib/ordering'
import { chunkByParamBudget } from '../lib/chunk'
import { runBatch } from '../lib/batch'
import { ftsInsertNowStmt } from '../lib/search'

export type CardPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface CreateCardInput {
  workspaceId: string
  actorId: string
  boardId: string
  columnId: string
  title: string
  priority?: CardPriority | null
  dueDate?: number | null
  assigneeIds?: string[]
  tagIds?: string[]
  /** From the quick-add `/notepad` command. */
  notepad?: { mode: 'new' } | { mode: 'existing'; id: string }
}

export interface CreatedCard {
  cardId: string
  notepadId: string
  linkedNotepadId: string | null
}

export interface CardPlan {
  workspaceId: string
  projectId: string
  boardId: string
  columnId: string
  actorId: string
  cardId: string
  notepadId: string
  title: string
  content: string
  plainText: string
  priority: CardPriority | null
  dueDate: number | null
  assigneeIds: string[]
  tagIds: string[]
  cardPosition: string
  linkedNotepad: { id: string; position: string; title: string } | null
  now: number
}

/**
 * Create a card atomically: card notepad (+ FTS row), the card row, optional
 * linked notepad, tags and assignees — all in one db.batch(). Either everything
 * lands or nothing does.
 */
export async function createCard(db: DB, input: CreateCardInput): Promise<CreatedCard> {
  const [board] = await db.select().from(t.boards).where(eq(t.boards.id, input.boardId))
  if (!board || board.workspaceId !== input.workspaceId || board.deletedAt !== null) {
    throw new HttpError(404, 'not_found', 'Board not found')
  }
  const [column] = await db.select().from(t.boardColumns).where(eq(t.boardColumns.id, input.columnId))
  if (!column || column.boardId !== board.id) {
    throw new HttpError(404, 'not_found', 'Column not found')
  }

  const assigneeIds = [...new Set(input.assigneeIds ?? [])]
  if (assigneeIds.length > 0) {
    const members = await db
      .select({ userId: t.members.userId })
      .from(t.members)
      .where(and(eq(t.members.workspaceId, input.workspaceId), inArray(t.members.userId, assigneeIds)))
    if (members.length !== assigneeIds.length) {
      throw new HttpError(400, 'invalid_assignees', 'Assignees must be workspace members')
    }
  }

  const tagIds = [...new Set(input.tagIds ?? [])]
  if (tagIds.length > 0) {
    const tags = await db
      .select({ id: t.tags.id })
      .from(t.tags)
      .where(and(eq(t.tags.projectId, board.projectId), inArray(t.tags.id, tagIds)))
    if (tags.length !== tagIds.length) {
      throw new HttpError(400, 'invalid_tags', 'Tags must belong to this project')
    }
  }

  let linkedNotepad: CardPlan['linkedNotepad'] = null
  let content = '[]'
  if (input.notepad?.mode === 'existing') {
    const [linked] = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.id, input.notepad.id))
    if (
      !linked ||
      linked.projectId !== board.projectId ||
      linked.workspaceId !== input.workspaceId ||
      linked.kind !== 'notepad' ||
      linked.deletedAt !== null
    ) {
      throw new HttpError(404, 'not_found', 'Notepad not found')
    }
    linkedNotepad = { id: linked.id, position: linked.position, title: linked.title }
    content = linkBlockBody(linked.id)
  } else if (input.notepad?.mode === 'new') {
    linkedNotepad = {
      id: nanoid(),
      position: await lastRootNotepadPosition(db, board.projectId),
      title: input.title.trim() || 'Untitled',
    }
    content = linkBlockBody(linkedNotepad.id)
  }

  const title = input.title.trim() || 'Untitled'
  const plan: CardPlan = {
    workspaceId: input.workspaceId,
    projectId: board.projectId,
    boardId: board.id,
    columnId: column.id,
    actorId: input.actorId,
    cardId: nanoid(),
    notepadId: nanoid(),
    title,
    content,
    plainText: extractPlainText(content),
    priority: input.priority ?? null,
    dueDate: input.dueDate ?? null,
    assigneeIds,
    tagIds,
    cardPosition: await lastCardPosition(db, column.id),
    linkedNotepad,
    now: Date.now(),
  }

  await runBatch(db, cardCreationStatements(db, plan))
  return {
    cardId: plan.cardId,
    notepadId: plan.notepadId,
    linkedNotepadId: linkedNotepad?.id ?? null,
  }
}

function linkBlockBody(notepadId: string): string {
  return JSON.stringify([
    { id: nanoid(), type: 'notepadLink', props: { notepadId }, content: [], children: [] },
  ])
}

async function lastCardPosition(db: DB, columnId: string): Promise<string> {
  const [last] = await db
    .select({ position: t.cards.position })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(and(eq(t.cards.columnId, columnId), isNull(t.notepads.deletedAt)))
    .orderBy(desc(t.cards.position))
    .limit(1)
  return positionAfterLast(last?.position ?? null)
}

async function lastRootNotepadPosition(db: DB, projectId: string): Promise<string> {
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

/** The exact statements createCard runs. Exported for the atomicity spike. */
export function cardCreationStatements(db: DB, plan: CardPlan): BatchItem<'sqlite'>[] {
  const statements: BatchItem<'sqlite'>[] = []

  if (plan.linkedNotepad) {
    statements.push(
      db.insert(t.notepads).values({
        id: plan.linkedNotepad.id,
        workspaceId: plan.workspaceId,
        projectId: plan.projectId,
        parentId: null,
        kind: 'notepad',
        title: plan.linkedNotepad.title,
        content: '[]',
        version: 1,
        position: plan.linkedNotepad.position,
        isFavorite: false,
        deletedAt: null,
        createdBy: plan.actorId,
        createdAt: plan.now,
        updatedAt: plan.now,
      }),
      db.run(ftsInsertNowStmt(plan.linkedNotepad.id, plan.linkedNotepad.title, '')),
    )
  }

  statements.push(
    db.insert(t.notepads).values({
      id: plan.notepadId,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
      parentId: null, // I2: card notepads are never in the tree
      kind: 'card',
      title: plan.title,
      content: plan.content,
      version: 1,
      position: 'a0',
      isFavorite: false,
      deletedAt: null,
      createdBy: plan.actorId,
      createdAt: plan.now,
      updatedAt: plan.now,
    }),
    db.run(ftsInsertNowStmt(plan.notepadId, plan.title, plan.plainText)),
    db.insert(t.cards).values({
      id: plan.cardId,
      boardId: plan.boardId,
      columnId: plan.columnId,
      notepadId: plan.notepadId,
      position: plan.cardPosition,
      priority: plan.priority,
      dueDate: plan.dueDate,
      createdAt: plan.now,
    }),
  )

  if (plan.assigneeIds.length > 0) {
    for (const chunk of chunkByParamBudget(plan.assigneeIds, 2, 0)) {
      const values = chunk.map((userId) => ({ cardId: plan.cardId, userId }))
      statements.push(db.insert(t.cardAssignees).values(values))
    }
  }

  if (plan.tagIds.length > 0) {
    for (const chunk of chunkByParamBudget(plan.tagIds, 2, 0)) {
      const values = chunk.map((tagId) => ({ notepadId: plan.notepadId, tagId }))
      statements.push(db.insert(t.notepadTags).values(values))
    }
  }

  return statements
}
