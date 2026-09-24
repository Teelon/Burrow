import Database from 'better-sqlite3';
import type { NodeDb } from '../worker/db/client';
export interface OpenDbResult {
    sqlite: InstanceType<typeof Database>;
    db: NodeDb;
}
/**
 * Open (creating parent dirs) the better-sqlite3 file, enable WAL +
 * foreign_keys, and apply `migrations/*.sql` in lexical order, tracking
 * applied filenames in `_migrations` so restarts are idempotent.
 *
 * Whole-file `exec()` works because drizzle-kit separates statements with
 * `--> statement-breakpoint` markers, which are plain `--` SQL comments.
 */
export declare function openNodeDb(sqlitePath: string, migrationsDir: string): OpenDbResult;
