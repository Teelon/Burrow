#!/usr/bin/env node
/**
 * Run remote D1 migrations with automatic config resolution and friendly error messaging.
 * Usage: pnpm run db:migrate:remote
 */
import { bin, getWranglerConfigArgs, run, step } from './lib.mjs';

step('Apply pending migrations to remote D1');
const configArgs = getWranglerConfigArgs({ required: true, purpose: 'remote migrations' });
run(bin('wrangler'), [...configArgs, 'd1', 'migrations', 'apply', 'burrow', '--remote'], {
  env: { CI: '1' },
});
