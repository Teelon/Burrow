import type { DB } from '../client';
import * as t from '../schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type {
  IProjectRepository,
  Project,
  CreateProjectData,
  UpdateProjectData,
} from '../../../../infrastructure/types';

export function createProjectRepository(db: DB): IProjectRepository {
  return {
    async listByWorkspace(workspaceId: string): Promise<Project[]> {
      const rows = await db
        .select()
        .from(t.projects)
        .where(and(eq(t.projects.workspaceId, workspaceId), isNull(t.projects.archivedAt)))
        .orderBy(asc(t.projects.position));
      return rows.map(mapProject);
    },

    async findById(id: string): Promise<Project | null> {
      const [row] = await db.select().from(t.projects).where(eq(t.projects.id, id));
      return row ? mapProject(row) : null;
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Project | null> {
      const [row] = await db
        .select()
        .from(t.projects)
        .where(and(eq(t.projects.id, id), eq(t.projects.workspaceId, workspaceId)));
      return row ? mapProject(row) : null;
    },

    async create(data: CreateProjectData): Promise<Project> {
      await db.insert(t.projects).values(data);
      return {
        id: data.id,
        workspaceId: data.workspaceId,
        name: data.name,
        icon: data.icon ?? null,
        color: data.color ?? null,
        position: data.position,
        archivedAt: null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    },

    async update(id: string, data: UpdateProjectData): Promise<void> {
      await db.update(t.projects).set(data).where(eq(t.projects.id, id));
    },

    async updatePosition(id: string, position: string): Promise<void> {
      await db
        .update(t.projects)
        .set({ position, updatedAt: Date.now() })
        .where(eq(t.projects.id, id));
    },

    async delete(id: string): Promise<void> {
      // Soft delete by archiving
      await db
        .update(t.projects)
        .set({ archivedAt: Date.now(), updatedAt: Date.now() })
        .where(eq(t.projects.id, id));
    },

    async hardDelete(id: string): Promise<void> {
      await db.delete(t.projects).where(eq(t.projects.id, id));
    },
  };
}

function mapProject(row: typeof t.projects.$inferSelect): Project {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    icon: row.icon,
    color: row.color,
    position: row.position,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
