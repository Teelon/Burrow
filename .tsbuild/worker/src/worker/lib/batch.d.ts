import type { BatchItem } from 'drizzle-orm/batch';
import type { DB } from '../db/client';
/**
 * Run a batch of statements as one atomic D1 batch.
 *
 * D1's batch() commits everything or nothing, which the service layer relies
 * on for save/createCard atomicity (content + FTS + links + notifications).
 *
 * This goes through the native `db.$client.batch()` instead of drizzle's
 * `db.batch()`: drizzle 0.45's SQLiteD1Session.batch() crashes with
 * `Cannot read properties of undefined (reading 'bind')` on any statement
 * that carries bound params (raw statements have no `.stmt`). Compiling via
 * getQuery()/toSQL() and preparing natively sidesteps that entirely.
 *
 * The helper also refuses to send an empty batch: drizzle types batch() as a
 * non-empty tuple because `batch([])` would be a silent no-op, which is never
 * what a caller means (services build arrays that can legitimately be empty —
 * callers must skip the write instead).
 */
export declare function runBatch(db: DB, statements: BatchItem<'sqlite'>[]): Promise<unknown>;
