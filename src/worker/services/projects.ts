import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { IStorageAdapter } from '../adapters/storage/types';
import type { DB } from '../db/client';
import * as t from '../db/schema';
import { HttpError } from '../lib/errors';
import { positionAfterLast, positionBetween } from '../lib/ordering';
import { runBatch } from '../lib/batch';

export interface CreateProjectArgs {
  workspaceId: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface UpdateProjectArgs {
  workspaceId: string;
  projectId: string;
  name?: string;
  icon?: string | null;
  color?: string | null;
  archived?: boolean;
}

export interface MoveProjectArgs {
  workspaceId: string;
  projectId: string;
  afterId?: string | null;
}

export interface PermanentDeleteProjectArgs {
  workspaceId: string;
  projectId: string;
  confirmName: string;
  storage?: IStorageAdapter | null;
}

export async function listProjects(db: DB, workspaceId: string) {
  return db
    .select()
    .from(t.projects)
    .where(and(eq(t.projects.workspaceId, workspaceId), isNull(t.projects.archivedAt)))
    .orderBy(asc(t.projects.position));
}

export async function createProject(db: DB, args: CreateProjectArgs) {
  const [last] = await db
    .select({ position: t.projects.position })
    .from(t.projects)
    .where(eq(t.projects.workspaceId, args.workspaceId))
    .orderBy(desc(t.projects.position))
    .limit(1);

  const position = positionAfterLast(last?.position ?? null);
  const id = nanoid();
  const now = Date.now();

  await db.insert(t.projects).values({
    id,
    workspaceId: args.workspaceId,
    name: args.name.trim() || 'Untitled Project',
    icon: args.icon ?? null,
    color: args.color ?? null,
    position,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return { id, position };
}

export async function updateProject(db: DB, args: UpdateProjectArgs) {
  const [project] = await db
    .select()
    .from(t.projects)
    .where(and(eq(t.projects.id, args.projectId), eq(t.projects.workspaceId, args.workspaceId)));

  if (!project) {
    throw new HttpError(404, 'not_found', 'Project not found');
  }

  const updates: Partial<typeof t.projects.$inferInsert> = {
    updatedAt: Date.now(),
  };

  if (args.name !== undefined) updates.name = args.name.trim() || 'Untitled Project';
  if (args.icon !== undefined) updates.icon = args.icon;
  if (args.color !== undefined) updates.color = args.color;
  if (args.archived !== undefined) {
    updates.archivedAt = args.archived ? Date.now() : null;
  }

  await db.update(t.projects).set(updates).where(eq(t.projects.id, args.projectId));
}

export async function moveProject(db: DB, args: MoveProjectArgs) {
  const [project] = await db
    .select()
    .from(t.projects)
    .where(and(eq(t.projects.id, args.projectId), eq(t.projects.workspaceId, args.workspaceId)));

  if (!project) {
    throw new HttpError(404, 'not_found', 'Project not found');
  }

  const allProjects = await db
    .select({ id: t.projects.id, position: t.projects.position })
    .from(t.projects)
    .where(and(eq(t.projects.workspaceId, args.workspaceId), isNull(t.projects.archivedAt)))
    .orderBy(asc(t.projects.position));

  // Filter out the project being moved
  const others = allProjects.filter((p) => p.id !== args.projectId);

  let newPosition: string;
  if (!args.afterId) {
    // Move to first position
    const next = others[0]?.position ?? null;
    newPosition = positionBetween(null, next);
  } else {
    const afterIndex = others.findIndex((p) => p.id === args.afterId);
    if (afterIndex === -1) {
      throw new HttpError(400, 'invalid_after_id', 'afterId not found');
    }
    const prev = others[afterIndex]!.position;
    const next = others[afterIndex + 1]?.position ?? null;
    newPosition = positionBetween(prev, next);
  }

  await db
    .update(t.projects)
    .set({ position: newPosition, updatedAt: Date.now() })
    .where(eq(t.projects.id, args.projectId));

  return { position: newPosition };
}

export async function permanentDeleteProject(db: DB, args: PermanentDeleteProjectArgs) {
  const [project] = await db
    .select()
    .from(t.projects)
    .where(and(eq(t.projects.id, args.projectId), eq(t.projects.workspaceId, args.workspaceId)));

  if (!project) {
    throw new HttpError(404, 'not_found', 'Project not found');
  }

  if (project.name !== args.confirmName) {
    throw new HttpError(400, 'name_mismatch', 'Project confirmation name does not match');
  }

  // Collect notepads in project for FTS and R2 keys
  const notepads = await db
    .select({ id: t.notepads.id, coverKey: t.notepads.coverKey })
    .from(t.notepads)
    .where(eq(t.notepads.projectId, args.projectId));

  const r2Keys: string[] = [];
  for (const np of notepads) {
    if (np.coverKey) r2Keys.push(np.coverKey);
  }

  // Atomic batch to clean up FTS, links, and cascade project deletion
  await runBatch(db, [
    db.run(sql`DELETE FROM notepads_fts WHERE project_id = ${args.projectId}`),
    db.run(sql`
      DELETE FROM notepad_links
      WHERE target_id IN (
        SELECT id FROM notepads WHERE project_id = ${args.projectId}
        UNION
        SELECT id FROM cards WHERE board_id IN (SELECT id FROM boards WHERE project_id = ${args.projectId})
        UNION
        SELECT id FROM boards WHERE project_id = ${args.projectId}
      )
    `),
    db.delete(t.projects).where(eq(t.projects.id, args.projectId)),
  ]);

  // Post-batch best-effort cleanup of R2 files
  if (args.storage && r2Keys.length > 0) {
    try {
      await Promise.allSettled(r2Keys.map((k) => args.storage!.delete(k)));
    } catch (err) {
      console.warn('R2 cleanup error after project deletion', err);
    }
  }
}
