import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../worker/db/schema'
import type { NodeDb } from '../worker/db/client'

export interface OpenDbResult {
  sqlite: InstanceType<typeof Database>
  db: NodeDb
}

/**
 * Open (creating parent dirs) the better-sqlite3 file, enable WAL +
 * foreign_keys, and apply `migrations/*.sql` in lexical order, tracking
 * applied filenames in `_migrations` so restarts are idempotent.
 *
 * Whole-file `exec()` works because drizzle-kit separates statements with
 * `--> statement-breakpoint` markers, which are plain `--` SQL comments.
 */
export function openNodeDb(sqlitePath: string, migrationsDir: string): OpenDbResult {
  mkdirSync(dirname(sqlitePath), { recursive: true })
  const sqlite = new Database(sqlitePath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  applyMigrations(sqlite, migrationsDir)
  return { sqlite, db: drizzle(sqlite, { schema }) }
}

function applyMigrations(sqlite: InstanceType<typeof Database>, dir: string): void {
  sqlite.exec(
    'CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
  )
  const applied = new Set(
    (sqlite.prepare('SELECT filename FROM _migrations').all() as { filename: string }[]).map(
      (row) => row.filename,
    ),
  )
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
  for (const file of files) {
    if (applied.has(file)) {
      continue
    }
    sqlite.exec(readFileSync(join(dir, file), 'utf8'))
    sqlite
      .prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
      .run(file, Date.now())
  }
}
