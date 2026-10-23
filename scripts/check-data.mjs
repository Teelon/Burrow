#!/usr/bin/env node
import path from 'node:path';
import {
  bin,
  getWranglerConfigArgs,
  isRemoteTarget,
  parseFirstJson,
  printTargetBanner,
  root,
  run,
} from './lib.mjs';

/**
 * Run scripts/check-invariants.sql (one query per invariant I1..I10) against D1.
 *
 * Targets:
 *   (default)              Local Miniflare D1 database
 *   --remote, --r, -r      Remote Cloudflare D1 database
 */
const isRemote = isRemoteTarget();
printTargetBanner('Check Data Invariants', isRemote);

const sqlFile = path.join(root, 'scripts', 'check-invariants.sql');
const configArgs = isRemote
  ? getWranglerConfigArgs({ required: true, purpose: 'remote data check' })
  : [];

const res = run(
  bin('wrangler'),
  [
    ...configArgs,
    'd1',
    'execute',
    'burrow',
    isRemote ? '--remote' : '--local',
    '--file',
    sqlFile,
    '--json',
  ],
  { capture: true, allowFail: true, quiet: true },
);

if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  console.error('check:data failed to execute SQL');
  process.exit(res.status);
}

const parsed = parseFirstJson(res.stdout);
if (parsed === null) {
  console.error('could not parse d1 execute output:');
  console.error(res.stdout);
  process.exit(1);
}

const resultSets = Array.isArray(parsed) ? parsed : [parsed];
const offenders = [];
let queryIndex = 0;
for (const rs of resultSets) {
  queryIndex++;
  const rows = rs?.results ?? rs?.rows ?? [];
  for (const row of rows) offenders.push(row);
}

if (offenders.length > 0) {
  console.error(`check:data FAILED — ${offenders.length} offending row(s):`);
  for (const row of offenders) console.error(`  ${JSON.stringify(row)}`);
  process.exit(1);
}

console.log(
  `check:data OK — all invariants hold (${queryIndex} queries, ${isRemote ? 'remote Cloudflare' : 'local Miniflare'})`,
);
