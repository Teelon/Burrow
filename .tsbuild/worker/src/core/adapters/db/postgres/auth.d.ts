import type { AuthProvider } from '../../../infrastructure/types';
import type { PostgresDb } from './index';
/**
 * Creates a BetterAuth instance wrapped as AuthProvider for the core app.
 * Uses the PostgreSQL drizzle adapter.
 */
export declare function createPostgresAuthProvider(db: PostgresDb, secret: string, url: string): AuthProvider;
