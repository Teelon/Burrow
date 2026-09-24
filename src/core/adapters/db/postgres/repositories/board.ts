import type {
  IBoardRepository,
  Board,
  CreateBoardData,
  UpdateBoardData,
  BoardColumn,
  CreateColumnData,
  UpdateColumnData,
} from '../../../../infrastructure/types'
import { eq, and } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import { boards, boardColumns } from '../schema'

export class PostgresBoardRepository implements IBoardRepository {
  constructor(private db: PostgresDb) {}

  async listByProject(projectId: string): Promise<Board[]> {
    return this.db
      .select()
      .from(boards)
      .where(eq(boards.projectId, projectId))
      .orderBy(boards.position)
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
}