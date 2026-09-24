import type { BatchItem } from 'drizzle-orm/batch';
import type { DB, NodeDb } from '../db/client';
/**
 * Run a batch of statements atomically on either runtime.
 *
 * D1 (`db.$client.batch` exists) takes the original path unchanged: compile
 * via getQuery()/toSQL() and prepare natively, because drizzle 0.45's
 * SQLiteD1Session.batch() crashes with
 * `Cannot read properties of undefined (reading 'bind')` on any statement
 * that carries bound params (raw statements have no `.stmt`). Compiling via
 * getQuery()/toSQL() and preparing natively sidesteps that entirely.
 *
 * Node (better-sqlite3 `$client`, no `batch` method) runs the same compiled
 * statements through `prepare(sql).run(...params)` inside a
 * `better-sqlite3` transaction, which is likewise all-or-nothing.
 *
 * The helper also refuses to send an empty batch: drizzle types batch() as a
 * non-empty tuple because `batch([])` would be a silent no-op, which is never
 * what a caller means (services build arrays that can legitimately be empty —
 * callers must skip the write instead).
 */
export declare function runBatch(db: DB | NodeDb, statements: BatchItem<'sqlite'>[]): Promise<unknown>;
