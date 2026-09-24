import { createCoreApp } from '../core/app'
import { createD1Infrastructure } from '../core/adapters/db/d1'
import { createDb } from './db/client'
import type { Env } from './env'
import type { Hono } from 'hono'
import type { ExecutionContext } from 'hono'

/**
 * Type for Cloudflare Workers fetch handler with environment bindings.
 */
type ExportedHandler<Env> = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>
}

/**
 * Create the Hono app for a given Worker environment.
 * Used by tests and the production fetch handler.
 */
export function createWorkerApp(env: Env['Bindings']): Hono<any, any, any> {
  const infra = createD1Infrastructure(createDb(env.DB), {
    FILES: env.FILES,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BOOTSTRAP_TOKEN: env.BOOTSTRAP_TOKEN,
  })
  return createCoreApp(infra)
}

/**
 * Worker entrypoint - creates the app with D1 infrastructure from Cloudflare bindings.
 * The infrastructure is created per-request since bindings come from the fetch handler.
 */
export default {
  async fetch(request: Request, env: Env['Bindings'], ctx: ExecutionContext): Promise<Response> {
    const app = createWorkerApp(env)
    return app.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env['Bindings']>

// Re-export AppType for Hono RPC clients (web frontend)
export type { AppType } from './types-app'
