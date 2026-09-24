import { nanoid } from 'nanoid'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'
import * as t from '../db/schema'
import { extractPlainText } from '../../shared/extract'
import { HttpError } from '../lib/errors'
import { positionAfterLast, positionBetween } from '../lib/ordering'
import { chunkByParamBudget, chunkInList } from '../lib/chunk'
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

export async function getCard(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({
      id: t.cards.id,
      boardId: t.cards.boardId,
      columnId: t.cards.columnId,
      notepadId: t.cards.notepadId,
      position: t.cards.position,
      priority: t.cards.priority,
      dueDate: t.cards.dueDate,
      createdAt: t.cards.createdAt,
      title: t.notepads.title,
      content: t.notepads.content,
      version: t.notepads.version,
      projectId: t.notepads.projectId,
      workspaceId: t.notepads.workspaceId,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )

  if (!card) throw new HttpError(404, 'not_found', 'Card not found')

  const [board] = await db
    .select({ name: t.boards.name })
    .from(t.boards)
    .where(eq(t.boards.id, card.boardId))
  const [column] = await db
    .select({ name: t.boardColumns.name })
    .from(t.boardColumns)
    .where(eq(t.boardColumns.id, card.columnId))

  const assignees = await db
    .select({
      userId: t.cardAssignees.userId,
      name: t.user.name,
      image: t.user.image,
    })
    .from(t.cardAssignees)
    .innerJoin(t.user, eq(t.user.id, t.cardAssignees.userId))
    .where(eq(t.cardAssignees.cardId, cardId))

  const tags = await db
    .select({
      id: t.tags.id,
      name: t.tags.name,
      color: t.tags.color,
    })
    .from(t.notepadTags)
    .innerJoin(t.tags, eq(t.tags.id, t.notepadTags.tagId))
    .where(eq(t.notepadTags.notepadId, card.notepadId))

  const now = Date.now()
  const [lockRow] = await db
    .select()
    .from(t.editLocks)
    .where(eq(t.editLocks.notepadId, card.notepadId))

  let lock: { userId: string; clientId: string; name: string; expiresAt: number } | null = null
  if (lockRow && lockRow.expiresAt > now) {
    const [holder] = await db
      .select({ name: t.user.name })
      .from(t.user)
      .where(eq(t.user.id, lockRow.userId))
    lock = {
      userId: lockRow.userId,
      clientId: lockRow.clientId,
      name: holder?.name || 'Someone',
      expiresAt: lockRow.expiresAt,
    }
  }

  return {
    ...card,
    boardName: board?.name ?? 'Board',
    columnName: column?.name ?? 'Column',
    assignees,
    tags,
    subtasks: await listSubtasks(db, cardId),
    lock,
  }
}

// ---------------------------------------------------------------------------
// Subtasks (checklists)
// ---------------------------------------------------------------------------

/** Resolve a card scoped to the caller's workspace (soft-delete aware). */
async function requireCardForWorkspace(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({ id: t.cards.id, notepadId: t.cards.notepadId })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )
  if (!card) throw new HttpError(404, 'not_found', 'Card not found')
  return card
}

export async function listSubtasks(db: DB, cardId: string) {
  return db
    .select()
    .from(t.cardSubtasks)
    .where(eq(t.cardSubtasks.cardId, cardId))
    .orderBy(asc(t.cardSubtasks.position))
}

export async function createSubtask(
  db: DB,
  workspaceId: string,
  cardId: string,
  title: string,
) {
  await requireCardForWorkspace(db, workspaceId, cardId)

  const [last] = await db
    .select({ position: t.cardSubtasks.position })
    .from(t.cardSubtasks)
    .where(eq(t.cardSubtasks.cardId, cardId))
    .orderBy(desc(t.cardSubtasks.position))
    .limit(1)

  const row = {
    id: nanoid(),
    cardId,
    title: title.trim() || 'Untitled',
    completed: false,
    position: positionAfterLast(last?.position ?? null),
    createdAt: Date.now(),
  }
  await db.insert(t.cardSubtasks).values(row)
  return row
}

