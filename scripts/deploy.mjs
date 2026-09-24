#!/usr/bin/env node
/**
 * Release. Run with `pnpm deploy`.
 * check -> build -> record D1 Time Travel bookmark -> migrate remote -> deploy -> smoke.
 */
import fs from 'node:fs';
import path from 'node:path';
import { bin, root, run, smoke, step, parseFirstJson } from './lib.mjs';

async function main() {
  step('Check (typecheck, lint, tests)');
  run(process.execPath, [path.join(root, 'scripts', 'check.mjs')]);

  step('Build');
  run(process.execPath, [bin('vite'), 'build']);

  step('Record D1 Time Travel bookmark (rollback point)');
  const tt = run(bin('wrangler'), ['d1', 'time-travel', 'info', 'burrow', '--remote', '--json'], {
    capture: true,
    allowFail: true,
    quiet: true,
  });
  if (tt.status === 0) {
    const info = parseFirstJson(tt.stdout) ?? {};
    const bookmark = info.bookmark ?? info;
    const line = `${new Date().toISOString()}  ${JSON.stringify(bookmark)}`;
    const logDir = path.join(root, '.deploy-log');
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'rollbacks.log'), line + '\n');
    console.log(`  bookmark saved to .deploy-log/rollbacks.log: ${JSON.stringify(bookmark)}`);
  } else {
    console.warn('  could not read a Time Travel bookmark (new database?): continuing');
  }

  step('Apply pending migrations to remote D1 (before uploading code)');
  run(bin('wrangler'), ['d1', 'migrations', 'apply', 'burrow', '--remote'], { env: { CI: '1' } });

  step('Deploy');
  const deploy = run(bin('wrangler'), ['deploy'], { capture: true });
  const url = deploy.stdout.match(/https:\/\/[^\s]*workers\.dev[^\s]*/)?.[0];
  if (url) console.log(`  deployed: ${url}`);

  step('Smoke test');
  if (url) {
    const ok = await smoke(url);
    if (!ok) process.exit(1);
  } else {
    console.warn('  no workers.dev URL found in output — skipping smoke test');
  }
  console.log('\ndeploy complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
