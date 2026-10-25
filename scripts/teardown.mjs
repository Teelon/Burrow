#!/usr/bin/env node
/**
 * Completely tear down Burrow resources.
 *
 * Targets:
 *   (default)              Local cleanup (clears .wrangler local state, dist/ bundles, ephemeral configs)
 *   --remote, --r, -r      Remote Cloudflare teardown (permanently deletes Worker, D1, R2 on Cloudflare)
 *
 * Flags:
 *   --force                Bypass interactive confirmation on remote
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { bin, hasFlag, isRemoteTarget, printTargetBanner, root, run, step } from './lib.mjs';

const isRemote = isRemoteTarget();
const force = hasFlag('--force');

function readWranglerConfig() {
  const configPath = path.join(root, 'wrangler.jsonc');
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cleaned = raw
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

async function main() {
  printTargetBanner('Teardown', isRemote);

  if (!isRemote) {
    step('Cleaning local development state');
    const localConfigPath = path.join(root, 'wrangler.local.jsonc');
    if (fs.existsSync(localConfigPath)) {
      fs.rmSync(localConfigPath, { force: true });
      console.log('  Removed wrangler.local.jsonc');
    }
    const wranglerDir = path.join(root, '.wrangler');
    if (fs.existsSync(wranglerDir)) {
      fs.rmSync(wranglerDir, { recursive: true, force: true });
      console.log('  Removed .wrangler/ local state');
    }
    const distDir = path.join(root, 'dist');
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
      console.log('  Removed dist/ build directory');
    }
    console.log('\n======================================================');
    console.log('✅ Local cleanup complete. Local state reset.');
    console.log('Run `pnpm dev` or `pnpm run setup` to initialize fresh.');
    console.log('To tear down remote Cloudflare production resources, run:');
    console.log('  pnpm run teardown -r\n');
    console.log('======================================================\n');
    return;
  }

  const cfg = readWranglerConfig();
  const bucketName = cfg.r2_buckets?.[0]?.bucket_name || 'burrow-files';

  // --- Remote Cloudflare Teardown ---
  console.log('======================================================');
  console.log('⚠️  DANGER: CLOUDFLARE PRODUCTION RESOURCE TEARDOWN');
  console.log('======================================================');
  console.log('This will PERMANENTLY delete the following remote resources:');
  console.log('  1. Cloudflare Worker: "burrow"');
  console.log('  2. Cloudflare D1 Database: "burrow" (and all data)');
  console.log(`  3. Cloudflare R2 Bucket: "${bucketName}" (and all files)`);
  console.log('======================================================\n');

  if (!force) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      'Type "TEARDOWN" to confirm and permanently delete these resources: ',
    );
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
  step(`Deleting Cloudflare R2 bucket ("${bucketName}")`);
  run(bin('wrangler'), ['r2', 'bucket', 'delete', bucketName], { allowFail: true });

  // 4. Clean up ephemeral wrangler.local.jsonc
  const localConfigPath = path.join(root, 'wrangler.local.jsonc');
  if (fs.existsSync(localConfigPath)) {
    fs.rmSync(localConfigPath, { force: true });
    console.log('  Removed ephemeral wrangler.local.jsonc');
  }

  console.log('\n======================================================');
  console.log('✅ Teardown complete. All remote Burrow resources deleted.');
  console.log('Run `pnpm run setup -r` at any time to provision a fresh deployment.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
