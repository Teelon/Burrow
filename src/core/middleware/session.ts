import { createMiddleware } from 'hono/factory'
import type { AuthProvider, IMemberRepository } from '../infrastructure/types'

const ROLE_RANK = {
  viewer: 1,
  editor: 2,
  owner: 3,
} as const

type Role = keyof typeof ROLE_RANK

/**
 * Resolves session and member info, attaching userId, workspaceId, and role to context.
 * Uses the auth provider to get the user, then the member repository to resolve workspace/role.
 */
export const createSessionMiddleware = (
  auth: AuthProvider,
  members: IMemberRepository
) =>
  createMiddleware(async (c, next) => {
    try {
      const sessionRes = await auth.getSession(c.req.raw.headers)

      if (sessionRes) {
        // Get workspace and role from member repository
        const member = await members.findByUserIdGlobal(sessionRes.userId)
        if (member) {
          c.set('userId', sessionRes.userId)
          c.set('workspaceId', member.workspaceId)
          c.set('role', member.role)
        }
      }
    } catch (err) {
      console.error('Session retrieval error', err)
    }

    await next()
  })

/**
 * Requires an active session. Returns 401 otherwise.
 */
export const requireSession = createMiddleware(async (c, next) => {
  const userId = c.get('userId')
  if (!userId) {
    return c.json(
      { error: { code: 'unauthorized', message: 'Authentication required' } },
      401,
    )
  }
  await next()
})

/**
 * Requires a minimum role level (viewer < editor < owner).
 * Mutating routes require editor or owner; owner routes require owner. Returns 403 otherwise.
 */
export function requireRole(minRole: Role) {
  return createMiddleware(async (c, next) => {
    const role = c.get('role') as Role | undefined
    if (!role || ROLE_RANK[role] < ROLE_RANK[minRole]) {
      return c.json(
        { error: { code: 'forbidden', message: 'Insufficient permissions' } },
        403,
      )
    }
    await next()
  })
}