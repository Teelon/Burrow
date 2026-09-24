import type { DB } from '../client';
import * as t from '../schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { IInviteRepository, Invite, CreateInviteData } from '../../../../infrastructure/types';

export function createInviteRepository(db: DB): IInviteRepository {
  return {
    async listPending(workspaceId: string): Promise<Invite[]> {
      const now = Date.now();
      const rows = await db
        .select()
        .from(t.invites)
        .where(
          and(
            eq(t.invites.workspaceId, workspaceId),
            isNull(t.invites.acceptedAt),
            gt(t.invites.expiresAt, now),
          ),
        );
      return rows.map(mapInvite);
    },

    async findByTokenHash(tokenHash: string): Promise<Invite | null> {
      const [row] = await db.select().from(t.invites).where(eq(t.invites.tokenHash, tokenHash));
      return row ? mapInvite(row) : null;
    },

    async create(data: CreateInviteData): Promise<Invite> {
      await db.insert(t.invites).values(data);
      return {
        id: data.id,
        workspaceId: data.workspaceId,
        email: data.email,
        role: data.role,
        tokenHash: data.tokenHash,
        invitedBy: data.invitedBy,
        expiresAt: data.expiresAt,
        acceptedAt: null,
        createdAt: data.createdAt,
      };
    },

    async accept(id: string): Promise<void> {
      const now = Date.now();
      await db.update(t.invites).set({ acceptedAt: now }).where(eq(t.invites.id, id));
    },

    async delete(id: string, workspaceId: string): Promise<void> {
      await db
        .delete(t.invites)
        .where(and(eq(t.invites.id, id), eq(t.invites.workspaceId, workspaceId)));
    },
  };
}

function mapInvite(row: typeof t.invites.$inferSelect): Invite {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    tokenHash: row.tokenHash,
    invitedBy: row.invitedBy,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt ?? null,
    createdAt: row.createdAt,
  };
}
