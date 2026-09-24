import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'sqlite',
  schema: 'src/worker/db/schema.ts',
  out: 'migrations',
  // FTS5 virtual tables are hand-managed (raw sql) and must never be touched by
  // generated migrations. See PLAN.md section 3.
  tablesFilter: [
    '!notepads_fts',
    '!notepads_fts_data',
    '!notepads_fts_idx',
    '!notepads_fts_content',
    '!notepads_fts_docsize',
    '!notepads_fts_config',
  ],
})
