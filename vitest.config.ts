import fs from 'node:fs'
import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

// Miniflare validates the assets directory from wrangler.jsonc at startup;
// create a placeholder so `pnpm check` works before the first `pnpm build`.
const assetsDir = path.resolve('dist/web')
fs.mkdirSync(assetsDir, { recursive: true })
const indexPath = path.join(assetsDir, 'index.html')
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath, '<!doctype html><title>burrow</title>')
}

// Migrations are read here (Node has filesystem access; the Workers runtime
// does not) and handed to tests/api/setup.ts as a binding for applyD1Migrations.
const TEST_MIGRATIONS = await readD1Migrations('./migrations')

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS } },
    }),
  ],
  test: {
    include: ['tests/api/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    setupFiles: ['./tests/api/setup.ts'],
  },
})
