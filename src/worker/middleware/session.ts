import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import type { Env } from '../env';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import { createAuth } from '../auth';

const ROLE_RANK: Record<'viewer' | 'editor' | 'owner', number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Resolves session and member info, attaching userId, workspaceId, and role to context.
 */
export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const db = createDb(c.env.DB);
  const auth = createAuth(db, c.env);

  try {
    const sessionRes = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (sessionRes && sessionRes.user) {
      const [member] = await db
        .select()
        .from(t.members)
        .where(eq(t.members.userId, sessionRes.user.id));

      if (member) {
        c.set('userId', sessionRes.user.id);
        c.set('workspaceId', member.workspaceId);
        c.set('role', member.role);
      }
    }
  } catch (err) {
    console.error('Session retrieval error', err);
  }

  await next();
});

/**
 * Requires an active session. Returns 401 otherwise.
 */
export const requireSession = createMiddleware<Env>(async (c, next) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: { code: 'unauthorized', message: 'Authentication required' } }, 401);
  }
  await next();
});

/**
 * Requires a minimum role level (viewer < editor < owner).
 * Mutating routes require editor or owner; owner routes require owner. Returns 403 otherwise.
 */
export function requireRole(minRole: 'viewer' | 'editor' | 'owner') {
  return createMiddleware<Env>(async (c, next) => {
    const role = c.get('role');
    if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
      return c.json({ error: { code: 'forbidden', message: 'Insufficient permissions' } }, 403);
    }
    await next();
  });
}
