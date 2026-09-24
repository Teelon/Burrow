import type { DB } from '../client'
import * as t from '../schema'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type {
  IBoardRepository,
  Board,
  BoardColumn,
  CreateBoardData,
  UpdateBoardData,
  CreateColumnData,
  UpdateColumnData,
} from '../../../../infrastructure/types'

export function createBoardRepository(db: DB): IBoardRepository {
  return {
    async listByProject(projectId: string): Promise<Board[]> {
      const rows = await db
        .select()
        .from(t.boards)
        .where(and(eq(t.boards.projectId, projectId), isNull(t.boards.deletedAt)))
        .orderBy(asc(t.boards.position))
      return rows.map(mapBoard)
    },

    async findById(id: string): Promise<Board | null> {
      const [row] = await db.select().from(t.boards).where(eq(t.boards.id, id))
      return row ? mapBoard(row) : null
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Board | null> {
      const [row] = await db
        .select()
        .from(t.boards)
        .where(and(eq(t.boards.id, id), eq(t.boards.workspaceId, workspaceId), isNull(t.boards.deletedAt)))
      return row ? mapBoard(row) : null
    },

    async create(data: CreateBoardData): Promise<Board> {
      await db.insert(t.boards).values(data)
      return {
        id: data.id,
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        name: data.name,
        icon: data.icon ?? null,
        position: data.position,
        deletedAt: null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }
    },

    async update(id: string, data: UpdateBoardData): Promise<void> {
      await db.update(t.boards).set(data).where(eq(t.boards.id, id))
    },

    async softDelete(id: string, deletedAt: number): Promise<void> {
      await db.update(t.boards).set({ deletedAt, updatedAt: deletedAt }).where(eq(t.boards.id, id))
    },

    async restore(id: string): Promise<void> {
      await db.update(t.boards).set({ deletedAt: null, updatedAt: Date.now() }).where(eq(t.boards.id, id))
    },

    async hardDelete(id: string): Promise<void> {
      await db.delete(t.boards).where(eq(t.boards.id, id))
    },

    // Columns
    async listColumns(boardId: string): Promise<BoardColumn[]> {
      const rows = await db
        .select()
        .from(t.boardColumns)
        .where(eq(t.boardColumns.boardId, boardId))
        .orderBy(asc(t.boardColumns.position))
      return rows.map(mapColumn)
    },

    async findColumnByIdAndWorkspace(columnId: string, workspaceId: string): Promise<BoardColumn | null> {
      const [row] = await db
        .select({ column: t.boardColumns })
        .from(t.boardColumns)
        .innerJoin(t.boards, eq(t.boards.id, t.boardColumns.boardId))
        .where(and(eq(t.boardColumns.id, columnId), eq(t.boards.workspaceId, workspaceId), isNull(t.boards.deletedAt)))
      return row ? mapColumn(row.column) : null
    },

    async createColumn(data: CreateColumnData): Promise<BoardColumn> {
      await db.insert(t.boardColumns).values(data)
      return {
        id: data.id,
        boardId: data.boardId,
        name: data.name,
        color: data.color ?? null,
        position: data.position,
        wipLimit: data.wipLimit ?? null,
      }
    },

    async updateColumn(id: string, data: UpdateColumnData): Promise<void> {
      await db.update(t.boardColumns).set(data).where(eq(t.boardColumns.id, id))
    },

    async moveColumn(id: string, position: string): Promise<void> {
      await db.update(t.boardColumns).set({ position }).where(eq(t.boardColumns.id, id))
    },

    async deleteColumn(id: string): Promise<void> {
      await db.delete(t.boardColumns).where(eq(t.boardColumns.id, id))
    },

    // Trash
    async listDeletedByProject(projectId: string): Promise<Board[]> {
      const rows = await db
        .select()
        .from(t.boards)
        .where(and(eq(t.boards.projectId, projectId), sql`${t.boards.deletedAt} IS NOT NULL`))
        .orderBy(desc(t.boards.deletedAt))
      return rows.map(mapBoard)
    },
  }
}

function mapBoard(row: typeof t.boards.$inferSelect): Board {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    name: row.name,
    icon: row.icon,
    position: row.position,
    deletedAt: row.deletedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapColumn(row: typeof t.boardColumns.$inferSelect): BoardColumn {
  return {
    id: row.id,
    boardId: row.boardId,
    name: row.name,
    color: row.color,
    position: row.position,
    wipLimit: row.wipLimit ?? null,
  }
}