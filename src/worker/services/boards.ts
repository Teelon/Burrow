import { nanoid } from 'nanoid'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { HttpError } from '../lib/errors'
import { runBatch } from '../lib/batch'
import { positionAfterLast, positionBetween } from '../lib/ordering'
import { chunkByParamBudget } from '../lib/chunk'
import { extractPlainText } from '../../shared/extract'
import { ftsInsertNowStmt } from '../lib/search'

export interface CreateBoardArgs {
  workspaceId: string
  projectId: string
  name: string
  icon?: string | null
}

export async function listBoards(db: DB, workspaceId: string, projectId: string) {
  return db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.workspaceId, workspaceId),
        eq(t.boards.projectId, projectId),
        isNull(t.boards.deletedAt),
      ),
    )
    .orderBy(asc(t.boards.position))
}

export async function createBoard(db: DB, args: CreateBoardArgs) {
  const [project] = await db
    .select()
    .from(t.projects)
    .where(
      and(
        eq(t.projects.id, args.projectId),
        eq(t.projects.workspaceId, args.workspaceId),
      ),
    )
  if (!project) throw new HttpError(404, 'not_found', 'Project not found')

  const [last] = await db
    .select({ position: t.boards.position })
    .from(t.boards)
    .where(
      and(
        eq(t.boards.projectId, args.projectId),
        isNull(t.boards.deletedAt),
      ),
    )
    .orderBy(desc(t.boards.position))
    .limit(1)

  const boardPosition = positionAfterLast(last?.position ?? null)
  const boardId = nanoid()
  const now = Date.now()

  // Default columns: To do, In progress, Done
  const defaultColumns = [
    { id: nanoid(), name: 'To do', color: '#64748b', position: 'a0' },
    { id: nanoid(), name: 'In progress', color: '#3b82f6', position: 'a1' },
    { id: nanoid(), name: 'Done', color: '#10b981', position: 'a2' },
  ]

  await runBatch(db, [
    db.insert(t.boards).values({
      id: boardId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      name: args.name.trim() || 'Untitled Board',
      icon: args.icon ?? null,
      position: boardPosition,
      createdAt: now,
      updatedAt: now,
    }),
    ...defaultColumns.map((col) =>
      db.insert(t.boardColumns).values({
        id: col.id,
        boardId,
        name: col.name,
        color: col.color,
        position: col.position,
      }),
    ),
  ])

  return { id: boardId, position: boardPosition }
}

export async function getBoard(db: DB, workspaceId: string, boardId: string) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )

  if (!board) throw new HttpError(404, 'not_found', 'Board not found')

  const columns = await db
    .select()
    .from(t.boardColumns)
    .where(eq(t.boardColumns.boardId, boardId))
    .orderBy(asc(t.boardColumns.position))

  const cardsWithNotepads = await db
    .select({
      id: t.cards.id,
      boardId: t.cards.boardId,
      columnId: t.cards.columnId,
      notepadId: t.cards.notepadId,
      title: t.notepads.title,
      position: t.cards.position,
      priority: t.cards.priority,
      dueDate: t.cards.dueDate,
      createdAt: t.cards.createdAt,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.boardId, boardId),
        isNull(t.notepads.deletedAt),
      ),
    )
    .orderBy(asc(t.cards.position))

  // Fetch assignees
  const cardIds = cardsWithNotepads.map((c) => c.id)
  const assignees = cardIds.length > 0
    ? await db
        .select({
          cardId: t.cardAssignees.cardId,
          userId: t.cardAssignees.userId,
          name: t.user.name,
          image: t.user.image,
        })
        .from(t.cardAssignees)
        .innerJoin(t.user, eq(t.user.id, t.cardAssignees.userId))
        .where(inArray(t.cardAssignees.cardId, cardIds))
    : []

  const assigneesByCard = new Map<string, typeof assignees>()
  for (const a of assignees) {
    const list = assigneesByCard.get(a.cardId) || []
    list.push(a)
    assigneesByCard.set(a.cardId, list)
  }

  // Fetch tags for card notepads
  const notepadIds = cardsWithNotepads.map((c) => c.notepadId)
  const tags = notepadIds.length > 0
    ? await db
        .select({
          notepadId: t.notepadTags.notepadId,
          tagId: t.tags.id,
          name: t.tags.name,
          color: t.tags.color,
        })
        .from(t.notepadTags)
        .innerJoin(t.tags, eq(t.tags.id, t.notepadTags.tagId))
        .where(inArray(t.notepadTags.notepadId, notepadIds))
    : []

  // Subtask progress per card (for tile progress pills)
  const subtaskCounts = cardIds.length > 0
    ? await db
        .select({
          cardId: t.cardSubtasks.cardId,
          total: sql<number>`count(*)`,
          completed: sql<number>`coalesce(sum(case when ${t.cardSubtasks.completed} then 1 else 0 end), 0)`,
        })
        .from(t.cardSubtasks)
        .where(inArray(t.cardSubtasks.cardId, cardIds))
        .groupBy(t.cardSubtasks.cardId)
    : []

  const subtasksByCard = new Map<string, { total: number; completed: number }>()
  for (const row of subtaskCounts) {
    subtasksByCard.set(row.cardId, { total: row.total, completed: row.completed })
  }

  const tagsByNotepad = new Map<string, typeof tags>()
  for (const tag of tags) {
    const list = tagsByNotepad.get(tag.notepadId) || []
    list.push(tag)
    tagsByNotepad.set(tag.notepadId, list)
  }

  // Group cards by column
  const cardsByColumn = new Map<string, any[]>()
  for (const card of cardsWithNotepads) {
    const cardAssignees = assigneesByCard.get(card.id) || []
    const cardTags = tagsByNotepad.get(card.notepadId) || []
    const subtaskProgress = subtasksByCard.get(card.id) || { total: 0, completed: 0 }
    const list = cardsByColumn.get(card.columnId) || []
    list.push({
      ...card,
      assignees: cardAssignees,
      tags: cardTags,
      totalSubtasks: subtaskProgress.total,
      completedSubtasks: subtaskProgress.completed,
    })
    cardsByColumn.set(card.columnId, list)
  }

  return {
    ...board,
    columns: columns.map((col) => ({
      ...col,
      cards: cardsByColumn.get(col.id) || [],
    })),
  }
}

