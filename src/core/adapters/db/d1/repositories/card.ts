import type { DB } from '../client'
import * as t from '../schema'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { runBatch } from '../lib/batch'
import { chunkByParamBudget, chunkInList } from '../lib/chunk'
import type {
  ICardRepository,
  Card,
  CreateCardData,
  UpdateCardData,
  CardSubtask,
  CreateSubtaskData,
  UpdateSubtaskData,
  CardAssignee,
  MyTasksFilters,
  MyTaskItem,
  CardSummary,
  Comment,
  CreateCommentData,
  CardPriority,
} from '../../../../infrastructure/types'

export function createCardRepository(db: DB): ICardRepository {
  return {
    async findById(id: string): Promise<Card | null> {
      const [row] = await db
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
        .where(eq(t.cards.id, id))
      return row ? mapCard(row) : null
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Card | null> {
      const [row] = await db
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
        .where(and(eq(t.cards.id, id), eq(t.notepads.workspaceId, workspaceId), isNull(t.notepads.deletedAt)))
      return row ? mapCard(row) : null
    },

    async create(data: CreateCardData): Promise<Card> {
      await db.insert(t.cards).values(data)
      // CreateCardData doesn't have all Card fields, so we need to fetch the created card
      const [row] = await db
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
        .where(eq(t.cards.id, data.id))
      return mapCard(row!)
    },

    async update(id: string, data: UpdateCardData): Promise<void> {
      await db.update(t.cards).set(data).where(eq(t.cards.id, id))
    },

    async move(id: string, columnId: string, position: string): Promise<void> {
      await db.update(t.cards).set({ columnId, position }).where(eq(t.cards.id, id))
    },

    async softDelete(_id: string, _deletedAt: number): Promise<void> {
      // Cards don't have deletedAt; they use the notepad's deletedAt
      // This is handled by the service calling notepad.softDelete
      throw new Error('Use notepad repository for card soft delete')
    },

    async restore(_id: string): Promise<void> {
      // Cards don't have deletedAt; they use the notepad's deletedAt
      // This is handled by the service calling notepad.restore
      throw new Error('Use notepad repository for card restore')
    },

    async hardDelete(id: string): Promise<void> {
      await db.delete(t.cards).where(eq(t.cards.id, id))
    },

    // Subtasks
    async listSubtasks(cardId: string): Promise<CardSubtask[]> {
      const rows = await db
        .select()
        .from(t.cardSubtasks)
        .where(eq(t.cardSubtasks.cardId, cardId))
        .orderBy(asc(t.cardSubtasks.position))
      return rows.map(mapSubtask)
    },

    async createSubtask(data: CreateSubtaskData): Promise<CardSubtask> {
      await db.insert(t.cardSubtasks).values(data)
      return mapSubtask(data)
    },

    async updateSubtask(id: string, data: UpdateSubtaskData): Promise<void> {
      await db.update(t.cardSubtasks).set(data).where(eq(t.cardSubtasks.id, id))
    },

    async deleteSubtask(id: string): Promise<void> {
      await db.delete(t.cardSubtasks).where(eq(t.cardSubtasks.id, id))
    },

    // Assignees
    async listAssignees(cardId: string): Promise<CardAssignee[]> {
      const rows = await db
        .select({
          cardId: t.cardAssignees.cardId,
          userId: t.cardAssignees.userId,
          name: t.user.name,
          image: t.user.image,
        })
        .from(t.cardAssignees)
        .innerJoin(t.user, eq(t.user.id, t.cardAssignees.userId))
        .where(eq(t.cardAssignees.cardId, cardId))
      return rows.map((r) => ({ cardId: r.cardId, userId: r.userId, name: r.name, image: r.image }))
    },

    async setAssignees(cardId: string, userIds: string[]): Promise<void> {
      const uniqueUserIds = [...new Set(userIds)]
      const statements: BatchItem<'sqlite'>[] = [db.delete(t.cardAssignees).where(eq(t.cardAssignees.cardId, cardId))]
      if (uniqueUserIds.length > 0) {
        for (const chunk of chunkByParamBudget(uniqueUserIds, 2, 0)) {
          statements.push(db.insert(t.cardAssignees).values(chunk.map((userId) => ({ cardId, userId }))))
        }
      }
      await runBatch(db, statements)
    },

    async validateAssignees(workspaceId: string, userIds: string[]): Promise<{ userId: string }[]> {
      if (userIds.length === 0) return []
      const rows = await db
        .select({ userId: t.members.userId })
        .from(t.members)
        .where(and(eq(t.members.workspaceId, workspaceId), inArray(t.members.userId, userIds)))
      return rows
    },

    // Tags
    async listTagIds(notepadId: string): Promise<string[]> {
      const rows = await db.select({ tagId: t.notepadTags.tagId }).from(t.notepadTags).where(eq(t.notepadTags.notepadId, notepadId))
      return rows.map((r) => r.tagId)
    },

    async setTagIds(notepadId: string, tagIds: string[]): Promise<void> {
      const uniqueTagIds = [...new Set(tagIds)]
      const statements: BatchItem<'sqlite'>[] = [db.delete(t.notepadTags).where(eq(t.notepadTags.notepadId, notepadId))]
      if (uniqueTagIds.length > 0) {
        for (const chunk of chunkByParamBudget(uniqueTagIds, 2, 0)) {
          statements.push(db.insert(t.notepadTags).values(chunk.map((tagId) => ({ notepadId, tagId }))))
        }
      }
      await runBatch(db, statements)
    },

    // Comments
    async listComments(cardId: string): Promise<Comment[]> {
      const rows = await db
        .select({
          id: t.cardComments.id,
          cardId: t.cardComments.cardId,
          userId: t.cardComments.userId,
          content: t.cardComments.content,
          createdAt: t.cardComments.createdAt,
          updatedAt: t.cardComments.updatedAt,
          name: t.user.name,
          image: t.user.image,
        })
        .from(t.cardComments)
        .innerJoin(t.user, eq(t.user.id, t.cardComments.userId))
        .where(eq(t.cardComments.cardId, cardId))
        .orderBy(asc(t.cardComments.createdAt))
      return rows.map(mapComment)
    },

    async createComment(data: CreateCommentData): Promise<Comment> {
      await db.insert(t.cardComments).values(data)
      // Fetch the user info for name and image
      const [user] = await db.select({ name: t.user.name, image: t.user.image }).from(t.user).where(eq(t.user.id, data.userId))
      return {
        id: data.id,
        cardId: data.cardId,
        userId: data.userId,
        content: data.content,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        name: user?.name ?? 'Someone',
        image: user?.image ?? null,
      }
    },

    async getComment(id: string, cardId: string): Promise<Comment | null> {
      const [row] = await db
        .select({
          id: t.cardComments.id,
          cardId: t.cardComments.cardId,
          userId: t.cardComments.userId,
          content: t.cardComments.content,
          createdAt: t.cardComments.createdAt,
          updatedAt: t.cardComments.updatedAt,
          name: t.user.name,
          image: t.user.image,
        })
        .from(t.cardComments)
        .innerJoin(t.user, eq(t.user.id, t.cardComments.userId))
        .where(and(eq(t.cardComments.id, id), eq(t.cardComments.cardId, cardId)))
      return row ? mapComment(row) : null
    },

    async deleteComment(id: string): Promise<void> {
      await db.delete(t.cardComments).where(eq(t.cardComments.id, id))
    },

    // Queries
    async listByColumn(columnId: string): Promise<Card[]> {
      const rows = await db
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
        .where(and(eq(t.cards.columnId, columnId), isNull(t.notepads.deletedAt)))
        .orderBy(asc(t.cards.position))
      return rows.map(mapCard)
    },

    async getMyTasks(workspaceId: string, userId: string, filters: MyTasksFilters): Promise<MyTaskItem[]> {
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
      const isCompletedColumn = (columnName: string) => /done|completed|closed|shipped/i.test(columnName)

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
        priority: r.priority as CardPriority | null,
        isCompleted: isCompletedColumn(r.columnName),
        createdAt: r.createdAt,
        boardName: r.boardName,
        columnName: r.columnName,
        projectName: r.projectName,
        projectIcon: r.projectIcon,
        projectColor: r.projectColor,
        tags: tagsByNotepad.get(r.notepadId) || [],
      }))
    },

    async getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]> {
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
        .where(and(inArray(t.cards.id, cappedIds), eq(t.notepads.workspaceId, workspaceId), isNull(t.notepads.deletedAt)))

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
        priority: r.priority as CardPriority | null,
        dueDate: r.dueDate,
        assignees: (assigneesByCard.get(r.id) || []).map((a) => ({ userId: a.userId, name: a.name, image: a.image })),
      }))
    },

    // Search/suggest
    async findByPattern(projectId: string, pattern: string, limit: number): Promise<{ id: string; title: string; boardName: string; priority: CardPriority | null }[]> {
      const searchPattern = `%${pattern}%`
      const rows = await db
        .select({
          id: t.cards.id,
          title: t.notepads.title,
          boardName: t.boards.name,
          priority: t.cards.priority,
        })
        .from(t.cards)
        .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
        .innerJoin(t.boards, eq(t.boards.id, t.cards.boardId))
        .where(and(eq(t.boards.projectId, projectId), isNull(t.notepads.deletedAt), isNull(t.boards.deletedAt), sql`${t.notepads.title} LIKE ${searchPattern}`))
        .orderBy(asc(t.notepads.title))
        .limit(limit)
      return rows.map((r) => ({ id: r.id, title: r.title, boardName: r.boardName, priority: r.priority as CardPriority | null }))
    },
  }
}

