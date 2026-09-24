import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Env } from '../env'
import { createDb } from '../db/client'
import * as t from '../db/schema'
import { createAuth } from '../auth'
import { hashToken } from '../lib/crypto'
import { createNotepad } from '../services/notepads'
import { requireSession } from '../middleware/session'
import { rateLimiter } from '../middleware/security'
import { runBatch } from '../lib/batch'

export const authRoutes = new Hono<Env>()
  .use(
    '/api/auth/sign-in/*',
    rateLimiter({ max: 20, windowMs: 60_000 }),
  )
  .use(
    '/api/auth/sign-up/*',
    rateLimiter({ max: 20, windowMs: 60_000 }),
  )
  .post('/api/auth/sign-up/email', async (c) => {
    const db = createDb(c.env.DB)
    const auth = createAuth(db, c.env)

    // Clone request to inspect signup parameters
    const bodyText = await c.req.text()
    let body: Record<string, unknown>
    try {
      body = JSON.parse(bodyText)
    } catch {
      return c.json(
        { error: { code: 'invalid_json', message: 'Invalid JSON payload' } },
        400,
      )
    }

    const [wsCountResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(t.workspaces)
    const isFirstWorkspace = (wsCountResult?.count ?? 0) === 0

    let inviteToAccept: { id: string; workspaceId: string; role: 'editor' | 'viewer' } | null = null

    if (isFirstWorkspace) {
      const bootstrapToken = body.bootstrapToken
      if (
        !bootstrapToken ||
        typeof bootstrapToken !== 'string' ||
        bootstrapToken !== c.env.BOOTSTRAP_TOKEN
      ) {
        return c.json(
          {
            error: {
              code: 'invalid_bootstrap_token',
              message: 'Valid bootstrap token required for initial sign-up',
            },
          },
          403,
        )
      }
    } else {
      const inviteToken = body.inviteToken
      if (!inviteToken || typeof inviteToken !== 'string') {
        return c.json(
          {
            error: {
              code: 'invite_required',
              message: 'Invite token is required to register',
            },
          },
          403,
        )
      }

      const tokenHash = await hashToken(inviteToken)
      const now = Date.now()
      const [invite] = await db
        .select()
        .from(t.invites)
        .where(eq(t.invites.tokenHash, tokenHash))

      if (!invite || invite.acceptedAt !== null || invite.expiresAt <= now) {
        return c.json(
          {
            error: {
              code: 'invalid_invite',
              message: 'Invalid or expired invite token',
            },
          },
          403,
        )
      }

      inviteToAccept = {
        id: invite.id,
        workspaceId: invite.workspaceId,
        role: invite.role,
      }
    }

    // Forward sanitized request to Better Auth
    const { bootstrapToken: _b, inviteToken: _i, ...betterAuthBody } = body
    const forwardReq = new Request(c.req.url, {
      method: 'POST',
      headers: c.req.raw.headers,
      body: JSON.stringify(betterAuthBody),
    })

    const authRes = await auth.handler(forwardReq)
    if (!authRes.ok) {
      return authRes
    }

    const authData = (await authRes.clone().json()) as { user?: { id: string } }
    const userId = authData.user?.id
    if (!userId) {
      return authRes
    }

    const now = Date.now()

    if (isFirstWorkspace) {
      const workspaceId = nanoid()
      const projectId = nanoid()

      await runBatch(db, [
        db.insert(t.workspaces).values({
          id: workspaceId,
          name: 'My Workspace',
          createdBy: userId,
          createdAt: now,
        }),
        db.insert(t.members).values({
          workspaceId,
          userId,
          role: 'owner',
          joinedAt: now,
        }),
        db.insert(t.projects).values({
          id: projectId,
          workspaceId,
          name: 'My first project',
          position: 'a0',
          createdAt: now,
          updatedAt: now,
        }),
      ])

      await createNotepad(db, {
        workspaceId,
        projectId,
        title: 'Welcome to Burrow',
        createdBy: userId,
      })
    } else if (inviteToAccept) {
      await runBatch(db, [
        db
          .update(t.invites)
          .set({ acceptedAt: now })
          .where(eq(t.invites.id, inviteToAccept.id)),
        db.insert(t.members).values({
          workspaceId: inviteToAccept.workspaceId,
          userId,
          role: inviteToAccept.role,
          joinedAt: now,
        }),
      ])
    }

    return authRes
  })
  .all('/api/auth/*', (c) => {
    const db = createDb(c.env.DB)
    const auth = createAuth(db, c.env)
    return auth.handler(c.req.raw)
  })
  .get('/api/me', requireSession, async (c) => {
    const db = createDb(c.env.DB)
    const userId = c.get('userId')
    const workspaceId = c.get('workspaceId')
    const role = c.get('role')

    const [user] = await db
      .select({ id: t.user.id, name: t.user.name, email: t.user.email, image: t.user.image })
      .from(t.user)
      .where(eq(t.user.id, userId))

    const [workspace] = await db
      .select({ id: t.workspaces.id, name: t.workspaces.name })
      .from(t.workspaces)
      .where(eq(t.workspaces.id, workspaceId))

    // Last opened project (default to first active project)
    const [project] = await db
      .select({ id: t.projects.id, name: t.projects.name })
      .from(t.projects)
      .where(eq(t.projects.workspaceId, workspaceId))
      .orderBy(t.projects.position)
      .limit(1)

    return c.json({
      user,
      workspace,
      role,
      lastProjectId: project?.id ?? null,
    })
  })
