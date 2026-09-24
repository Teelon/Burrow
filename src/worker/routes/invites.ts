import { Hono } from 'hono';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import type { Env } from '../env';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import { requireRole, requireSession } from '../middleware/session';
import { zValidator } from '../middleware/validator';
import { hashToken } from '../lib/crypto';
import { HttpError } from '../lib/errors';
import { runBatch } from '../lib/batch';

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']),
});

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const invitesRoutes = new Hono<Env>()
  .post(
    '/api/invites',
    requireSession,
    requireRole('owner'),
    zValidator('json', createInviteSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const workspaceId = c.get('workspaceId');
      const userId = c.get('userId');
      const { email, role } = c.req.valid('json');

      const rawToken = nanoid(32);
      const tokenHash = await hashToken(rawToken);
      const id = nanoid();
      const now = Date.now();
      const expiresAt = now + SEVEN_DAYS_MS;

      await db.insert(t.invites).values({
        id,
        workspaceId,
        email,
        role,
        tokenHash,
        invitedBy: userId,
        expiresAt,
        acceptedAt: null,
        createdAt: now,
      });

      const origin = new URL(c.req.url).origin;
      return c.json({
        id,
        email,
        role,
        token: rawToken,
        expiresAt,
        url: `${origin}/invite/${rawToken}`,
      });
    },
  )
  .get('/api/invites', requireSession, requireRole('owner'), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const now = Date.now();

    const pending = await db
      .select({
        id: t.invites.id,
        email: t.invites.email,
        role: t.invites.role,
        expiresAt: t.invites.expiresAt,
        createdAt: t.invites.createdAt,
      })
      .from(t.invites)
      .where(
        and(
          eq(t.invites.workspaceId, workspaceId),
          isNull(t.invites.acceptedAt),
          gt(t.invites.expiresAt, now),
        ),
      );

    return c.json(pending);
  })
  .get('/api/invites/info/:token', async (c) => {
    const db = createDb(c.env.DB);
    const rawToken = c.req.param('token');
    if (!rawToken) {
      throw new HttpError(400, 'invalid_token', 'Invite token is required');
    }

    const tokenHash = await hashToken(rawToken);
    const now = Date.now();

    const [invite] = await db
      .select({
        id: t.invites.id,
        workspaceId: t.invites.workspaceId,
        email: t.invites.email,
        role: t.invites.role,
        expiresAt: t.invites.expiresAt,
        acceptedAt: t.invites.acceptedAt,
      })
      .from(t.invites)
      .where(eq(t.invites.tokenHash, tokenHash));

    if (!invite) {
      throw new HttpError(404, 'invalid_invite', 'Invalid or expired invite');
    }

    if (invite.acceptedAt !== null) {
      throw new HttpError(400, 'invite_already_accepted', 'This invite has already been accepted');
    }

    if (invite.expiresAt <= now) {
      throw new HttpError(400, 'invite_expired', 'This invite has expired');
    }

    const [ws] = await db
      .select({
        name: t.workspaces.name,
      })
      .from(t.workspaces)
      .where(eq(t.workspaces.id, invite.workspaceId));

    return c.json({
      valid: true,
      token: rawToken,
      email: invite.email,
      role: invite.role,
      workspaceName: ws?.name || 'Burrow Workspace',
      expiresAt: invite.expiresAt,
    });
  })
  .delete('/api/invites/:id', requireSession, requireRole('owner'), async (c) => {
    const db = createDb(c.env.DB);
    const workspaceId = c.get('workspaceId');
    const id = c.req.param('id');

    await db
      .delete(t.invites)
      .where(and(eq(t.invites.id, id), eq(t.invites.workspaceId, workspaceId)));

    return c.json({ ok: true, id });
  })
  .post(
    '/api/invites/accept',
    requireSession,
    zValidator('json', acceptInviteSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const userId = c.get('userId');
      const { token } = c.req.valid('json');

      // Check if user already belongs to a workspace (one workspace per user in v1)
      const [existingMember] = await db
        .select()
        .from(t.members)
        .where(eq(t.members.userId, userId));

      if (existingMember) {
        throw new HttpError(400, 'already_in_workspace', 'You already belong to a workspace');
      }

      const tokenHash = await hashToken(token);
      const now = Date.now();

      const [invite] = await db.select().from(t.invites).where(eq(t.invites.tokenHash, tokenHash));

      if (!invite || invite.acceptedAt !== null || invite.expiresAt <= now) {
        throw new HttpError(400, 'invalid_invite', 'Invalid or expired invite');
      }

      await runBatch(db, [
        db.update(t.invites).set({ acceptedAt: now }).where(eq(t.invites.id, invite.id)),
        db.insert(t.members).values({
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
          joinedAt: now,
        }),
      ]);

      return c.json({
        ok: true,
        workspaceId: invite.workspaceId,
        role: invite.role,
      });
    },
  );
