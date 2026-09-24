import type { BatchItem } from 'drizzle-orm/batch'
import type { DB } from '../db/client'

type D1BindValue = Parameters<D1PreparedStatement['bind']>[number]

/** Compiled SQL text plus driver-mapped bound params. */
interface CompiledStatement {
  sql: string
  params: unknown[]
}

/**
 * Compile any drizzle batch item to SQL text + params.
 *
 * Raw SQL (`db.run(sql`...`)`) exposes `getQuery()`; builders (insert/
 * update/...) expose `toSQL()`. Both produce identical `{ sql, params }`
 * with values already mapped to driver types (booleans become 0/1, etc.).
 */
function compileStatement(chunk: BatchItem<'sqlite'>): CompiledStatement {
  const candidate = chunk as {
    getQuery?: () => CompiledStatement
    toSQL?: () => CompiledStatement
  }
  const query = candidate.getQuery?.() ?? candidate.toSQL?.()
  if (!query) {
    throw new Error('runBatch: statement is neither raw SQL nor a drizzle builder')
  }
  return query
}

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
export async function runBatch(
  db: DB,
  statements: BatchItem<'sqlite'>[],
): Promise<unknown> {
  const [first, ...rest] = statements
  if (first === undefined) {
    throw new Error('runBatch: refusing to execute an empty statement batch')
  }
  const batch = [first, ...rest].map((chunk) => {
    const query = compileStatement(chunk)
    return db.$client.prepare(query.sql).bind(...(query.params as D1BindValue[]))
  })
  return db.$client.batch(batch)
}
