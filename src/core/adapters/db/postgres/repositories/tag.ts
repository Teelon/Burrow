import type {
  ITagRepository,
  Tag,
  CreateTagData,
  UpdateTagData,
} from '../../../../infrastructure/types';
import { eq, and, sql, inArray } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import { tags, projects } from '../schema';

export class PostgresTagRepository implements ITagRepository {
  constructor(private db: PostgresDb) {}

  async listByProject(projectId: string): Promise<Tag[]> {
    return this.db.select().from(tags).where(eq(tags.projectId, projectId)).orderBy(tags.name);
  }

  async findById(id: string): Promise<Tag | null> {
    const result = await this.db.select().from(tags).where(eq(tags.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Tag | null> {
    const result = await this.db
      .select()
      .from(tags)
      .innerJoin(projects, eq(tags.projectId, projects.id))
      .where(and(eq(tags.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);
    return result[0]?.tags ?? null;
  }

  async create(data: CreateTagData): Promise<Tag> {
    const result = await this.db.insert(tags).values(data).returning();
    if (!result[0]) throw new Error('Failed to create tag');
    return result[0];
  }

  async update(id: string, data: UpdateTagData): Promise<void> {
    await this.db.update(tags).set(data).where(eq(tags.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tags).where(eq(tags.id, id));
  }

  async findByName(projectId: string, name: string): Promise<Tag | null> {
    const result = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.projectId, projectId), eq(tags.name, name)))
      .limit(1);
    return result[0] ?? null;
  }

  async validateByProject(projectId: string, tagIds: string[]): Promise<{ id: string }[]> {
    const result = await this.db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.projectId, projectId), inArray(tags.id, tagIds)));
    return result;
  }

  async findByPattern(
    projectId: string,
    pattern: string,
    limit: number,
  ): Promise<{ id: string; name: string; color: string | null }[]> {
    return this.db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(and(eq(tags.projectId, projectId), sql`${tags.name} ILIKE ${`%${pattern}%`}`))
      .limit(limit);
  }
}
