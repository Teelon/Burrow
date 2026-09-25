#!/usr/bin/env node
/**
 * Reset all Burrow resources back to a clean initial default state.
 * Works on local (--local) or remote (--remote).
 * Wipes all tables and resets schema to fresh initial state.
 * Usage:
 *   pnpm run reset --local     (wipes local D1, no prompt)
 *   pnpm run reset --remote    (wipes remote D1, requires confirmation)
 */
import readline from 'node:readline/promises';
import { bin, hasFlag, run, step, getWranglerConfigArgs } from './lib.mjs';

const isRemote = hasFlag('--remote');
const isLocal = hasFlag('--local');
const force = hasFlag('--force');

if (!isRemote && !isLocal) {
  console.error('\n❌ Error: Target flag required.');
  console.error('Usage:');
  console.error('  pnpm run reset --local     # Wipes local D1 database without prompt');
  console.error('  pnpm run reset --remote    # Wipes remote Cloudflare D1 (requires confirmation)\n');
  process.exit(1);
}

const cleanSql = [
  'DELETE FROM notepads_fts;',
  'DELETE FROM card_subtasks;',
  'DELETE FROM card_comments;',
  'DELETE FROM card_assignees;',
  'DELETE FROM cards;',
  'DELETE FROM board_columns;',
  'DELETE FROM boards;',
  'DELETE FROM notepad_tags;',
  'DELETE FROM notepad_links;',
  'DELETE FROM notepads;',
  'DELETE FROM edit_locks;',
  'DELETE FROM tags;',
  'DELETE FROM projects;',
  'DELETE FROM invites;',
  'DELETE FROM notifications;',
  'DELETE FROM members;',
  'DELETE FROM workspaces;',
  'DELETE FROM session;',
  'DELETE FROM account;',
  'DELETE FROM verification;',
  'DELETE FROM user;',
].join(' ');

async function main() {
  const targetName = isRemote ? 'REMOTE Cloudflare Production' : 'LOCAL Miniflare';

  // Remote requires explicit confirmation unless --force is given.
  // Local runs unprompted for a fast dev loop.
  if (isRemote && !force) {
    console.log('\n======================================================');
    console.log(`⚠️  DANGER: RESET REMOTE PRODUCTION DATABASE (${targetName})`);
    console.log('======================================================');
    console.log(`This will WIPE ALL DATA from your remote Cloudflare D1 database:`);
    console.log('  - All users, accounts, sessions, and workspaces');
    console.log('  - All projects, boards, cards, and notepads');
    console.log('  - Returns the production database to a completely clean, initial slate.');
    console.log('======================================================\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type "RESET-PRODUCTION" to confirm resetting remote production: ');
    rl.close();

    if (answer.trim() !== 'RESET-PRODUCTION') {
      console.log('Reset cancelled. No data was modified.');
      process.exit(0);
    }
  }

  const configArgs = isRemote ? getWranglerConfigArgs() : [];
  const targetFlag = isRemote ? '--remote' : '--local';

  step(`Cleaning all records from ${targetName} D1 database`);
  run(
    bin('wrangler'),
    [...configArgs, 'd1', 'execute', 'burrow', targetFlag, `--command=${cleanSql}`],
    { allowFail: false },
  );

  step('Verifying database is clean (0 users, 0 workspaces)');
  run(
    bin('wrangler'),
    [
      ...configArgs,
      'd1',
      'execute',
      'burrow',
      targetFlag,
      '--command=SELECT count(*) AS user_count FROM user; SELECT count(*) AS workspace_count FROM workspaces;',
    ],
    { allowFail: false },
  );

  console.log('\n======================================================');
  console.log(`✅ ${targetName} database has been reset to clean default state.`);
  console.log('Ready for fresh bootstrap owner registration.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
