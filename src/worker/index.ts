import { Hono } from 'hono'
import type { Env } from './env'
import { httpError, isHttpError } from './lib/errors'
import { bodyLimit, securityHeaders } from './middleware/security'
import { sessionMiddleware } from './middleware/session'
import { authRoutes } from './routes/auth'
import { membersRoutes } from './routes/members'
import { invitesRoutes } from './routes/invites'

/**
 * NOTE (Hono RPC): route registration returns a NEW type; a plain
 * `const app = new Hono(); app.get(...)` would export a schema-less app type
 * and the typed client (`hc`) would collapse to `unknown`. Always chain.
 */
export const app = new Hono<Env>()
  .use('*', securityHeaders)
  .use('/api/*', bodyLimit())
  .use('/api/*', sessionMiddleware)
  .get('/api/health', (c) => c.json({ ok: true, now: Date.now() }))
  .route('', authRoutes)
  .route('', membersRoutes)
  .route('', invitesRoutes)
  .onError((err, c) => {
    if (isHttpError(err)) {
      return c.json(
        { error: { code: err.code, message: err.message } },
        err.status,
      )
    }
    console.error('unhandled error', err)
    return httpError(c, 500, 'internal_error', 'Internal server error')
  })
  .notFound((c) =>
    c.json({ error: { code: 'not_found', message: 'Not found' } }, 404),
  )

export type AppType = typeof app

export default app