interface CardRow {
  id: string
  boardId: string
  columnId: string
  notepadId: string
  position: string
  priority: CardPriority | null
  dueDate: number | null
  createdAt: number
  title: string
  content: string
  version: number
  projectId: string
  workspaceId: string
}

function mapCard(row: CardRow): Card {
  return {
    id: row.id,
    boardId: row.boardId,
    columnId: row.columnId,
    notepadId: row.notepadId,
    position: row.position,
    priority: row.priority,
    dueDate: row.dueDate ?? null,
    createdAt: row.createdAt,
    title: row.title,
    content: row.content,
    version: row.version,
    projectId: row.projectId,
    workspaceId: row.workspaceId,
  } as Card
}

function mapSubtask(row: typeof t.cardSubtasks.$inferSelect): CardSubtask {
  return {
    id: row.id,
    cardId: row.cardId,
    title: row.title,
    completed: row.completed,
    position: row.position,
    createdAt: row.createdAt,
  }
}

function mapComment(row: {
  id: string
  cardId: string
  userId: string
  content: string
  createdAt: number
  updatedAt: number
  name: string
  image: string | null
}): Comment {
  return {
    id: row.id,
    cardId: row.cardId,
    userId: row.userId,
    content: row.content,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    name: row.name,
    image: row.image,
  }
}