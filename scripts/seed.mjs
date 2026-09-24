import path from 'node:path'
import { bin, root, run } from './lib.mjs'

/**
 * Seed local D1 database with demo data (two users, projects, nested notepads, board, cards).
 * Usage: pnpm seed:local
 */
const sqlFile = path.join(root, 'scripts', 'seed.sql')

console.log('Seeding local D1 database with demo data...')
const res = run(
  bin('wrangler'),
  ['d1', 'execute', 'burrow', '--local', '--file', sqlFile],
  { capture: false, allowFail: false },
)

if (res.status !== 0) {
  console.error('Seeding failed')
  process.exit(res.status)
}

console.log('Seed data inserted successfully. Verifying invariants...')
const checkRes = run(
  'node',
  [path.join(root, 'scripts', 'check-data.mjs')],
  { capture: false, allowFail: false },
)

if (checkRes.status !== 0) {
  console.error('Invariant check failed after seeding!')
  process.exit(checkRes.status)
}

console.log('seed:local OK — database seeded and all invariants hold.')
