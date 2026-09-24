import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { Infrastructure } from '../../../infrastructure/types';
import { schema } from './schema';
import type { ServerConfig } from '../../../../server/config';
/**
 * Postgres database instance type
 */
export type PostgresDb = PostgresJsDatabase<typeof schema>;
/**
 * Create the full PostgreSQL infrastructure bundle for the core app.
 * Opens pg connection, runs migrations, returns Infrastructure with all adapters.
 */
export declare function createPostgresInfrastructure(config: ServerConfig): Promise<Infrastructure>;
/**
 * Close the database connection (for graceful shutdown).
 */
export declare function closePostgresInfrastructure(): Promise<void>;
