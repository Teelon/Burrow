import { drizzle } from 'drizzle-orm/d1'
import type { D1Database } from '@cloudflare/workers-types'
import * as schema from './schema'

/**
 * Create a Drizzle database instance from a D1Database binding.
 * This is the D1-specific implementation used by the D1 adapter.
 */
export function createD1Db(d1: D1Database) {
  return drizzle(d1, { schema })
}

/**
 * The Drizzle database handle used by repositories.
 * This type matches the worker's DB type for compatibility.
 */
export type DB = ReturnType<typeof createD1Db>