import type {
  IProjectRepository,
  Project,
  CreateProjectData,
  UpdateProjectData,
} from '../../../../infrastructure/types';
import { eq, and } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import { projects } from '../schema';

export class PostgresProjectRepository implements IProjectRepository {
  constructor(private db: PostgresDb) {}

  async listByWorkspace(workspaceId: string): Promise<Project[]> {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(projects.position);
  }

  async findById(id: string): Promise<Project | null> {
    const result = await this.db.select().from(projects).where(eq(projects.id, id)).limit(1);
    return result[0] ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Project | null> {
    const result = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);
    return result[0] ?? null;
  }

  async create(data: CreateProjectData): Promise<Project> {
    const result = await this.db.insert(projects).values(data).returning();
    if (!result[0]) throw new Error('Failed to create project');
    return result[0];
  }

  async update(id: string, data: UpdateProjectData): Promise<void> {
    await this.db.update(projects).set(data).where(eq(projects.id, id));
  }

  async updatePosition(id: string, position: string): Promise<void> {
    await this.db
      .update(projects)
      .set({ position, updatedAt: Date.now() })
      .where(eq(projects.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(projects)
      .set({ archivedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(projects.id, id));
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.delete(projects).where(eq(projects.id, id));
  }
}
