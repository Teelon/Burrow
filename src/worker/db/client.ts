import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './schema'

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

/**
 * The drizzle database handle used by services. `ReturnType` (rather than
 * `DrizzleD1Database<typeof schema>`) keeps the `$client: D1Database`
 * property that `drizzle()` adds — lib/batch.ts needs it to run native
 * D1 batches.
 */
export type DB = ReturnType<typeof createDb>
