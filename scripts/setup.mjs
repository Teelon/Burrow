#!/usr/bin/env node
/**
 * First-time provision + deploy. Idempotent. Run with `pnpm run setup`.
 *
 * Flags:
 *   --dry-run              print every command without running it
 *   --domain <domain>      attach a custom domain (must be on Cloudflare DNS in this account)
 *   --name <worker-name>   deploy under a different worker name
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {
  argValue,
  bin,
  hasFlag,
  root,
  run,
  smoke,
  step,
  parseFirstJson,
  loadEnv,
  getWranglerConfigArgs,
} from './lib.mjs';

const dryRun = hasFlag('--dry-run');
const domain = argValue('--domain');
const workerName = argValue('--name');
const WRANGLER_ARGS = workerName ? ['--name', workerName] : [];

async function main() {
  step('Preflight');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    console.error(`Node 20+ required, found ${process.version}`);
    process.exit(1);
  }
  console.log(`node ${process.version}, dry-run: ${dryRun}`);
  loadEnv();
  const existingD1Id = process.env.D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (existingD1Id && !dryRun) {
    console.error('\n❌ ERROR: D1_DATABASE_ID is already set in your .env or .dev.vars file:');
    console.error(`   ${existingD1Id}\n`);
    console.error('`pnpm run setup` is for fresh first-time provisioning.');
    console.error('If you tore down your old resources or want a clean setup:');
    console.error('  1. Clear or comment out D1_DATABASE_ID in your .dev.vars or .env file (leave it blank: D1_DATABASE_ID=).');
    console.error('  2. Re-run `pnpm run setup` so Cloudflare provisions a fresh database.\n');
    process.exit(1);
  }
  run('pnpm', ['install'], { dryRun });

  step('Cloudflare login');
  const whoami = run(bin('wrangler'), ['whoami', '--json'], {
    dryRun,
    capture: true,
    allowFail: true,
    quiet: true,
  });
  if (!dryRun && whoami.status !== 0) {
    console.log('not logged in — running `wrangler login` (opens your browser)');
    run(bin('wrangler'), ['login'], { dryRun });
  } else {
    console.log('wrangler: logged in');
  }

  // Multiple accounts and no explicit choice? Ask which one to use.
  if (!process.env.CLOUDFLARE_ACCOUNT_ID && !dryRun) {
    const info = parseFirstJson(whoami.stdout ?? '');
    const accounts = collectAccounts(info);
    if (accounts.length > 1) {
      console.log('Multiple Cloudflare accounts found:');
      accounts.forEach((a, i) => console.log(`  [${i}] ${a.name ?? '(no name)'}  ${a.id}`));
      const rl = await readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question('Which account id should be used: ');
      rl.close();
      const chosen = accounts.find((a) => a.id === answer.trim()) ?? accounts[Number(answer)];
      if (!chosen) {
        console.error('no matching account selected');
        process.exit(1);
      }
      process.env.CLOUDFLARE_ACCOUNT_ID = chosen.id;
      console.log(`using account ${chosen.id}`);
    }
  }

  step('Typecheck + build');
  run(bin('typescript', 'tsc'), ['-b'], { dryRun });
  run(bin('vite'), ['build'], { dryRun });

  step('Deploy (auto-provisions D1 + R2 on first deploy)');
  const initialConfigArgs = getWranglerConfigArgs();
  const deployArgs = [...initialConfigArgs, 'deploy', ...WRANGLER_ARGS];
  if (domain) deployArgs.push('--domains', domain);
  const deploy = run(bin('wrangler'), deployArgs, { dryRun, capture: true });
  const url = domain
    ? `https://${domain}`
    : (deploy.stdout.match(/https:\/\/[^\s]*workers\.dev[^\s]*/)?.[0] ?? null);
  if (!dryRun && !url) {
    console.error('could not determine the deployed URL from wrangler output');
    process.exit(1);
  }
  const origin = url ?? 'https://<deployed-url>';
  console.log(`deployed: ${origin}`);

  step('Ensure D1 database id is configured');
  const d1Id = ensureDatabaseId(dryRun);
  const configArgs = getWranglerConfigArgs(d1Id);

  step('Apply migrations to remote D1');
  run(bin('wrangler'), [...configArgs, 'd1', 'migrations', 'apply', 'burrow', '--remote'], {
    dryRun,
    // skip the interactive confirmation; migrations are expand-only (rule 13)
    env: { CI: '1' },
  });

  step('Upload secrets (skip existing)');
  const originForAuth = domain ? `https://${domain}` : origin;
  const generated = {};
  if (!dryRun) {
    const existing = new Set(
      (
        parseFirstJson(
          run(bin('wrangler'), ['secret', 'list', '--format', 'json'], {
            capture: true,
            allowFail: true,
            quiet: true,
          }).stdout ?? '[]',
        ) ?? []
      ).map((s) => s.name),
    );
    if (!existing.has('BETTER_AUTH_SECRET')) {
      generated.BETTER_AUTH_SECRET = crypto.randomBytes(32).toString('base64url');
    }
    if (!existing.has('BOOTSTRAP_TOKEN')) {
      generated.BOOTSTRAP_TOKEN =
        process.env.BOOTSTRAP_TOKEN || crypto.randomBytes(16).toString('hex');
    }
    if (!existing.has('BETTER_AUTH_URL')) {
      generated.BETTER_AUTH_URL = originForAuth;
    }
    if (Object.keys(generated).length > 0) {
      const tmp = path.join(root, '.secrets.tmp.json');
      fs.writeFileSync(tmp, JSON.stringify(generated, null, 2));
      try {
        run(bin('wrangler'), ['secret', 'bulk', tmp], { dryRun });
      } finally {
        fs.rmSync(tmp, { force: true });
      }
    } else {
      console.log('  all secrets already set — nothing to do');
    }
  } else {
    run(bin('wrangler'), ['secret', 'bulk', '.secrets.tmp.json'], { dryRun });
  }

  if (!dryRun) {
    // Only used in-memory during setup run
    process.env.BOOTSTRAP_TOKEN = generated.BOOTSTRAP_TOKEN || process.env.BOOTSTRAP_TOKEN;
  }

  step('Smoke test');
  if (dryRun) {
    console.log(`  [dry-run] GET ${origin}/api/health`);
  } else {
    const ok = await smoke(origin);
    if (!ok) process.exit(1);
  }

  console.log('\n======================================================');
  console.log('Setup complete!');
  console.log(`  Production URL: ${origin}`);
  if (d1Id) {
    console.log(`  D1_DATABASE_ID: ${d1Id}`);
  }
  if (generated.BOOTSTRAP_TOKEN) {
    console.log(`  BOOTSTRAP_TOKEN: ${generated.BOOTSTRAP_TOKEN}`);
  }
  console.log('======================================================\n');
  console.log('Add these to your .env or .dev.vars file:');
  if (d1Id) console.log(`  D1_DATABASE_ID=${d1Id}`);
  if (generated.BOOTSTRAP_TOKEN) console.log(`  BOOTSTRAP_TOKEN=${generated.BOOTSTRAP_TOKEN}`);
  console.log('\nOpen the URL and register the initial Owner account with the BOOTSTRAP_TOKEN.');
}

