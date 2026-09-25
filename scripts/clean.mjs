#!/usr/bin/env node
/**
 * Alias for `pnpm run reset --local`. Deprecated in favor of `pnpm run reset --local`.
 */
import { run } from './lib.mjs';

console.warn('[DEPRECATION NOTE] "db:clean:local" is an alias for "pnpm run reset --local".');
run('node', ['./scripts/reset.mjs', '--local']);
