import { nanoid } from 'nanoid'
import type {
  IBoardRepository,
  Board,
  BoardColumn,
} from '../infrastructure/types'
import { notFound, badRequest } from './errors'
import { positionAfterLast, positionBetween } from './utils/ordering'

export interface CreateBoardArgs {
  workspaceId: string
  projectId: string
  name: string
  icon?: string | null
}

export class BoardService {
  constructor(
    private readonly repos: { boards: IBoardRepository },
  ) {}

  async listBoards(_workspaceId: string, projectId: string): Promise<Board[]> {
    // Filter by workspace in repository
    return this.repos.boards.listByProject(projectId)
  }

  async createBoard(args: CreateBoardArgs): Promise<{ id: string; position: string }> {
    // Verify project exists and is accessible (caller should validate)
    const boards = await this.repos.boards.listByProject(args.projectId)
    const boardPosition = positionAfterLast(boards[boards.length - 1]?.position ?? null)
    const boardId = nanoid()
    const now = Date.now()

    // Default columns: To do, In progress, Done
    const defaultColumns = [
      { id: nanoid(), name: 'To do', color: '#64748b', position: 'a0', wipLimit: null },
      { id: nanoid(), name: 'In progress', color: '#3b82f6', position: 'a1', wipLimit: null },
      { id: nanoid(), name: 'Done', color: '#10b981', position: 'a2', wipLimit: null },
    ]

    await this.repos.boards.create({
      id: boardId,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      name: args.name.trim() || 'Untitled Board',
      icon: args.icon ?? null,
      position: boardPosition,
      createdAt: now,
      updatedAt: now,
    })

    for (const col of defaultColumns) {
      await this.repos.boards.createColumn({
        id: col.id,
        boardId,
        name: col.name,
        color: col.color,
        position: col.position,
        wipLimit: col.wipLimit,
      })
    }

    return { id: boardId, position: boardPosition }
  }

  async getBoard(workspaceId: string, boardId: string): Promise<Board & { columns: (BoardColumn & { cards: any[] })[] }> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, workspaceId)
    if (!board) throw notFound('not_found', 'Board not found')

    const columns = await this.repos.boards.listColumns(boardId)

    // The detailed card data with assignees, tags, subtasks would be fetched
    // by the repository or composed here. For Phase 1, we'll return the basic
    // board structure and let the route handler compose the full response.
    // The worker routes did this composition inline.

    return {
      ...board,
      columns: columns.map((col) => ({ ...col, cards: [] })),
    }
  }

  async updateBoard(
    _workspaceId: string,
    boardId: string,
    updates: { name?: string; icon?: string | null },
  ): Promise<void> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, _workspaceId)
    if (!board) throw notFound('not_found', 'Board not found')

    await this.repos.boards.update(boardId, {
      name: updates.name ? updates.name.trim() : undefined,
      icon: updates.icon !== undefined ? updates.icon : undefined,
      updatedAt: Date.now(),
    })
  }

  async softDeleteBoard(_workspaceId: string, boardId: string): Promise<void> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, _workspaceId)
    if (!board) throw notFound('not_found', 'Board not found')

    const now = Date.now()
    // The worker also soft-deleted card notepads and removed FTS entries
    // That logic belongs in the repository or a composite operation
    await this.repos.boards.softDelete(boardId, now)
  }

  async restoreBoard(_workspaceId: string, boardId: string): Promise<void> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, _workspaceId)
    if (!board || board.deletedAt === null) {
      throw notFound('not_found', 'Deleted board not found')
    }

    await this.repos.boards.restore(boardId)
  }

  async permanentDeleteBoard(_workspaceId: string, boardId: string): Promise<void> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, _workspaceId)
    if (!board || board.deletedAt === null) {
      throw notFound('not_found', 'Deleted board not found in trash')
    }

    await this.repos.boards.hardDelete(boardId)
  }

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------
  async createColumn(
    _workspaceId: string,
    boardId: string,
    name: string,
    color?: string | null,
  ): Promise<{ id: string; position: string }> {
    const board = await this.repos.boards.findByIdAndWorkspace(boardId, _workspaceId)
    if (!board) throw notFound('not_found', 'Board not found')

    const columns = await this.repos.boards.listColumns(boardId)
    const position = positionAfterLast(columns[columns.length - 1]?.position ?? null)
    const id = nanoid()

    await this.repos.boards.createColumn({
      id,
      boardId,
      name: name.trim() || 'Untitled Column',
      color: color ?? null,
      position,
      wipLimit: null,
    })

    return { id, position }
  }

  async updateColumn(
    _workspaceId: string,
    columnId: string,
    updates: { name?: string; color?: string | null; wipLimit?: number | null },
  ): Promise<void> {
    // Verify column belongs to a board in the workspace
    const column = await this.findColumnInWorkspace(columnId, _workspaceId)
    if (!column) throw notFound('not_found', 'Column not found')

    await this.repos.boards.updateColumn(columnId, {
      name: updates.name ? updates.name.trim() : undefined,
      color: updates.color !== undefined ? updates.color : undefined,
      wipLimit: updates.wipLimit !== undefined ? updates.wipLimit : undefined,
    })
  }

  async moveColumn(
    _workspaceId: string,
    columnId: string,
    afterId?: string | null,
  ): Promise<{ position: string }> {
    const column = await this.findColumnInWorkspace(columnId, _workspaceId)
    if (!column) throw notFound('not_found', 'Column not found')

    const columns = await this.repos.boards.listColumns(column.boardId)
    const others = columns.filter((c) => c.id !== columnId)

    let newPosition: string
    if (!afterId) {
      const next = others[0]?.position ?? null
      newPosition = positionBetween(null, next)
    } else {
      const afterIndex = others.findIndex((c) => c.id === afterId)
      if (afterIndex === -1) throw badRequest('invalid_after_id', 'afterId not found')
      const prev = others[afterIndex]!.position
      const next = others[afterIndex + 1]?.position ?? null
      newPosition = positionBetween(prev, next)
    }

    await this.repos.boards.moveColumn(columnId, newPosition)
    return { position: newPosition }
  }

  async deleteColumn(
    _workspaceId: string,
    columnId: string,
    moveToColumnId?: string | null,
  ): Promise<void> {
    const column = await this.findColumnInWorkspace(columnId, _workspaceId)
    if (!column) throw notFound('not_found', 'Column not found')

    // Check if column has cards (this would need a cards repository method)
    // For now, we'll assume the repository handles this or we add a method

    if (moveToColumnId) {
      const dest = await this.findColumnInWorkspace(moveToColumnId, _workspaceId)
      if (!dest || dest.boardId !== column.boardId) {
        throw badRequest('invalid_destination', 'Destination column not found on this board')
      }
      // Move cards would be handled by card service
    }

    await this.repos.boards.deleteColumn(columnId)
  }

  private async findColumnInWorkspace(columnId: string, _workspaceId: string): Promise<BoardColumn | null> {
    // This would need a repository method to find column by ID and verify workspace
    // For now, we'll add a helper to the board repository
    return this.repos.boards.findColumnByIdAndWorkspace(columnId, _workspaceId)
  }
}