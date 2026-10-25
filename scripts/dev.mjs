import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { bin, loadEnv, root, run } from './lib.mjs';

/**
 * One-command local dev server:
 * 1. Ensures ./data/burrow.db parent directories and SQLite migrations are applied
 * 2. Starts Node backend server (API + D1 adapter + uploads) on :8787
 * 3. Starts Vite (SPA + HMR) on :3005 (proxying /api to :8787)
 */
loadEnv();

const authSecret = process.env.BETTER_AUTH_SECRET || 'dev-secret-change-me-32-bytes-minimum!!';
const authUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3005';
const bootstrapToken = process.env.BOOTSTRAP_TOKEN || 'dev-bootstrap-token';

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
  // Stdin is ignored so child processes (Wrangler/Vite/Server) don't fight over the console
  // or put Windows terminal into raw modes that trap keystrokes / block Ctrl+C.
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
  console.log('\nStopping dev servers...');
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

const nodeEnv = {
  ...process.env,
  PORT: '8787',
  SQLITE_PATH: path.join(root, 'data', 'burrow.db'),
  LOCAL_STORAGE_PATH: path.join(root, 'data', 'uploads'),
  BETTER_AUTH_SECRET: authSecret,
  BETTER_AUTH_URL: authUrl,
  BOOTSTRAP_TOKEN: bootstrapToken,
};

console.log('\n======================================================');
console.log('Burrow Local Development (Unified Node + SQLite)');
console.log(`  Web App (Vite):     ${authUrl}`);
console.log('  Backend API (Node): http://127.0.0.1:8787');
console.log(`  Database:           ./data/burrow.db`);
console.log(`  Uploads:            ./data/uploads`);
console.log(`  BOOTSTRAP_TOKEN:    ${bootstrapToken}`);
console.log(
  `  Email Delivery:     ${process.env.RESEND_API_KEY ? `Resend (${process.env.EMAIL_FROM || 'default'})` : 'Console log fallback'}`,
);
console.log('======================================================');
console.log('Press Ctrl+C or "q" at any time to stop\n');

console.log('==> Ensuring server bundle is compiled (dist/server.mjs)');
run('pnpm', [
  'exec',
  'esbuild',
  'src/server/index.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--outfile=dist/server.mjs',
  '--packages=external',
]);

launch('server', process.execPath, [path.join(root, 'dist', 'server.mjs')], nodeEnv);
launch('vite', process.execPath, [
  bin('vite'),
  '--port',
  '3005',
  '--strictPort',
  '--clearScreen',
  'false',
]);
