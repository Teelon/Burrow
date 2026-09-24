import type { DB } from '../client'
import * as t from '../schema'
import { eq, sql } from 'drizzle-orm'
import type { IWorkspaceRepository, Workspace, CreateWorkspaceData } from '../../../../infrastructure/types'

export function createWorkspaceRepository(db: DB): IWorkspaceRepository {
  return {
    async findById(id: string): Promise<Workspace | null> {
      const [row] = await db.select().from(t.workspaces).where(eq(t.workspaces.id, id))
      return row ? mapWorkspace(row) : null
    },

    async create(data: CreateWorkspaceData): Promise<Workspace> {
      await db.insert(t.workspaces).values(data)
      return mapWorkspace(data)
    },

    async count(): Promise<number> {
      const [row] = await db.select({ count: sql<number>`count(*)` }).from(t.workspaces)
      return row?.count ?? 0
    },
  }
}

function mapWorkspace(row: typeof t.workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
  }
}