export async function updateSubtask(
  db: DB,
  workspaceId: string,
  cardId: string,
  subtaskId: string,
  updates: { title?: string; completed?: boolean; afterId?: string | null },
) {
  await requireCardForWorkspace(db, workspaceId, cardId)

  const [subtask] = await db
    .select()
    .from(t.cardSubtasks)
    .where(and(eq(t.cardSubtasks.id, subtaskId), eq(t.cardSubtasks.cardId, cardId)))
  if (!subtask) throw new HttpError(404, 'not_found', 'Subtask not found')

  const patch: Partial<typeof t.cardSubtasks.$inferInsert> = {}
  if (updates.title !== undefined) patch.title = updates.title.trim() || 'Untitled'
  if (updates.completed !== undefined) patch.completed = updates.completed

  // Optional reorder among siblings (fractional index owned by the server).
  if (updates.afterId !== undefined) {
    const siblings = await db
      .select({ id: t.cardSubtasks.id, position: t.cardSubtasks.position })
      .from(t.cardSubtasks)
      .where(eq(t.cardSubtasks.cardId, cardId))
      .orderBy(asc(t.cardSubtasks.position))
    const others = siblings.filter((s) => s.id !== subtaskId)

    let newPosition: string
    if (!updates.afterId) {
      newPosition = positionBetween(null, others[0]?.position ?? null)
    } else {
      const idx = others.findIndex((s) => s.id === updates.afterId)
      if (idx === -1) {
        throw new HttpError(400, 'invalid_after_id', 'afterId not found in subtask list')
      }
      newPosition = positionBetween(others[idx]!.position, others[idx + 1]?.position ?? null)
    }
    patch.position = newPosition
  }

  if (Object.keys(patch).length > 0) {
    await db.update(t.cardSubtasks).set(patch).where(eq(t.cardSubtasks.id, subtaskId))
  }
  return { ok: true, subtaskId }
}

export async function deleteSubtask(
  db: DB,
  workspaceId: string,
  cardId: string,
  subtaskId: string,
) {
  await requireCardForWorkspace(db, workspaceId, cardId)
  const [row] = await db
    .select({ id: t.cardSubtasks.id })
    .from(t.cardSubtasks)
    .where(and(eq(t.cardSubtasks.id, subtaskId), eq(t.cardSubtasks.cardId, cardId)))
  if (!row) throw new HttpError(404, 'not_found', 'Subtask not found')

  await db.delete(t.cardSubtasks).where(eq(t.cardSubtasks.id, subtaskId))
  return { ok: true, subtaskId }
}

// ---------------------------------------------------------------------------
// My Tasks (cross-project assignee inbox)
// ---------------------------------------------------------------------------

export interface MyTasksFilters {
  status?: 'all' | 'open' | 'completed'
  projectId?: string
}

export interface MyTaskItem {
  id: string
  notepadId: string
  boardId: string
  columnId: string
  projectId: string
  title: string
  dueDate: number | null
  priority: CardPriority | null
  isCompleted: boolean
  createdAt: number
  boardName: string
  columnName: string
  projectName: string
  projectIcon: string | null
  projectColor: string | null
  tags: Array<{ id: string; name: string; color: string | null }>
}

/** A column named "Done"/"Completed"/etc. marks its cards as finished. */
export function isCompletedColumn(columnName: string): boolean {
  return /done|completed|closed|shipped/i.test(columnName)
}

