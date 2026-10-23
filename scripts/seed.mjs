#!/usr/bin/env node
import path from 'node:path';
import { bin, isRemoteTarget, printTargetBanner, root, run } from './lib.mjs';

/**
 * Seed local D1 database with demo data (two users, projects, nested notepads, board, cards).
 * Usage: pnpm seed (local only)
 */
if (isRemoteTarget()) {
  console.error('\n❌ ERROR: Seeding is only permitted on the local Miniflare database.');
  console.error('To populate production, log in to the web app and use the UI.\n');
  process.exit(1);
}

printTargetBanner('Seed Database', false);

const sqlFile = path.join(root, 'scripts', 'seed.sql');

console.log('Seeding local D1 database with demo data...');
const res = run(bin('wrangler'), ['d1', 'execute', 'burrow', '--local', '--file', sqlFile], {
  capture: false,
  allowFail: false,
});

if (res.status !== 0) {
  console.error('Seeding failed');
  process.exit(res.status);
}

console.log('Seed data inserted successfully. Verifying invariants...');
const checkRes = run('node', [path.join(root, 'scripts', 'check-data.mjs')], {
  capture: false,
  allowFail: false,
});

if (checkRes.status !== 0) {
  console.error('Invariant check failed after seeding!');
  process.exit(checkRes.status);
}

console.log('seed OK — database seeded and all invariants hold.');
