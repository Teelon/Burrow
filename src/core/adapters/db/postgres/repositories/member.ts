import type {
  IMemberRepository,
  Member,
  CreateMemberData,
} from '../../../../infrastructure/types'
import { eq, and, inArray, sql } from 'drizzle-orm'
import type { PostgresDb } from '../index'
import { members, user } from '../schema'

export class PostgresMemberRepository implements IMemberRepository {
  constructor(private db: PostgresDb) {}

  async listByWorkspace(workspaceId: string): Promise<Member[]> {
    const rows = await this.db
      .select({
        workspaceId: members.workspaceId,
        userId: members.userId,
        role: members.role,
        joinedAt: members.joinedAt,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(members)
      .leftJoin(user, eq(user.id, members.userId))
      .where(eq(members.workspaceId, workspaceId))
      .orderBy(members.joinedAt)
    return rows.map((r) => ({
      workspaceId: r.workspaceId,
      userId: r.userId,
      role: r.role,
      joinedAt: r.joinedAt,
      name: r.name ?? undefined,
      email: r.email ?? undefined,
      image: r.image ?? null,
    }))
  }

  async findByUserId(workspaceId: string, userId: string): Promise<Member | null> {
    const result = await this.db
      .select({
        workspaceId: members.workspaceId,
        userId: members.userId,
        role: members.role,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
      .limit(1)
    return result[0] ?? null
  }

  async findByUserIdGlobal(userId: string): Promise<Member | null> {
    const result = await this.db
      .select({
        workspaceId: members.workspaceId,
        userId: members.userId,
        role: members.role,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1)
    return result[0] ?? null
  }

  async findByUserIds(workspaceId: string, userIds: string[]): Promise<{ userId: string }[]> {
    if (userIds.length === 0) return []
    const result = await this.db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.workspaceId, workspaceId), inArray(members.userId, userIds)))
    return result
  }

  async findByPattern(
    workspaceId: string,
    pattern: string,
    limit: number
  ): Promise<{ userId: string; name: string; email: string; image: string | null }[]> {
    return this.db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(members)
      .innerJoin(user, eq(members.userId, user.id))
      .where(
        and(
          eq(members.workspaceId, workspaceId),
          sql`(${user.name} ILIKE ${`%${pattern}%`} OR ${user.email} ILIKE ${`%${pattern}%`})`
        )
      )
      .limit(limit)
  }

  async updateRole(workspaceId: string, userId: string, role: 'owner' | 'editor' | 'viewer'): Promise<void> {
    await this.db
      .update(members)
      .set({ role })
      .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
  }

  async remove(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(members)
      .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
  }

  async create(data: CreateMemberData): Promise<Member> {
    const result = await this.db.insert(members).values(data).returning()
    if (!result[0]) throw new Error('Failed to create member')
    return result[0]
  }

  async deleteSessions(_userId: string): Promise<void> {
    // This is handled by BetterAuth, but we provide the interface
    // Actual session deletion would be in auth adapter
  }

  async listOwners(workspaceId: string): Promise<Member[]> {
    return this.db
      .select({
        workspaceId: members.workspaceId,
        userId: members.userId,
        role: members.role,
        joinedAt: members.joinedAt,
      })
      .from(members)
      .where(and(eq(members.workspaceId, workspaceId), eq(members.role, 'owner')))
  }
}