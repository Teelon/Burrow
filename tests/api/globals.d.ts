/**
 * Test-time `env` shape. This is a global script file (no top-level imports)
 * so the declarations merge with @cloudflare/workers-types' Cloudflare.Env.
 * Bindings come from wrangler.jsonc plus TEST_MIGRATIONS, which vitest.config.ts
 * injects so tests can apply migrations without filesystem access.
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    FILES: R2Bucket
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    BOOTSTRAP_TOKEN: string
    /** Migrations read in vitest.config.ts; applied by tests/api/setup.ts. */
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[]
  }
}
