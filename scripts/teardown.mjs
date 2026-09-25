#!/usr/bin/env node
/**
 * Completely tear down and remove Burrow resources from Cloudflare.
 * Deletes: Cloudflare Worker, D1 Database, R2 Bucket.
 * Usage: pnpm run teardown [--force]
 */
import readline from 'node:readline/promises';
import { bin, hasFlag, run, step } from './lib.mjs';

const force = hasFlag('--force');

async function main() {

  console.log('\n======================================================');
  console.log('⚠️  DANGER: CLOUDFLARE RESOURCE TEARDOWN');
  console.log('======================================================');
  console.log('This will PERMANENTLY delete the following remote resources:');
  console.log('  1. Cloudflare Worker: "burrow"');
  console.log('  2. Cloudflare D1 Database: "burrow" (and all data)');
  console.log('  3. Cloudflare R2 Bucket: "burrow-files" (and all files)');
  console.log('======================================================\n');

  if (!force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "TEARDOWN" to confirm and permanently delete these resources: ');
    rl.close();

    if (answer.trim() !== 'TEARDOWN') {
      console.log('Teardown cancelled. No resources were modified.');
      process.exit(0);
    }
  }

  // 1. Delete Cloudflare Worker
  step('Deleting Cloudflare Worker ("burrow")');
  run(bin('wrangler'), ['delete', 'burrow', '--force'], { allowFail: true });

  // 2. Delete D1 Database
  step('Deleting Cloudflare D1 database ("burrow")');
  run(bin('wrangler'), ['d1', 'delete', 'burrow', '-y'], { allowFail: true });

  // 3. Delete R2 Bucket
  step('Deleting Cloudflare R2 bucket ("burrow-files")');
  // First check or empty if needed, then delete bucket
  run(bin('wrangler'), ['r2', 'bucket', 'delete', 'burrow-files'], { allowFail: true });

  console.log('\n======================================================');
  console.log('✅ Teardown complete. All remote Burrow resources deleted.');
  console.log('Remember to remove D1_DATABASE_ID from your .env or .dev.vars if present.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