export async function updateBoard(
  db: DB,
  workspaceId: string,
  boardId: string,
  updates: { name?: string; icon?: string | null },
) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!board) throw new HttpError(404, 'not_found', 'Board not found')

  await db
    .update(t.boards)
    .set({
      name: updates.name ? updates.name.trim() : undefined,
      icon: updates.icon !== undefined ? updates.icon : undefined,
      updatedAt: Date.now(),
    })
    .where(eq(t.boards.id, boardId))
}

export async function softDeleteBoard(
  db: DB,
  workspaceId: string,
  boardId: string,
) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!board) throw new HttpError(404, 'not_found', 'Board not found')

  const now = Date.now()
  const cards = await db
    .select({ notepadId: t.cards.notepadId })
    .from(t.cards)
    .where(eq(t.cards.boardId, boardId))

  const notepadIds = cards.map((c) => c.notepadId)

  const statements: BatchItem<'sqlite'>[] = [
    db
      .update(t.boards)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(t.boards.id, boardId)),
  ]

  if (notepadIds.length > 0) {
    for (const chunk of chunkByParamBudget(notepadIds, 1, 1)) {
      statements.push(
        db
          .update(t.notepads)
          .set({ deletedAt: now, updatedAt: now })
          .where(inArray(t.notepads.id, chunk)),
      )
    }
    for (const chunk of chunkByParamBudget(notepadIds, 1, 0)) {
      statements.push(
        db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`),
      )
    }
  }

  await runBatch(db, statements)
}

export async function restoreBoard(
  db: DB,
  workspaceId: string,
  boardId: string,
) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
      ),
    )
  if (!board || board.deletedAt === null) {
    throw new HttpError(404, 'not_found', 'Deleted board not found')
  }

  const deleteTimestamp = board.deletedAt
  const now = Date.now()

  // Find cards whose notepads share this deletion timestamp
  const cards = await db
    .select({
      id: t.notepads.id,
      title: t.notepads.title,
      content: t.notepads.content,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.boardId, boardId),
        eq(t.notepads.deletedAt, deleteTimestamp),
      ),
    )

  const notepadIds = cards.map((c) => c.id)

  const statements: BatchItem<'sqlite'>[] = [
    db
      .update(t.boards)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(t.boards.id, boardId)),
  ]

  if (notepadIds.length > 0) {
    for (const chunk of chunkByParamBudget(notepadIds, 1, 1)) {
      statements.push(
        db
          .update(t.notepads)
          .set({ deletedAt: null, updatedAt: now })
          .where(inArray(t.notepads.id, chunk)),
      )
    }
    // Invariant I7: Re-insert FTS row for each restored card notepad
    for (const card of cards) {
      const plainText = extractPlainText(card.content)
      statements.push(db.run(ftsInsertNowStmt(card.id, card.title, plainText)))
    }
  }

  await runBatch(db, statements)
}

export async function permanentDeleteBoard(
  db: DB,
  workspaceId: string,
  boardId: string,
) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
      ),
    )
  if (!board || board.deletedAt === null) {
    throw new HttpError(404, 'not_found', 'Deleted board not found in trash')
  }

  const cards = await db
    .select({ notepadId: t.cards.notepadId })
    .from(t.cards)
    .where(eq(t.cards.boardId, boardId))

  const notepadIds = cards.map((c) => c.notepadId)
  const statements: BatchItem<'sqlite'>[] = []

  if (notepadIds.length > 0) {
    for (const chunk of chunkByParamBudget(notepadIds, 1, 0)) {
      statements.push(
        db.run(sql`DELETE FROM notepads_fts WHERE notepad_id IN ${chunk}`),
      )
    }
    for (const chunk of chunkByParamBudget(notepadIds, 1, 0)) {
      statements.push(
        db.delete(t.notepads).where(inArray(t.notepads.id, chunk)),
      )
    }
  }

  statements.push(db.delete(t.boards).where(eq(t.boards.id, boardId)))

  await runBatch(db, statements)
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export async function createColumn(
  db: DB,
  workspaceId: string,
  boardId: string,
  name: string,
  color?: string | null,
) {
  const [board] = await db
    .select()
    .from(t.boards)
    .where(
      and(
        eq(t.boards.id, boardId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!board) throw new HttpError(404, 'not_found', 'Board not found')

  const [last] = await db
    .select({ position: t.boardColumns.position })
    .from(t.boardColumns)
    .where(eq(t.boardColumns.boardId, boardId))
    .orderBy(desc(t.boardColumns.position))
    .limit(1)

  const position = positionAfterLast(last?.position ?? null)
  const id = nanoid()

  await db.insert(t.boardColumns).values({
    id,
    boardId,
    name: name.trim() || 'Untitled Column',
    color: color ?? null,
    position,
  })

  return { id, position }
}

export async function updateColumn(
  db: DB,
  workspaceId: string,
  columnId: string,
  updates: { name?: string; color?: string | null; wipLimit?: number | null },
) {
  const [col] = await db
    .select({ id: t.boardColumns.id })
    .from(t.boardColumns)
    .innerJoin(t.boards, eq(t.boards.id, t.boardColumns.boardId))
    .where(
      and(
        eq(t.boardColumns.id, columnId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!col) throw new HttpError(404, 'not_found', 'Column not found')

  await db
    .update(t.boardColumns)
    .set({
      name: updates.name ? updates.name.trim() : undefined,
      color: updates.color !== undefined ? updates.color : undefined,
      wipLimit: updates.wipLimit !== undefined ? updates.wipLimit : undefined,
    })
    .where(eq(t.boardColumns.id, columnId))
}

export async function moveColumn(
  db: DB,
  workspaceId: string,
  columnId: string,
  afterId?: string | null,
) {
  const [col] = await db
    .select({ id: t.boardColumns.id, boardId: t.boardColumns.boardId })
    .from(t.boardColumns)
    .innerJoin(t.boards, eq(t.boards.id, t.boardColumns.boardId))
    .where(
      and(
        eq(t.boardColumns.id, columnId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!col) throw new HttpError(404, 'not_found', 'Column not found')

  const columns = await db
    .select({ id: t.boardColumns.id, position: t.boardColumns.position })
    .from(t.boardColumns)
    .where(eq(t.boardColumns.boardId, col.boardId))
    .orderBy(asc(t.boardColumns.position))

  const others = columns.filter((c) => c.id !== columnId)

  let newPosition: string
  if (!afterId) {
    const next = others[0]?.position ?? null
    newPosition = positionBetween(null, next)
  } else {
    const afterIndex = others.findIndex((c) => c.id === afterId)
    if (afterIndex === -1) {
      throw new HttpError(400, 'invalid_after_id', 'afterId not found')
    }
    const prev = others[afterIndex]!.position
    const next = others[afterIndex + 1]?.position ?? null
    newPosition = positionBetween(prev, next)
  }

  await db
    .update(t.boardColumns)
    .set({ position: newPosition })
    .where(eq(t.boardColumns.id, columnId))

  return { position: newPosition }
}

export async function deleteColumn(
  db: DB,
  workspaceId: string,
  columnId: string,
  moveToColumnId?: string | null,
) {
  const [col] = await db
    .select({ id: t.boardColumns.id, boardId: t.boardColumns.boardId })
    .from(t.boardColumns)
    .innerJoin(t.boards, eq(t.boards.id, t.boardColumns.boardId))
    .where(
      and(
        eq(t.boardColumns.id, columnId),
        eq(t.boards.workspaceId, workspaceId),
        isNull(t.boards.deletedAt),
      ),
    )
  if (!col) throw new HttpError(404, 'not_found', 'Column not found')

  const cardsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(t.cards)
    .where(eq(t.cards.columnId, columnId))

  const count = cardsCount[0]?.count ?? 0
  if (count > 0) {
    if (!moveToColumnId) {
      throw new HttpError(
        400,
        'destination_required',
        'Column has cards; specify ?moveTo=<columnId> to migrate them',
      )
    }

    const [dest] = await db
      .select({ id: t.boardColumns.id })
      .from(t.boardColumns)
      .where(
        and(
          eq(t.boardColumns.id, moveToColumnId),
          eq(t.boardColumns.boardId, col.boardId),
        ),
      )
    if (!dest) {
      throw new HttpError(400, 'invalid_destination', 'Destination column not found on this board')
    }

    // Move cards to dest column
    await db
      .update(t.cards)
      .set({ columnId: moveToColumnId })
      .where(eq(t.cards.columnId, columnId))
  }

  await db.delete(t.boardColumns).where(eq(t.boardColumns.id, columnId))
}
