import type { DB } from '../client'
import * as t from '../schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { runBatch } from '../lib/batch'
import type { IMemberRepository, Member, CreateMemberData } from '../../../../infrastructure/types'

export function createMemberRepository(db: DB): IMemberRepository {
  return {
    async listByWorkspace(workspaceId: string): Promise<Member[]> {
      const rows = await db
        .select({
          workspaceId: t.members.workspaceId,
          userId: t.members.userId,
          role: t.members.role,
          joinedAt: t.members.joinedAt,
          name: t.user.name,
          email: t.user.email,
          image: t.user.image,
        })
        .from(t.members)
        .leftJoin(t.user, eq(t.user.id, t.members.userId))
        .where(eq(t.members.workspaceId, workspaceId))
      return rows.map(mapMember)
    },

    async findByUserId(workspaceId: string, userId: string): Promise<Member | null> {
      const [row] = await db
        .select({
          workspaceId: t.members.workspaceId,
          userId: t.members.userId,
          role: t.members.role,
          joinedAt: t.members.joinedAt,
        })
        .from(t.members)
        .where(and(eq(t.members.workspaceId, workspaceId), eq(t.members.userId, userId)))
      return row ? mapMember(row) : null
    },

    async findByUserIdGlobal(userId: string): Promise<Member | null> {
      const [row] = await db
        .select({
          workspaceId: t.members.workspaceId,
          userId: t.members.userId,
          role: t.members.role,
          joinedAt: t.members.joinedAt,
        })
        .from(t.members)
        .where(eq(t.members.userId, userId))
      return row ? mapMember(row) : null
    },

    async findByUserIds(workspaceId: string, userIds: string[]): Promise<{ userId: string }[]> {
      if (userIds.length === 0) return []
      const rows = await db
        .select({ userId: t.members.userId })
        .from(t.members)
        .where(and(eq(t.members.workspaceId, workspaceId), inArray(t.members.userId, userIds)))
      return rows
    },

    async findByPattern(workspaceId: string, pattern: string, limit: number): Promise<{ userId: string; name: string; email: string; image: string | null }[]> {
      const searchPattern = `%${pattern}%`
      const rows = await db
        .select({ userId: t.members.userId, name: t.user.name, email: t.user.email, image: t.user.image })
        .from(t.members)
        .innerJoin(t.user, eq(t.user.id, t.members.userId))
        .where(and(eq(t.members.workspaceId, workspaceId), sql`${t.user.name} LIKE ${searchPattern}`))
        .limit(limit)
      return rows
    },

    async updateRole(workspaceId: string, userId: string, role: 'owner' | 'editor' | 'viewer'): Promise<void> {
      await db.update(t.members).set({ role }).where(and(eq(t.members.workspaceId, workspaceId), eq(t.members.userId, userId)))
    },

    async remove(workspaceId: string, userId: string): Promise<void> {
      // Invariant I10: Removing a member deletes that member's card_assignees rows in the same batch
      await runBatch(db, [
        db.run(sql`
          DELETE FROM card_assignees
          WHERE user_id = ${userId}
            AND card_id IN (
              SELECT c.id FROM cards c
              INNER JOIN boards b ON b.id = c.board_id
              WHERE b.workspace_id = ${workspaceId}
            )
        `),
        db.delete(t.members).where(and(eq(t.members.workspaceId, workspaceId), eq(t.members.userId, userId))),
        db.delete(t.session).where(eq(t.session.userId, userId)),
      ])
    },

    async create(data: CreateMemberData): Promise<Member> {
      await db.insert(t.members).values(data)
      return data
    },

    async deleteSessions(userId: string): Promise<void> {
      await db.delete(t.session).where(eq(t.session.userId, userId))
    },

    async listOwners(workspaceId: string): Promise<Member[]> {
      const rows = await db
        .select({
          workspaceId: t.members.workspaceId,
          userId: t.members.userId,
          role: t.members.role,
          joinedAt: t.members.joinedAt,
        })
        .from(t.members)
        .where(and(eq(t.members.workspaceId, workspaceId), eq(t.members.role, 'owner')))
      return rows.map(mapMember)
    },
  }
}

function mapMember(row: {
  workspaceId: string
  userId: string
  role: 'owner' | 'editor' | 'viewer'
  joinedAt: number
  name?: string | null
  email?: string | null
  image?: string | null
}): Member {
  return {
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role,
    joinedAt: row.joinedAt,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    image: row.image ?? null,
  }
}