function ensureDatabaseId(dryRun) {
  loadEnv();
  const envId = process.env.D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID;
  if (envId) {
    console.log(`  database_id found from environment: ${envId}`);
    return envId;
  }
  const configPath = path.join(root, 'wrangler.jsonc');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const d1 = cfg.d1_databases?.[0];
  if (!d1) {
    console.error('wrangler.jsonc has no d1_databases entry');
    process.exit(1);
  }
  if (d1.database_id) {
    console.log('  database_id already present in wrangler.jsonc');
    return d1.database_id;
  }
  // Fallback path (non-interactive deploys skip config write-back): create explicitly.
  const out = run(bin('wrangler'), ['d1', 'create', d1.database_name], {
    dryRun,
    capture: true,
    allowFail: true,
    quiet: true,
  });
  const id = /database_id[:\s]+([0-9a-f-]{36})/i.exec(out.stdout)?.[1];
  let resolvedId = id;
  if (dryRun) {
    console.log(
      `  [dry-run] discovered D1_DATABASE_ID (parsed: ${id ?? 'pending'})`,
    );
    return id ?? 'pending-id';
  }
  if (!resolvedId) {
    // Create may have failed because it already exists — look it up by name.
    const list = run(bin('wrangler'), ['d1', 'list', '--json'], { capture: true, quiet: true });
    const dbs = parseFirstJson(list.stdout) ?? [];
    const found = dbs.find(
      (d) => d.database_name === d1.database_name || d.name === d1.database_name,
    );
    if (!found) {
      console.error('could not create or locate the D1 database');
      process.exit(1);
    }
    resolvedId = found.uuid ?? found.database_id;
  }
  console.log(`  discovered D1_DATABASE_ID: ${resolvedId}`);
  return resolvedId;
}

function collectAccounts(node) {
  const found = new Map();
  const visit = (n) => {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(visit);
    if (typeof n === 'object') {
      if (typeof n.id === 'string' && /^[0-9a-f]{32}$/.test(n.id)) {
        found.set(n.id, { id: n.id, name: n.name });
      }
      for (const v of Object.values(n)) visit(v);
    }
  };
  visit(node);
  return [...found.values()];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
