import type { DB } from '../client'
import * as t from '../schema'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { ITagRepository, Tag, CreateTagData, UpdateTagData } from '../../../../infrastructure/types'

export function createTagRepository(db: DB): ITagRepository {
  return {
    async listByProject(projectId: string): Promise<Tag[]> {
      const rows = await db.select().from(t.tags).where(eq(t.tags.projectId, projectId)).orderBy(asc(t.tags.name))
      return rows.map(mapTag)
    },

    async findById(id: string): Promise<Tag | null> {
      const [row] = await db.select().from(t.tags).where(eq(t.tags.id, id))
      return row ? mapTag(row) : null
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Tag | null> {
      const [row] = await db
        .select({ tag: t.tags })
        .from(t.tags)
        .innerJoin(t.projects, eq(t.tags.projectId, t.projects.id))
        .where(and(eq(t.tags.id, id), eq(t.projects.workspaceId, workspaceId)))
      return row ? mapTag(row.tag) : null
    },

    async create(data: CreateTagData): Promise<Tag> {
      await db.insert(t.tags).values(data)
      return {
        id: data.id,
        projectId: data.projectId,
        name: data.name,
        color: data.color ?? null,
      }
    },

    async update(id: string, data: UpdateTagData): Promise<void> {
      await db.update(t.tags).set(data).where(eq(t.tags.id, id))
    },

    async delete(id: string): Promise<void> {
      await db.delete(t.tags).where(eq(t.tags.id, id))
    },

    async findByName(projectId: string, name: string): Promise<Tag | null> {
      const [row] = await db.select().from(t.tags).where(and(eq(t.tags.projectId, projectId), eq(t.tags.name, name)))
      return row ? mapTag(row) : null
    },

    async validateByProject(projectId: string, tagIds: string[]): Promise<{ id: string }[]> {
      if (tagIds.length === 0) return []
      const rows = await db.select({ id: t.tags.id }).from(t.tags).where(and(eq(t.tags.projectId, projectId), inArray(t.tags.id, tagIds)))
      return rows
    },

    async findByPattern(projectId: string, pattern: string, limit: number): Promise<{ id: string; name: string; color: string | null }[]> {
      const searchPattern = `%${pattern}%`
      const rows = await db
        .select({ id: t.tags.id, name: t.tags.name, color: t.tags.color })
        .from(t.tags)
        .where(and(eq(t.tags.projectId, projectId), sql`${t.tags.name} LIKE ${searchPattern}`))
        .orderBy(asc(t.tags.name))
        .limit(limit)
      return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }))
    },
  }
}

function mapTag(row: typeof t.tags.$inferSelect): Tag {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color,
  }
}