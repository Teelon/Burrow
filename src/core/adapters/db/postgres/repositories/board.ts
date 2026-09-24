import type {
  IBoardRepository,
  Board,
  CreateBoardData,
  UpdateBoardData,
  BoardColumn,
  BoardWithDetails,
  CreateColumnData,
  UpdateColumnData,
} from '../../../../infrastructure/types'
import { eq, and, isNotNull, isNull, desc, inArray, sql } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import {
  boards,
  boardColumns,
  cards,
  notepads,
  cardAssignees,
  user,
  notepadTags,
  tags,
  cardSubtasks,
} from '../schema'

export class PostgresBoardRepository implements IBoardRepository {
  constructor(private db: PostgresDb) {}

  async listByProject(projectId: string): Promise<Board[]> {
    return this.db
      .select()
      .from(boards)
      .where(eq(boards.projectId, projectId))
      .orderBy(boards.position)
  }

  async listDeletedByProject(projectId: string): Promise<Board[]> {
    return this.db
      .select()
      .from(boards)
      .where(and(eq(boards.projectId, projectId), isNotNull(boards.deletedAt)))
      .orderBy(desc(boards.deletedAt))
  }

  async findById(id: string): Promise<Board | null> {
    const result = await this.db.select().from(boards).where(eq(boards.id, id)).limit(1)
    return result[0] ?? null
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Board | null> {
    const result = await this.db
      .select()
      .from(boards)
      .where(and(eq(boards.id, id), eq(boards.workspaceId, workspaceId)))
      .limit(1)
    return result[0] ?? null
  }

  async create(data: CreateBoardData): Promise<Board> {
    const result = await this.db.insert(boards).values(data).returning()
    if (!result[0]) throw new Error('Failed to create board')
    return result[0]
  }

  async update(id: string, data: UpdateBoardData): Promise<void> {
    await this.db.update(boards).set(data).where(eq(boards.id, id))
  }

  async softDelete(id: string, deletedAt: number): Promise<void> {
    await this.db.update(boards).set({ deletedAt, updatedAt: deletedAt }).where(eq(boards.id, id))
  }

  async restore(id: string): Promise<void> {
    await this.db.update(boards).set({ deletedAt: null, updatedAt: Date.now() }).where(eq(boards.id, id))
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.delete(boards).where(eq(boards.id, id))
  }

  // Columns
  async listColumns(boardId: string): Promise<BoardColumn[]> {
    return this.db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, boardId))
      .orderBy(boardColumns.position)
  }

  async findColumnById(id: string): Promise<BoardColumn | null> {
    const result = await this.db.select().from(boardColumns).where(eq(boardColumns.id, id)).limit(1)
    return result[0] ?? null
  }

  async findColumnByIdAndWorkspace(columnId: string, workspaceId: string): Promise<BoardColumn | null> {
    const result = await this.db
      .select()
      .from(boardColumns)
      .innerJoin(boards, eq(boardColumns.boardId, boards.id))
      .where(and(eq(boardColumns.id, columnId), eq(boards.workspaceId, workspaceId)))
      .limit(1)
    return result[0]?.board_columns ?? null
  }

  async createColumn(data: CreateColumnData): Promise<BoardColumn> {
    const result = await this.db.insert(boardColumns).values(data).returning()
    if (!result[0]) throw new Error('Failed to create column')
    return result[0]
  }

  async updateColumn(id: string, data: UpdateColumnData): Promise<void> {
    await this.db.update(boardColumns).set(data).where(eq(boardColumns.id, id))
  }

  async moveColumn(id: string, position: string): Promise<void> {
    await this.db.update(boardColumns).set({ position }).where(eq(boardColumns.id, id))
  }

  async deleteColumn(id: string): Promise<void> {
    await this.db.delete(boardColumns).where(eq(boardColumns.id, id))
  }

  async getBoardWithDetails(boardId: string, workspaceId: string): Promise<BoardWithDetails | null> {
    const boardResult = await this.db
      .select()
      .from(boards)
      .where(
        and(
          eq(boards.id, boardId),
          eq(boards.workspaceId, workspaceId),
          isNull(boards.deletedAt),
        ),
      )
      .limit(1)

    const board = boardResult[0]
    if (!board) return null

    const cols = await this.db
      .select()
      .from(boardColumns)
      .where(eq(boardColumns.boardId, boardId))
      .orderBy(boardColumns.position)

    const cardsWithNotepads = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        notepadId: cards.notepadId,
        title: notepads.title,
        position: cards.position,
        priority: cards.priority,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
      })
      .from(cards)
      .innerJoin(notepads, eq(notepads.id, cards.notepadId))
      .where(
        and(
          eq(cards.boardId, boardId),
          isNull(notepads.deletedAt),
        ),
      )
      .orderBy(cards.position)

    const cardIds = cardsWithNotepads.map((c) => c.id)
    const assignees = cardIds.length > 0
      ? await this.db
          .select({
            cardId: cardAssignees.cardId,
            userId: cardAssignees.userId,
            name: user.name,
            image: user.image,
          })
          .from(cardAssignees)
          .innerJoin(user, eq(user.id, cardAssignees.userId))
          .where(inArray(cardAssignees.cardId, cardIds))
      : []

    const assigneesByCard = new Map<string, Array<{ userId: string; name: string; image: string | null }>>()
    for (const a of assignees) {
      const list = assigneesByCard.get(a.cardId) || []
      list.push({ userId: a.userId, name: a.name, image: a.image })
      assigneesByCard.set(a.cardId, list)
    }

    const notepadIds = cardsWithNotepads.map((c) => c.notepadId)
    const cardTags = notepadIds.length > 0
      ? await this.db
          .select({
            notepadId: notepadTags.notepadId,
            tagId: tags.id,
            name: tags.name,
            color: tags.color,
          })
          .from(notepadTags)
          .innerJoin(tags, eq(tags.id, notepadTags.tagId))
          .where(inArray(notepadTags.notepadId, notepadIds))
      : []

    const tagsByNotepad = new Map<string, Array<{ id: string; name: string; color: string | null }>>()
    for (const tag of cardTags) {
      const list = tagsByNotepad.get(tag.notepadId) || []
      list.push({ id: tag.tagId, name: tag.name, color: tag.color })
      tagsByNotepad.set(tag.notepadId, list)
    }

    const subtaskCounts = cardIds.length > 0
      ? await this.db
          .select({
            cardId: cardSubtasks.cardId,
            total: sql<number>`count(*)`,
            completed: sql<number>`coalesce(sum(case when ${cardSubtasks.completed} then 1 else 0 end), 0)`,
          })
          .from(cardSubtasks)
          .where(inArray(cardSubtasks.cardId, cardIds))
          .groupBy(cardSubtasks.cardId)
      : []

    const subtasksByCard = new Map<string, { total: number; completed: number }>()
    for (const row of subtaskCounts) {
      subtasksByCard.set(row.cardId, { total: Number(row.total), completed: Number(row.completed) })
    }

    const cardsByColumn = new Map<string, any[]>()
    for (const card of cardsWithNotepads) {
      const cardAssigneesList = assigneesByCard.get(card.id) || []
      const cardTagsList = tagsByNotepad.get(card.notepadId) || []
      const subtaskProgress = subtasksByCard.get(card.id) || { total: 0, completed: 0 }
      const list = cardsByColumn.get(card.columnId) || []
      list.push({
        id: card.id,
        columnId: card.columnId,
        notepadId: card.notepadId,
        title: card.title,
        position: card.position,
        priority: card.priority as any,
        dueDate: card.dueDate,
        createdAt: card.createdAt,
        assignees: cardAssigneesList,
        tags: cardTagsList,
        totalSubtasks: subtaskProgress.total,
        completedSubtasks: subtaskProgress.completed,
      })
      cardsByColumn.set(card.columnId, list)
    }

    return {
      ...board,
      columns: cols.map((col) => ({
        ...col,
        cards: cardsByColumn.get(col.id) || [],
      })),
    }
  }
}