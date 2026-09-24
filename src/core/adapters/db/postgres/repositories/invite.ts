import type {
  IInviteRepository,
  Invite,
  CreateInviteData,
} from '../../../../infrastructure/types'
import { eq, and, isNull } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import { invites } from '../schema'

export class PostgresInviteRepository implements IInviteRepository {
  constructor(private db: PostgresDb) {}

  async listPending(workspaceId: string): Promise<Invite[]> {
    return this.db
      .select()
      .from(invites)
      .where(and(eq(invites.workspaceId, workspaceId), isNull(invites.acceptedAt)))
      .orderBy(invites.createdAt)
  }

  async findByTokenHash(tokenHash: string): Promise<Invite | null> {
    const result = await this.db.select().from(invites).where(eq(invites.tokenHash, tokenHash)).limit(1)
    return result[0] ?? null
  }

  async create(data: CreateInviteData): Promise<Invite> {
    const result = await this.db.insert(invites).values(data).returning()
    if (!result[0]) throw new Error('Failed to create invite')
    return result[0]
  }

  async accept(id: string): Promise<void> {
    await this.db.update(invites).set({ acceptedAt: Date.now() }).where(eq(invites.id, id))
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.db.delete(invites).where(and(eq(invites.id, id), eq(invites.workspaceId, workspaceId)))
  }
}