export async function getMyTasks(
  db: DB,
  workspaceId: string,
  userId: string,
  filters: MyTasksFilters,
): Promise<MyTaskItem[]> {
  const rows = await db
    .select({
      id: t.cards.id,
      notepadId: t.cards.notepadId,
      boardId: t.cards.boardId,
      columnId: t.cards.columnId,
      projectId: t.projects.id,
      title: t.notepads.title,
      dueDate: t.cards.dueDate,
      priority: t.cards.priority,
      createdAt: t.cards.createdAt,
      boardName: t.boards.name,
      columnName: t.boardColumns.name,
      projectName: t.projects.name,
      projectIcon: t.projects.icon,
      projectColor: t.projects.color,
    })
    .from(t.cards)
    .innerJoin(t.cardAssignees, eq(t.cardAssignees.cardId, t.cards.id))
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .innerJoin(t.boards, eq(t.boards.id, t.cards.boardId))
    .innerJoin(t.boardColumns, eq(t.boardColumns.id, t.cards.columnId))
    .innerJoin(t.projects, eq(t.projects.id, t.boards.projectId))
    .where(
      and(
        eq(t.cardAssignees.userId, userId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
        isNull(t.boards.deletedAt),
        isNull(t.projects.archivedAt),
        filters.projectId ? eq(t.boards.projectId, filters.projectId) : undefined,
      ),
    )
    .orderBy(desc(t.cards.dueDate), asc(t.cards.position))

  const status = filters.status ?? 'all'
  const filtered =
    status === 'all'
      ? rows
      : rows.filter((r) => {
          const completed = isCompletedColumn(r.columnName)
          return status === 'completed' ? completed : !completed
        })

  if (filtered.length === 0) return []

  // Tags for the matched card notepads
  const notepadIds = filtered.map((r) => r.notepadId)
  const tagRows: Array<{ notepadId: string; tagId: string; name: string; color: string | null }> = []
  for (const chunk of chunkInList(notepadIds, 0)) {
    const more = await db
      .select({
        notepadId: t.notepadTags.notepadId,
        tagId: t.tags.id,
        name: t.tags.name,
        color: t.tags.color,
      })
      .from(t.notepadTags)
      .innerJoin(t.tags, eq(t.tags.id, t.notepadTags.tagId))
      .where(inArray(t.notepadTags.notepadId, chunk))
    tagRows.push(...more)
  }

  const tagsByNotepad = new Map<string, MyTaskItem['tags']>()
  for (const tag of tagRows) {
    const list = tagsByNotepad.get(tag.notepadId) || []
    list.push({ id: tag.tagId, name: tag.name, color: tag.color })
    tagsByNotepad.set(tag.notepadId, list)
  }

  return filtered.map((r) => ({
    id: r.id,
    notepadId: r.notepadId,
    boardId: r.boardId,
    columnId: r.columnId,
    projectId: r.projectId,
    title: r.title,
    dueDate: r.dueDate,
    priority: r.priority,
    isCompleted: isCompletedColumn(r.columnName),
    createdAt: r.createdAt,
    boardName: r.boardName,
    columnName: r.columnName,
    projectName: r.projectName,
    projectIcon: r.projectIcon,
    projectColor: r.projectColor,
    tags: tagsByNotepad.get(r.notepadId) || [],
  }))
}

export async function moveCard(
  db: DB,
  workspaceId: string,
  cardId: string,
  columnId: string,
  afterId?: string | null,
) {
  const [card] = await db
    .select({
      id: t.cards.id,
      boardId: t.cards.boardId,
      columnId: t.cards.columnId,
      notepadId: t.cards.notepadId,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )
  if (!card) throw new HttpError(404, 'not_found', 'Card not found')

  const [column] = await db
    .select({ id: t.boardColumns.id })
    .from(t.boardColumns)
    .where(
      and(
        eq(t.boardColumns.id, columnId),
        eq(t.boardColumns.boardId, card.boardId),
      ),
    )
  if (!column) throw new HttpError(404, 'not_found', 'Destination column not found on this board')

  const columnCards = await db
    .select({ id: t.cards.id, position: t.cards.position })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.columnId, columnId),
        isNull(t.notepads.deletedAt),
      ),
    )
    .orderBy(asc(t.cards.position))

  const others = columnCards.filter((c) => c.id !== cardId)

  let newPosition: string
  if (!afterId) {
    const next = others[0]?.position ?? null
    newPosition = positionBetween(null, next)
  } else {
    const afterIndex = others.findIndex((c) => c.id === afterId)
    if (afterIndex === -1) {
      throw new HttpError(400, 'invalid_after_id', 'afterId not found in column')
    }
    const prev = others[afterIndex]!.position
    const next = others[afterIndex + 1]?.position ?? null
    newPosition = positionBetween(prev, next)
  }

  await db
    .update(t.cards)
    .set({ columnId, position: newPosition })
    .where(eq(t.cards.id, cardId))

  return { columnId, position: newPosition }
}

export interface UpdateCardArgs {
  title?: string
  priority?: CardPriority | null
  dueDate?: number | null
  assigneeIds?: string[]
  tagIds?: string[]
}

