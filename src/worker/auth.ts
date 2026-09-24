import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { DB } from './db/client'
import * as schema from './db/schema'
import type { Env } from './env'

export function createAuth(db: DB, env: Env['Bindings']) {
  const trustedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
  ]
  if (env.BETTER_AUTH_URL) {
    try {
      const urlOrigin = new URL(env.BETTER_AUTH_URL).origin
      if (!trustedOrigins.includes(urlOrigin)) {
        trustedOrigins.push(urlOrigin)
      }
    } catch {
      // ignore
    }
  }

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
  })
}

export type AuthInstance = ReturnType<typeof createAuth>
