import { serve } from '@hono/node-server'
import { createCoreApp } from '../core/app'
import { loadConfig } from './config'
import { openNodeDb } from './db'
import type { ServerConfig } from './config'

const config = loadConfig()

function isPostgresUrl(url?: string): boolean {
  return typeof url === 'string' && url.startsWith('postgres')
}

async function buildInfrastructure(config: ServerConfig) {
  if (isPostgresUrl(config.DATABASE_URL)) {
    const { createPostgresInfrastructure } = await import('../core/adapters/db/postgres')
    return createPostgresInfrastructure(config)
  }
  const { db } = openNodeDb(config.SQLITE_PATH, `${process.cwd()}/migrations`)
  const { createD1Infrastructure } = await import('../core/adapters/db/d1')
  const { wrapNodeDb } = await import('../worker/db/client')
  const env = {
    DB: wrapNodeDb(db),
    FILES: null,
    LOCAL_STORAGE_PATH: config.LOCAL_STORAGE_PATH,
    BETTER_AUTH_SECRET: config.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: config.BETTER_AUTH_URL,
    BOOTSTRAP_TOKEN: config.BOOTSTRAP_TOKEN,
  } as any
  return createD1Infrastructure(env.DB, env)
}

const infrastructurePromise = buildInfrastructure(config)

const app = createCoreApp(await infrastructurePromise)

const server = serve(
  {
    fetch: (request) => app.fetch(request),
    port: config.PORT,
  },
  (info) => {
    console.log(`burrow node server listening on http://localhost:${info.port}`)
  },
)

let shuttingDown = false
function shutdown(signal: string): void {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`received ${signal}, closing node server`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