export async function updateCard(
  db: DB,
  workspaceId: string,
  cardId: string,
  updates: UpdateCardArgs,
  actorId?: string,
) {
  const [card] = await db
    .select({
      id: t.cards.id,
      boardId: t.cards.boardId,
      notepadId: t.cards.notepadId,
      projectId: t.notepads.projectId,
      currentTitle: t.notepads.title,
      currentContent: t.notepads.content,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )
  if (!card) throw new HttpError(404, 'not_found', 'Card not found')

  const now = Date.now()
  const statements: BatchItem<'sqlite'>[] = []

  // Assignees validation & update (I10)
  if (updates.assigneeIds !== undefined) {
    const cleanAssignees = [...new Set(updates.assigneeIds)]
    if (cleanAssignees.length > 0) {
      const members = await db
        .select({ userId: t.members.userId })
        .from(t.members)
        .where(
          and(
            eq(t.members.workspaceId, workspaceId),
            inArray(t.members.userId, cleanAssignees),
          ),
        )
      if (members.length !== cleanAssignees.length) {
        throw new HttpError(400, 'invalid_assignees', 'Assignees must be workspace members')
      }
    }

    // Detect newly added assignees for notifications (excluding actor)
    const existingAssignees = await db
      .select({ userId: t.cardAssignees.userId })
      .from(t.cardAssignees)
      .where(eq(t.cardAssignees.cardId, cardId))
    const existingSet = new Set(existingAssignees.map((a) => a.userId))
    const newlyAdded = cleanAssignees.filter((uid) => !existingSet.has(uid) && uid !== actorId)

    statements.push(
      db.delete(t.cardAssignees).where(eq(t.cardAssignees.cardId, cardId)),
    )
    if (cleanAssignees.length > 0) {
      for (const chunk of chunkByParamBudget(cleanAssignees, 2, 0)) {
        const values = chunk.map((userId) => ({ cardId, userId }))
        statements.push(db.insert(t.cardAssignees).values(values))
      }
    }

    if (actorId && newlyAdded.length > 0) {
      for (const chunk of chunkByParamBudget(newlyAdded, 5, 0)) {
        const notifValues = chunk.map((recipientId) => ({
          id: nanoid(),
          workspaceId,
          userId: recipientId,
          type: 'assigned' as const,
          actorId,
          cardId,
          notepadId: card.notepadId,
          createdAt: now,
        }))
        statements.push(db.insert(t.notifications).values(notifValues))
      }
    }
  }

  // Tags validation & update (I9)
  if (updates.tagIds !== undefined) {
    const cleanTags = [...new Set(updates.tagIds)]
    if (cleanTags.length > 0) {
      const tags = await db
        .select({ id: t.tags.id })
        .from(t.tags)
        .where(
          and(
            eq(t.tags.projectId, card.projectId),
            inArray(t.tags.id, cleanTags),
          ),
        )
      if (tags.length !== cleanTags.length) {
        throw new HttpError(400, 'invalid_tags', 'Tags must belong to this project')
      }
    }

    statements.push(
      db.delete(t.notepadTags).where(eq(t.notepadTags.notepadId, card.notepadId)),
    )
    if (cleanTags.length > 0) {
      for (const chunk of chunkByParamBudget(cleanTags, 2, 0)) {
        const values = chunk.map((tagId) => ({ notepadId: card.notepadId, tagId }))
        statements.push(db.insert(t.notepadTags).values(values))
      }
    }
  }

  // Priority and Due Date
  const cardUpdates: Partial<typeof t.cards.$inferInsert> = {}
  if (updates.priority !== undefined) cardUpdates.priority = updates.priority ?? null
  if (updates.dueDate !== undefined) cardUpdates.dueDate = updates.dueDate ?? null

  if (Object.keys(cardUpdates).length > 0) {
    statements.push(
      db.update(t.cards).set(cardUpdates).where(eq(t.cards.id, cardId)),
    )
  }

  // Title update on notepad & FTS
  if (updates.title !== undefined) {
    const newTitle = updates.title.trim() || 'Untitled'
    statements.push(
      db
        .update(t.notepads)
        .set({ title: newTitle, updatedAt: now })
        .where(eq(t.notepads.id, card.notepadId)),
      db.run(sql`DELETE FROM notepads_fts WHERE notepad_id = ${card.notepadId}`),
      db.run(
        ftsInsertNowStmt(
          card.notepadId,
          newTitle,
          extractPlainText(card.currentContent),
        ),
      ),
    )
  }

  if (statements.length > 0) {
    await runBatch(db, statements)
  }

  return { ok: true, cardId }
}

export async function deleteCard(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({
      id: t.cards.id,
      notepadId: t.cards.notepadId,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )
  if (!card) throw new HttpError(404, 'not_found', 'Card not found')

  const now = Date.now()
  // Invariant I5: Card and its notepad always have the same soft-delete state (deleted_at equal)
  await runBatch(db, [
    db
      .update(t.notepads)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(t.notepads.id, card.notepadId)),
    db.run(sql`DELETE FROM notepads_fts WHERE notepad_id = ${card.notepadId}`),
  ])

  return { ok: true, cardId }
}

export async function restoreCard(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({
      id: t.cards.id,
      notepadId: t.cards.notepadId,
      title: t.notepads.title,
      content: t.notepads.content,
      deletedAt: t.notepads.deletedAt,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
      ),
    )
  if (!card || card.deletedAt === null) {
    throw new HttpError(404, 'not_found', 'Deleted card not found')
  }

  const now = Date.now()
  const plainText = extractPlainText(card.content)

  await runBatch(db, [
    db
      .update(t.notepads)
      .set({ deletedAt: null, updatedAt: now })
      .where(eq(t.notepads.id, card.notepadId)),
    db.run(ftsInsertNowStmt(card.notepadId, card.title, plainText)),
  ])

  return { ok: true, cardId }
}

export async function permanentDeleteCard(db: DB, workspaceId: string, cardId: string) {
  const [card] = await db
    .select({
      id: t.cards.id,
      notepadId: t.cards.notepadId,
      deletedAt: t.notepads.deletedAt,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .where(
      and(
        eq(t.cards.id, cardId),
        eq(t.notepads.workspaceId, workspaceId),
      ),
    )
  if (!card || card.deletedAt === null) {
    throw new HttpError(404, 'not_found', 'Deleted card not found in trash')
  }

  // Deleting the notepad cascades to cards, cardAssignees, notepadTags
  await runBatch(db, [
    db.run(sql`DELETE FROM notepads_fts WHERE notepad_id = ${card.notepadId}`),
    db.delete(t.notepads).where(eq(t.notepads.id, card.notepadId)),
  ])

  return { ok: true, cardId }
}

export async function getCardsSummary(
  db: DB,
  workspaceId: string,
  cardIds: string[],
) {
  if (cardIds.length === 0) return []
  const cappedIds = cardIds.slice(0, 50)

  const rows = await db
    .select({
      id: t.cards.id,
      notepadId: t.cards.notepadId,
      boardId: t.cards.boardId,
      columnId: t.cards.columnId,
      priority: t.cards.priority,
      dueDate: t.cards.dueDate,
      title: t.notepads.title,
      boardName: t.boards.name,
      columnName: t.boardColumns.name,
    })
    .from(t.cards)
    .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
    .innerJoin(t.boards, eq(t.boards.id, t.cards.boardId))
    .innerJoin(t.boardColumns, eq(t.boardColumns.id, t.cards.columnId))
    .where(
      and(
        inArray(t.cards.id, cappedIds),
        eq(t.notepads.workspaceId, workspaceId),
        isNull(t.notepads.deletedAt),
      ),
    )

  if (rows.length === 0) return []

  const fetchedCardIds = rows.map((r) => r.id)
  const assignees = await db
    .select({
      cardId: t.cardAssignees.cardId,
      userId: t.cardAssignees.userId,
      name: t.user.name,
      image: t.user.image,
    })
    .from(t.cardAssignees)
    .innerJoin(t.user, eq(t.user.id, t.cardAssignees.userId))
    .where(inArray(t.cardAssignees.cardId, fetchedCardIds))

  const assigneesByCard = new Map<string, typeof assignees>()
  for (const a of assignees) {
    const list = assigneesByCard.get(a.cardId) || []
    list.push(a)
    assigneesByCard.set(a.cardId, list)
  }

  return rows.map((r) => ({
    id: r.id,
    notepadId: r.notepadId,
    title: r.title,
    boardId: r.boardId,
    boardName: r.boardName,
    columnId: r.columnId,
    columnName: r.columnName,
    priority: r.priority,
    dueDate: r.dueDate,
    assignees: (assigneesByCard.get(r.id) || []).map((a) => ({
      userId: a.userId,
      name: a.name,
      image: a.image,
    })),
  }))
}
