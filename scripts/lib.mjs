import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Resolve a dependency's executable path without relying on PATH/shell shims. */
export function bin(pkg, sub) {
  const pkgPath = path.join(root, 'node_modules', pkg, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const b = pkgJson.bin;
  if (typeof b === 'string') return path.join(root, 'node_modules', pkg, b);
  const preferred = sub ?? path.basename(pkg);
  const key = b[preferred] ? preferred : Object.keys(b)[0];
  return path.join(root, 'node_modules', pkg, b[key]);
}

export function argValue(flag, fallback = undefined) {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (i === -1) return fallback;
  const a = args[i];
  if (a.includes('=')) return a.slice(a.indexOf('=') + 1);
  return args[i + 1];
}

export function hasFlag(flag) {
  return process.argv.slice(2).some((a) => a === flag || a.startsWith(`${flag}=`));
}

/** Check if the command was invoked with any remote flag: --remote, --r, or -r. */
export function isRemoteTarget() {
  const isRemote = hasFlag('--remote') || hasFlag('--r') || hasFlag('-r');
  const isLocal = hasFlag('--local') || hasFlag('--l') || hasFlag('-l');
  if (isRemote && isLocal) {
    console.error('❌ ERROR: Cannot specify both --remote and --local target flags.');
    process.exit(1);
  }
  return isRemote;
}

/** Print a loud, prominent target banner at the start of a command. */
export function printTargetBanner(action, isRemote) {
  const target = isRemote ? '☁️  REMOTE (Cloudflare Production)' : '💻 LOCAL (Miniflare SQLite)';
  console.log('======================================================');
  console.log(`ACTION: ${action.toUpperCase()}`);
  console.log(`TARGET: ${target}`);
  console.log('======================================================\n');
}

/**
 * Run a command. Honors --dry-run globally via `dryRun`.
 * Uses shell only where required (Windows .cmd shims such as pnpm).
 */
export function run(cmd, args = [], opts = {}) {
  const {
    dryRun = false,
    capture = false,
    cwd = root,
    env,
    allowFail = false,
    quiet = false,
  } = opts;
  const printable =
    `${path.isAbsolute(cmd) ? path.relative(root, cmd) : cmd} ${args.join(' ')}`.trim();
  if (dryRun) {
    console.log(`  $ ${printable}`);
    return { status: 0, stdout: '', stderr: '' };
  }
  if (!quiet) console.log(`  $ ${printable}`);
  // Executable scripts are run through node; shell is only needed for .cmd shims (pnpm).
  // Extensionless files (typescript's bin/tsc) are node shebang scripts too — on
  // Windows cmd.exe can't exec them directly, so they go through node as well.
  const isScript = /\.(c?js|mjs)$/.test(cmd) || (!path.extname(cmd) && fs.existsSync(cmd));
  const command = isScript ? process.execPath : cmd;
  const finalArgs = isScript ? [cmd, ...args] : args;
  const res = spawnSync(command, finalArgs, {
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
    shell: process.platform === 'win32' && !isScript,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  if (res.status !== 0 && !allowFail) {
    console.error(`command failed (exit ${res.status}): ${printable}`);
    if (capture) process.stderr.write(res.stderr ?? '');
    if (printable.includes('wrangler')) {
      printWranglerTroubleshooting(printable);
    }
    process.exit(res.status ?? 1);
  }
  return { status: res.status ?? 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

export function step(title) {
  console.log(`\n==> ${title}`);
}

/** Parse the first JSON value found in a string (wrangler mixes logs with output). */
export function parseFirstJson(text) {
  const start = text.search(/[[{]/);
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return null;
  }
}

export async function smoke(url, { attempts = 3, delayMs = 2000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {
        const body = await res.json();
        console.log(`  health check OK: ${JSON.stringify(body)}`);
        return true;
      }
      console.warn(`  health check got HTTP ${res.status} (attempt ${i}/${attempts})`);
    } catch (err) {
      console.warn(`  health check failed: ${err} (attempt ${i}/${attempts})`);
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  console.error(`  smoke test failed for ${url}/api/health`);
  return false;
}

/** Load environment variables from .env and .dev.vars if present. */
export function loadEnv() {
  const envFiles = [path.join(root, '.env'), path.join(root, '.dev.vars')];
  for (const file of envFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
}

/**
 * Returns wrangler CLI config args (--config wrangler.local.jsonc).
 * Auto-discovers D1_DATABASE_ID from Cloudflare if not provided in process.env,
 * and writes only to git-ignored ephemeral wrangler.local.jsonc (never mutates .env or .dev.vars).
 */
export function getWranglerConfigArgs(options = {}) {
  const {
    d1IdOverride = null,
    required = false,
    purpose = 'deployment',
    ignoreCached = false,
  } = typeof options === 'string' ? { d1IdOverride: options } : options;

  loadEnv();
  let d1Id =
    d1IdOverride ||
    (!ignoreCached ? process.env.D1_DATABASE_ID || process.env.CLOUDFLARE_D1_DATABASE_ID : null);
  const configPath = path.join(root, 'wrangler.jsonc');
  const baseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const localConfigPath = path.join(root, 'wrangler.local.jsonc');

  if (!d1Id && !ignoreCached && fs.existsSync(localConfigPath)) {
    try {
      const existingLocal = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
      if (existingLocal.d1_databases?.[0]?.database_id) {
        d1Id = existingLocal.d1_databases[0].database_id;
      }
    } catch (_err) {
      void _err;
    }
  }

  if (!d1Id) {
    try {
      const dbName = baseConfig.d1_databases?.[0]?.database_name;
      if (dbName) {
        const list = run(bin('wrangler'), ['d1', 'list', '--json'], {
          capture: true,
          quiet: true,
          allowFail: true,
        });
        if (list.status === 0) {
          const dbs = parseFirstJson(list.stdout) ?? [];
          const found = dbs.find((d) => d.database_name === dbName || d.name === dbName);
          if (found) {
            d1Id = found.uuid ?? found.database_id;
            console.log(`  💡 Auto-discovered remote D1 database "${dbName}" (${d1Id})`);
          }
        }
      }
    } catch (_err) {
      void _err;
    }
  }

  if (!d1Id) {
    if (required) {
      printMissingD1Error(purpose);
      process.exit(1);
    }
    return [];
  }

  // Create or update git-ignored ephemeral wrangler.local.jsonc for Wrangler CLI
  const localConfig = JSON.parse(JSON.stringify(baseConfig));
  if (localConfig.d1_databases?.[0]) {
    localConfig.d1_databases[0].database_id = d1Id;
  }
  fs.writeFileSync(localConfigPath, JSON.stringify(localConfig, null, 2) + '\n');
  return ['--config', 'wrangler.local.jsonc'];
}

function printMissingD1Error(purpose) {
  console.error('\n' + '='.repeat(80));
  console.error(`❌ D1 DATABASE CONFIGURATION REQUIRED FOR ${purpose.toUpperCase()}`);
  console.error('='.repeat(80));
  console.error('Could not resolve your Cloudflare D1 Database ID.\n');
  console.error('🔍 Why this happens:');
  console.error('  Cloudflare D1 requires a 36-character database UUID for remote operations');
  console.error('  (migrations, time-travel, deployments). Either the database has not been');
  console.error('  provisioned yet, or your Wrangler CLI session is not logged in.\n');
  console.error('🛠️ How to fix:');
  console.error('  Option 1: Run the one-command setup to provision all Cloudflare resources:');
  console.error('    pnpm run setup\n');
  console.error('  Option 2: If your Cloudflare login session has expired:');
  console.error('    pnpm exec wrangler login');
  console.error('='.repeat(80) + '\n');
}

function printWranglerTroubleshooting(printable) {
  console.error('\n' + '='.repeat(80));
  console.error('💡 WRANGLER TROUBLESHOOTING GUIDE');
  console.error('='.repeat(80));
  if (printable.includes('d1')) {
    console.error('• D1 "Authentication error [code: 10000]":');
    console.error('  - Cloudflare D1 requires a valid 36-character database UUID.');
    console.error('  - Run `pnpm run setup` to provision or auto-discover the database.');
    console.error('  - Or run `pnpm exec wrangler d1 list` to inspect your account databases.');
  }
  console.error('• Authentication or Permission errors:');
  console.error('  - Verify active login and account: `pnpm exec wrangler whoami`');
  console.error('  - Re-authenticate if session expired: `pnpm exec wrangler login`');
  console.error('• First-time setup:');
  console.error('  - Run `pnpm run setup` for automatic one-command provisioning.');
  console.error('='.repeat(80) + '\n');
}
