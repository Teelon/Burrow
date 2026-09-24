import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Infrastructure } from '../../../infrastructure/types'
import { schema } from './schema'
import type { ServerConfig } from '../../../../server/config'
import { PostgresWorkspaceRepository } from './repositories/workspace'
import { PostgresProjectRepository } from './repositories/project'
import { PostgresBoardRepository } from './repositories/board'
import { PostgresCardRepository } from './repositories/card'
import { PostgresNotepadRepository } from './repositories/notepad'
import { PostgresTagRepository } from './repositories/tag'
import { PostgresNotificationRepository } from './repositories/notification'
import { PostgresMemberRepository } from './repositories/member'
import { PostgresInviteRepository } from './repositories/invite'
import { PostgresSearchAdapter } from './search'
import { PostgresLockAdapter } from './lock'
import { createPostgresAuthProvider } from './auth'

/**
 * Postgres database instance type
 */
export type PostgresDb = PostgresJsDatabase<typeof schema>

/**
 * Create the full PostgreSQL infrastructure bundle for the core app.
 * Opens pg connection, runs migrations, returns Infrastructure with all adapters.
 */
export async function createPostgresInfrastructure(config: ServerConfig): Promise<Infrastructure> {
  // Determine if we're using postgres or SQLite (dev fallback)
  const isPostgres = config.DATABASE_URL?.startsWith('postgres://') || config.DATABASE_URL?.startsWith('postgresql://')

  let db: PostgresDb
  let sqlClient: ReturnType<typeof postgres> | null = null

  if (isPostgres && config.DATABASE_URL) {
    // PostgreSQL connection
    sqlClient = postgres(config.DATABASE_URL, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    })
    db = drizzle(sqlClient, { schema })
    await applyMigrations(sqlClient, join(process.cwd(), 'migrations'))
  } else {
    // SQLite fallback for development - use dynamic import to avoid tsconfig issues
    const { openNodeDb } = await import('../../../../server/db')
    const sqlitePath = config.SQLITE_PATH ?? './data/burrow.db'
    const { db: sqliteDb } = openNodeDb(sqlitePath, join(process.cwd(), 'migrations'))
    db = sqliteDb as unknown as PostgresDb
  }

  // Create repositories
  const repositories = {
    workspaces: new PostgresWorkspaceRepository(db),
    projects: new PostgresProjectRepository(db),
    boards: new PostgresBoardRepository(db),
    cards: new PostgresCardRepository(db),
    notepads: new PostgresNotepadRepository(db),
    tags: new PostgresTagRepository(db),
    notifications: new PostgresNotificationRepository(db),
    members: new PostgresMemberRepository(db),
    invites: new PostgresInviteRepository(db),
  }

  // Create storage adapter (local for now, can be extended to S3) - use dynamic import
  const { LocalStorageAdapter } = await import('../../../../worker/adapters/storage/local')
  const storage = new LocalStorageAdapter(config.LOCAL_STORAGE_PATH ?? './data/uploads')

  // Create search adapter
  const search = new PostgresSearchAdapter(db)

  // Create lock adapter
  const locks = new PostgresLockAdapter(db)

  // Create auth provider
  const auth = createPostgresAuthProvider(
    db,
    config.BETTER_AUTH_SECRET ?? 'local-dev-secret-change-me',
    config.BETTER_AUTH_URL ?? 'http://localhost:8788'
  )

  return {
    repositories,
    storage,
    search,
    locks,
    auth,
    bootstrapToken: config.BOOTSTRAP_TOKEN,
  }
}

/**
 * Apply SQL migrations to PostgreSQL.
 * Creates _migrations tracking table and applies migrations/*.sql in order.
 * Note: The existing SQLite migrations use SQLite syntax. For production,
 * you should create PostgreSQL-specific migrations. For now, we apply them
 * as-is which may work for compatible syntax.
 */
async function applyMigrations(
  sql: ReturnType<typeof postgres>,
  migrationsDir: string
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at BIGINT NOT NULL
    )
  `

  const applied = new Set(
    (await sql`SELECT filename FROM _migrations`).map((row: any) => row.filename)
  )

  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) {
      continue
    }
    const content = readFileSync(join(migrationsDir, file), 'utf8')
    // Skip FTS migration (notepads_fts virtual table) - not compatible with Postgres
    if (file === '0001_fts.sql') {
      // Create the search_vector column and GIN index instead
      await sql`
        ALTER TABLE notepads ADD COLUMN IF NOT EXISTS plain_text TEXT;
        ALTER TABLE notepads ADD COLUMN IF NOT EXISTS search_vector tsvector
          GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || coalesce(plain_text, ''))) STORED;
        CREATE INDEX IF NOT EXISTS notepads_fts_idx ON notepads USING GIN (search_vector);
      `
    } else {
      // Execute the migration (may need pg-specific adjustments)
      await sql.unsafe(content)
    }
    await sql`INSERT INTO _migrations (filename, applied_at) VALUES (${file}, ${Date.now()})`
  }
}

/**
 * Close the database connection (for graceful shutdown).
 */
export async function closePostgresInfrastructure(): Promise<void> {
  // The sql client is closed by the caller if needed
}