import type { IInviteRepository, Invite, CreateInviteData } from '../../../../infrastructure/types';
import { eq, and, isNull, gt } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import { invites } from '../schema';

export class PostgresInviteRepository implements IInviteRepository {
  constructor(private db: PostgresDb) {}

  async listPending(workspaceId: string): Promise<Invite[]> {
    const now = Date.now();
    return this.db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.workspaceId, workspaceId),
          isNull(invites.acceptedAt),
          gt(invites.expiresAt, now),
        ),
      )
      .orderBy(invites.createdAt);
  }

  async findByTokenHash(tokenHash: string): Promise<Invite | null> {
    const result = await this.db
      .select()
      .from(invites)
      .where(eq(invites.tokenHash, tokenHash))
      .limit(1);
    return result[0] ?? null;
  }

  async create(data: CreateInviteData): Promise<Invite> {
    const result = await this.db.insert(invites).values(data).returning();
    if (!result[0]) throw new Error('Failed to create invite');
    return result[0];
  }

  async accept(id: string): Promise<boolean> {
    const res = await this.db
      .update(invites)
      .set({ acceptedAt: Date.now() })
      .where(and(eq(invites.id, id), isNull(invites.acceptedAt)))
      .returning({ id: invites.id });
    return res.length > 0;
  }

  async delete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .delete(invites)
      .where(and(eq(invites.id, id), eq(invites.workspaceId, workspaceId)));
  }
}
