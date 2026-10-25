#!/usr/bin/env node
/**
 * One-command setup. Idempotent. Run with `pnpm run setup`.
 *
 * Targets:
 *   (default)              Local setup (installs deps, migrates local D1, prints dev URLs & token)
 *   --remote, --r, -r      Remote setup (provisions Cloudflare D1/R2, migrates, builds, deploys, sets secrets)
 *
 * Flags:
 *   --dry-run              print every command without running it
 *   --domain <domain>      attach a custom domain (remote only; must be on Cloudflare DNS in this account)
 *   --name <worker-name>   deploy under a different worker name (remote only)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import {
  argValue,
  bin,
  hasFlag,
  isRemoteTarget,
  printTargetBanner,
  root,
  run,
  smoke,
  step,
  parseFirstJson,
  loadEnv,
  getWranglerConfigArgs,
} from './lib.mjs';

const dryRun = hasFlag('--dry-run');
const isRemote = isRemoteTarget();
const domain = argValue('--domain');
const workerName = argValue('--name');
const WRANGLER_ARGS = workerName ? ['--name', workerName] : [];

async function main() {
  printTargetBanner('Setup', isRemote);

  step('Preflight');
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 20) {
    console.error(`Node 20+ required, found ${process.version}`);
    process.exit(1);
  }
  console.log(`node ${process.version}, dry-run: ${dryRun}`);
  loadEnv();
  run('pnpm', ['install'], { dryRun });

  step('Apply migrations to local D1');
  run(bin('wrangler'), ['d1', 'migrations', 'apply', 'burrow', '--local'], {
    dryRun,
    env: { CI: '1' },
  });

  if (!isRemote) {
    const localBootstrapToken = process.env.BOOTSTRAP_TOKEN || 'dev-bootstrap-token';
    const localUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3005';
    console.log('\n======================================================');
    console.log('✅ Local setup complete!');
    console.log(`  Local Web URL:      ${localUrl}`);
    console.log('  Local Worker API:   http://127.0.0.1:8787');
    console.log(`  BETTER_AUTH_URL:    ${localUrl}`);
    console.log('  BETTER_AUTH_SECRET: [configured]');
    console.log(`  BOOTSTRAP_TOKEN:    ${localBootstrapToken}`);
    console.log('======================================================');
    console.log('\nRun `pnpm dev` to start the local development server.');
    console.log('To set up remote Cloudflare production instead, run:');
    console.log('  pnpm run setup -r\n');
    return;
  }

  // --- Remote Cloudflare Setup ---
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

  if (!process.env.CLOUDFLARE_ACCOUNT_ID && !dryRun) {
    const info = parseFirstJson(whoami.stdout ?? '');
    const accounts = collectAccounts(info);
    if (accounts.length > 1) {
      console.log('Multiple Cloudflare accounts found:');
      accounts.forEach((a, i) => console.log(`  [${i}] ${a.name ?? '(no name)'}  ${a.id}`));
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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

  step('Provision or discover Cloudflare D1 database & R2 bucket');
  const { d1Id, dbName, bucketName } = ensureCloudflareResources(dryRun);
  const configArgs = dryRun ? [] : getWranglerConfigArgs({ d1IdOverride: d1Id });

  step('Apply migrations to remote D1');
  run(bin('wrangler'), [...configArgs, 'd1', 'migrations', 'apply', dbName, '--remote'], {
    dryRun,
    env: { CI: '1' },
  });

  step('Typecheck + build');
  run(bin('typescript', 'tsc'), ['-b'], { dryRun });
  run(bin('vite'), ['build'], { dryRun });

  step('Deploy Worker & static assets');
  const deployArgs = [...configArgs, 'deploy', ...WRANGLER_ARGS];
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

  step('Provision Worker secrets');
  const originForAuth = domain ? `https://${domain}` : origin;
  const generated = {};
  const activeBootstrapToken =
    process.env.BOOTSTRAP_TOKEN && process.env.BOOTSTRAP_TOKEN !== 'dev-bootstrap-token'
      ? process.env.BOOTSTRAP_TOKEN
      : crypto.randomBytes(16).toString('hex');

  if (!dryRun) {
    const existing = new Set(
      (
        parseFirstJson(
          run(bin('wrangler'), [...configArgs, 'secret', 'list', '--format', 'json'], {
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
    generated.BOOTSTRAP_TOKEN = activeBootstrapToken;
    generated.BETTER_AUTH_URL = originForAuth;

    if (process.env.RESEND_API_KEY) {
      generated.RESEND_API_KEY = process.env.RESEND_API_KEY;
    }
    if (process.env.EMAIL_FROM) {
      generated.EMAIL_FROM = process.env.EMAIL_FROM;
    }

    const tmp = path.join(root, '.secrets.tmp.json');
    process.once('exit', () => fs.rmSync(tmp, { force: true }));
    fs.writeFileSync(tmp, JSON.stringify(generated, null, 2));
    try {
      const res = run(bin('wrangler'), [...configArgs, 'secret', 'bulk', tmp], {
        dryRun,
        allowFail: true,
      });
      if (res.status !== 0) {
        fs.rmSync(tmp, { force: true });
        process.exit(1);
      }
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  } else {
    generated.BETTER_AUTH_SECRET = '<generated-32-byte-base64url>';
    generated.BOOTSTRAP_TOKEN = activeBootstrapToken;
    generated.BETTER_AUTH_URL = originForAuth;
    run(bin('wrangler'), ['secret', 'bulk', '.secrets.tmp.json'], { dryRun });
  }

  step('Smoke test');
  if (dryRun) {
    console.log(`  [dry-run] GET ${origin}/api/health`);
  } else {
    const ok = await smoke(origin);
    if (!ok) process.exit(1);
  }

  console.log('\n======================================================');
  console.log('✅ Remote Cloudflare Setup complete!');
  console.log(`  Production URL:     ${origin}`);
  console.log(`  D1 Database:        ${dbName} (${d1Id})`);
  if (bucketName) {
    console.log(`  R2 Bucket:          ${bucketName}`);
  }
  console.log(`  BETTER_AUTH_URL:    ${originForAuth}`);
  if (generated.BETTER_AUTH_SECRET) {
    console.log('  BETTER_AUTH_SECRET: [configured]');
  } else {
    console.log('  BETTER_AUTH_SECRET: (preserved existing secret on Worker)');
  }
  console.log(`  BOOTSTRAP_TOKEN:    ${generated.BOOTSTRAP_TOKEN}`);
  console.log('======================================================\n');
  console.log(
    'Open the Production URL above and register the initial Owner account with BOOTSTRAP_TOKEN.',
  );
}

function ensureCloudflareResources(dryRun) {
  const configPath = path.join(root, 'wrangler.jsonc');
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const d1 = cfg.d1_databases?.[0];
  if (!d1) {
    console.error('wrangler.jsonc has no d1_databases entry');
    process.exit(1);
  }
  const dbName = d1.database_name;
  const bucketName = cfg.r2_buckets?.[0]?.bucket_name ?? null;

  if (bucketName) {
    if (dryRun) {
      run(bin('wrangler'), ['r2', 'bucket', 'create', bucketName], { dryRun });
    } else {
      const r2List = run(bin('wrangler'), ['r2', 'bucket', 'list'], {
        capture: true,
        allowFail: true,
        quiet: true,
      });
      const bucketExists =
        r2List.status === 0 && new RegExp(`\\b${bucketName}\\b`).test(r2List.stdout ?? '');
      if (bucketExists) {
        console.log(`  R2 bucket "${bucketName}" already exists`);
      } else {
        const created = run(bin('wrangler'), ['r2', 'bucket', 'create', bucketName], {
          capture: true,
          allowFail: true,
          quiet: true,
        });
        if (
          created.status === 0 ||
          /already exists/i.test((created.stdout ?? '') + (created.stderr ?? ''))
        ) {
          console.log(`  R2 bucket "${bucketName}" ready`);
        } else {
          console.warn(
            `  Warning: could not verify R2 bucket "${bucketName}": ${created.stderr || created.stdout}`,
          );
        }
      }
    }
  }

  if (dryRun) {
    run(bin('wrangler'), ['d1', 'create', dbName], { dryRun });
    return { d1Id: 'pending-d1-uuid', dbName, bucketName };
  }

  const list = run(bin('wrangler'), ['d1', 'list', '--json'], {
    capture: true,
    allowFail: true,
    quiet: true,
  });
  if (list.status === 0) {
    const dbs = parseFirstJson(list.stdout) ?? [];
    const found = dbs.find((d) => d.database_name === dbName || d.name === dbName);
    if (found) {
      const existingId = found.uuid ?? found.database_id;
      console.log(`  D1 database "${dbName}" found on Cloudflare: ${existingId}`);
      return { d1Id: existingId, dbName, bucketName };
    }
  }

  const out = run(bin('wrangler'), ['d1', 'create', dbName], {
    capture: true,
    allowFail: true,
    quiet: true,
  });
  let resolvedId = /database_id[:\s"]+([0-9a-f-]{36})/i.exec(out.stdout)?.[1];
  if (!resolvedId) {
    const retryList = run(bin('wrangler'), ['d1', 'list', '--json'], {
      capture: true,
      quiet: true,
    });
    const dbs = parseFirstJson(retryList.stdout) ?? [];
    const found = dbs.find((d) => d.database_name === dbName || d.name === dbName);
    if (!found) {
      console.error('could not create or locate the D1 database');
      if (out.stderr) console.error(out.stderr);
      process.exit(1);
    }
    resolvedId = found.uuid ?? found.database_id;
  }
  console.log(`  provisioned D1 database "${dbName}": ${resolvedId}`);
  return { d1Id: resolvedId, dbName, bucketName };
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
