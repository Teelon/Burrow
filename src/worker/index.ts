import { Hono } from 'hono'
import type { Env } from './env'
import { httpError, isHttpError } from './lib/errors'

/**
 * NOTE (Hono RPC): route registration returns a NEW type; a plain
 * `const app = new Hono(); app.get(...)` would export a schema-less app type
 * and the typed client (`hc`) would collapse to `unknown`. Always chain.
 */
export const app = new Hono<Env>()
  .get('/api/health', (c) => c.json({ ok: true, now: Date.now() }))
  .onError((err, c) => {
    if (isHttpError(err)) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status)
    }
    console.error('unhandled error', err)
    return httpError(c, 500, 'internal_error', 'Internal server error')
  })
  .notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))

export type AppType = typeof app

export default app
