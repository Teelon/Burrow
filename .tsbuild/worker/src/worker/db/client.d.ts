import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
declare function createD1Db(d1: D1Database): import("drizzle-orm/d1").DrizzleD1Database<typeof schema> & {
    $client: D1Database;
};
export declare function createDb(d1: D1Database): DB;
export declare function createDb(node: NodeDbHandle): NodeDb;
/**
 * The drizzle database handle used by services. `ReturnType` (rather than
 * `DrizzleD1Database<typeof schema>`) keeps the `$client: D1Database`
 * property that `drizzle()` adds — lib/batch.ts needs it to run native
 * D1 batches.
 */
export type DB = ReturnType<typeof createD1Db>;
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
export type NodeDb = BetterSQLite3Database<typeof schema>;
/**
 * Opaque wrapper the Node server stores in `c.env.DB`. A marker object
 * (rather than the raw drizzle instance) keeps `createDb`'s D1-vs-Node
 * detection explicit and avoids probing for driver-specific methods.
 */
export interface NodeDbHandle {
    __nodeDb: NodeDb;
}
export declare function wrapNodeDb(db: NodeDb): NodeDbHandle;
export {};
