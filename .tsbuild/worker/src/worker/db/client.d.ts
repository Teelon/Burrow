import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
export declare function createDb(d1: D1Database): import("drizzle-orm/d1").DrizzleD1Database<typeof schema> & {
    $client: D1Database;
};
/**
 * The drizzle database handle used by services. `ReturnType` (rather than
 * `DrizzleD1Database<typeof schema>`) keeps the `$client: D1Database`
 * property that `drizzle()` adds — lib/batch.ts needs it to run native
 * D1 batches.
 */
export type DB = ReturnType<typeof createDb>;
