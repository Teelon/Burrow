import type { BatchItem } from 'drizzle-orm/batch';
import type { DB } from '../client';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

type D1BindValue = Parameters<D1PreparedStatement['bind']>[number];

/** Compiled SQL text plus driver-mapped bound params. */
interface CompiledStatement {
  sql: string;
  params: unknown[];
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
    getQuery?: () => CompiledStatement;
    toSQL?: () => CompiledStatement;
  };
  const query = candidate.getQuery?.() ?? candidate.toSQL?.();
  if (!query) {
    throw new Error('runBatch: statement is neither raw SQL nor a drizzle builder');
  }
  return query;
}

/** True when the drizzle `$client` is a D1Database (has native batch()). */
function isD1Client(client: unknown): client is D1Database {
  return (
    typeof client === 'object' &&
    client !== null &&
    typeof (client as { batch?: unknown }).batch === 'function'
  );
}

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
export async function runBatch(db: DB, statements: BatchItem<'sqlite'>[]): Promise<unknown> {
  const [first, ...rest] = statements;
  if (first === undefined) {
    throw new Error('runBatch: refusing to execute an empty statement batch');
  }
  const client = (db as { $client: unknown }).$client;
  if (isD1Client(client)) {
    const batch = [first, ...rest].map((chunk) => {
      const query = compileStatement(chunk);
      return client.prepare(query.sql).bind(...(query.params as D1BindValue[]));
    });
    return client.batch(batch);
  }
  const compiled = [first, ...rest].map(compileStatement);
  const sqlite = client as {
    prepare(sql: string): { run(...params: unknown[]): unknown };
    transaction<T>(fn: () => T): () => T;
  };
  sqlite.transaction(() => {
    for (const query of compiled) {
      sqlite.prepare(query.sql).run(...query.params);
    }
  })();
  return [];
}
