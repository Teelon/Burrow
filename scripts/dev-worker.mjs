import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bin, loadEnv, root, run } from './lib.mjs';

/**
 * Cloudflare Worker local development server:
 * 1. Ensures local D1 migrations are applied with persistence to ./data
 * 2. Starts Wrangler dev (Worker + local D1/R2) on :8787 persisted to ./data
 * 3. Starts Vite (SPA + HMR) on :3005 (proxying /api to :8787)
 */
loadEnv();

const authSecret = process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me-32-bytes-minimum!!';
const authUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3005';
const bootstrapToken = process.env.BOOTSTRAP_TOKEN || 'dev-bootstrap-token';

console.log('==> Ensuring local D1 migrations are applied (--persist-to ./data)');
run(
  bin('wrangler'),
  ['d1', 'migrations', 'apply', 'burrow', '--local', '--persist-to', './data'],
  {
    env: { CI: '1' },
    allowFail: false,
  },
);

const assetsDir = path.join(root, 'dist', 'web');
if (!fs.existsSync(path.join(assetsDir, 'index.html'))) {
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(assetsDir, 'index.html'),
    '<!doctype html><html><body><p>Run <code>pnpm build</code> for the production bundle; use http://localhost:3005 in dev.</p></body></html>',
  );
}

const children = [];
function launch(label, cmd, args, env = process.env) {
  const child = spawn(cmd, args, {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
    env,
  });
  child.on('exit', (code) => {
    console.log(`${label} exited (${code})`);
    shutdown(code ?? 0);
  });
  children.push(child);
  return child;
}

function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // Process may already have exited
    }
  } else {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process may already have exited
    }
  }
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping dev:worker servers...');
  for (const c of children) {
    killTree(c.pid);
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// Allow pressing Ctrl+C or 'q' in terminal to stop cleanly
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\u0003' || key.toLowerCase() === 'q') {
      shutdown(0);
    }
  });
}

const wranglerVars = [
  '--var',
  `BETTER_AUTH_SECRET:${authSecret}`,
  '--var',
  `BETTER_AUTH_URL:${authUrl}`,
  '--var',
  `BOOTSTRAP_TOKEN:${bootstrapToken}`,
];
if (process.env.RESEND_API_KEY) {
  wranglerVars.push('--var', `RESEND_API_KEY:${process.env.RESEND_API_KEY}`);
}
if (process.env.EMAIL_FROM) {
  wranglerVars.push('--var', `EMAIL_FROM:${process.env.EMAIL_FROM}`);
}

console.log('\n======================================================');
console.log('Burrow Local Development (Cloudflare Worker + Miniflare)');
console.log(`  Web App (Vite):     ${authUrl}`);
console.log('  Worker API:         http://127.0.0.1:8787');
console.log('  Miniflare State:    ./data');
console.log(`  BOOTSTRAP_TOKEN:    ${bootstrapToken}`);
console.log(
  `  Email Delivery:     ${process.env.RESEND_API_KEY ? `Resend (${process.env.EMAIL_FROM || 'default'})` : 'Console log fallback'}`,
);
console.log('======================================================');
console.log('Press Ctrl+C or "q" at any time to stop\n');

launch('wrangler', process.execPath, [
  bin('wrangler'),
  'dev',
  '--port',
  '8787',
  '--persist-to',
  './data',
  '--show-interactive-dev-session=false',
  ...wranglerVars,
]);
launch('vite', process.execPath, [
  bin('vite'),
  '--port',
  '3005',
  '--strictPort',
  '--clearScreen',
  'false',
]);

