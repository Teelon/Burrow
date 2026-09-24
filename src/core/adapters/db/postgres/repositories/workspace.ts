import type {
  IWorkspaceRepository,
  Workspace,
  CreateWorkspaceData,
} from '../../../../infrastructure/types'
import { eq, sql } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import { workspaces } from '../schema'

export class PostgresWorkspaceRepository implements IWorkspaceRepository {
  constructor(private db: PostgresDb) {}

  async findById(id: string): Promise<Workspace | null> {
    const result = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1)
    return result[0] ?? null
  }

  async create(data: CreateWorkspaceData): Promise<Workspace> {
    const result = await this.db.insert(workspaces).values(data).returning()
    if (!result[0]) throw new Error('Failed to create workspace')
    return result[0]
  }

  async count(): Promise<number> {
    const result = await this.db.select({ count: sql<number>`count(*)` }).from(workspaces)
    return result[0]?.count ?? 0
  }
}