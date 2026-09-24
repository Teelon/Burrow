import { applyD1Migrations, env } from 'cloudflare:test';

/**
 * Apply all migrations before each test file. `TEST_MIGRATIONS` is read from
 * disk in vitest.config.ts (Node) because the Workers runtime has no fs.
 * applyD1Migrations records progress in d1_migrations, so this is idempotent.
 */
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
