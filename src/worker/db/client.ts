import { sql } from 'drizzle-orm'
import type { SQLWrapper } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './schema'

function createD1Db(d1: D1Database) {
  return drizzle(d1, { schema })
}

export function createDb(d1: D1Database): DB
export function createDb(node: NodeDbHandle): NodeDb
export function createDb(client: D1Database | NodeDbHandle): DB | NodeDb {
  if (isNodeDbHandle(client)) {
    return makeLazyNodeDb(client.__nodeDb)
  }
  return createD1Db(client)
}

/**
 * The drizzle database handle used by services. `ReturnType` (rather than
 * `DrizzleD1Database<typeof schema>`) keeps the `$client: D1Database`
 * property that `drizzle()` adds — lib/batch.ts needs it to run native
 * D1 batches.
 */
export type DB = ReturnType<typeof createD1Db>

/**
 * The drizzle handle for the Node.js runtime (better-sqlite3). Services keep
 * their `db: DB` signatures: the query-builder surface (`select`/`insert`/
 * `update`/`delete`/`run`/`all`) is identical, and the Node server reuses the
 * same Hono app by injecting a {@link NodeDbHandle} into `c.env.DB`, so
 * `createDb` returns the Node instance at runtime while call sites still
 * typecheck as `DB`.
 *
 * Type-only import: fully erased at compile time, so the Cloudflare Worker
 * bundle never pulls in `drizzle-orm/better-sqlite3` (whose driver.js
 * statically imports the native `better-sqlite3` binding).
 */
export type NodeDb = BetterSQLite3Database<typeof schema>

/**
 * Opaque wrapper the Node server stores in `c.env.DB`. A marker object
 * (rather than the raw drizzle instance) keeps `createDb`'s D1-vs-Node
 * detection explicit and avoids probing for driver-specific methods.
 */
export interface NodeDbHandle {
  __nodeDb: NodeDb
}

export function wrapNodeDb(db: NodeDb): NodeDbHandle {
  return { __nodeDb: db }
}

function isNodeDbHandle(client: D1Database | NodeDbHandle): client is NodeDbHandle {
  return (
    typeof client === 'object' &&
    client !== null &&
    '__nodeDb' in client
  )
}

type RawAction = 'run' | 'all' | 'get' | 'values'

const RAW_ACTIONS: ReadonlySet<string> = new Set<RawAction>(['run', 'all', 'get', 'values'])

interface SyncDbInternals {
  session: Record<RawAction, (q: SQLWrapper) => unknown>
  dialect: { sqlToQuery: (q: SQLWrapper) => { sql: string; params: unknown[] } }
}

interface LazyRaw {
  getQuery: () => { sql: string; params: unknown[] }
  then: (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>
}

/**
 * Defer a raw statement until awaited, mirroring the async (D1) driver where
 * `db.run()`/`db.all()`/`db.get()`/`db.values()` return a lazy query object
 * instead of executing.
 *
 * This matters because services build `runBatch` arrays out of un-awaited
 * `db.run(sql`...`)` items: on the sync better-sqlite3 driver those would
 * otherwise execute eagerly at array-construction time — outside
 * `runBatch`'s transaction and out of array order (raw items would all run
 * before any builder item). The lazy shape exposes the same `getQuery()`
 * that `runBatch` compiles, so mixed batches stay ordered and atomic on
 * both runtimes. Awaiting the item (as the search adapter does) executes it,
 * exactly like D1.
 */
function lazyRaw(execute: () => unknown, compiled: { sql: string; params: unknown[] }): LazyRaw {
  return {
    getQuery: () => compiled,
    then: (onFulfilled, onRejected) =>
      Promise.resolve()
        .then(execute)
        .then(onFulfilled, onRejected),
  }
}

function makeLazyNodeDb(db: NodeDb): NodeDb {
  const inner = db as unknown as SyncDbInternals
  return new Proxy(db, {
    get(target, prop) {
      if (typeof prop === 'string' && RAW_ACTIONS.has(prop)) {
        const action = prop as RawAction
        return (query: SQLWrapper | string) => {
          const sequel = typeof query === 'string' ? sql.raw(query) : query.getSQL()
          const compiled = inner.dialect.sqlToQuery(sequel)
          return lazyRaw(() => inner.session[action](sequel), compiled)
        }
      }
      const value: unknown = Reflect.get(target, prop, target)
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value
    },
  })
}
