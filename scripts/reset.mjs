#!/usr/bin/env node
/**
 * Reset all Burrow resources back to a clean initial default state.
 *
 * Targets:
 *   (default)              Local Miniflare D1 database (wipes without prompt)
 *   --remote, --r, -r      Remote Cloudflare D1 database (requires confirmation phrase)
 *
 * Flags:
 *   --force                Bypass interactive confirmation on remote
 */
import readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';
import {
  bin,
  hasFlag,
  isRemoteTarget,
  printTargetBanner,
  root,
  run,
  step,
  getWranglerConfigArgs,
} from './lib.mjs';

const isRemote = isRemoteTarget();
const force = hasFlag('--force');

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
  printTargetBanner('Reset Database', isRemote);

  const targetName = isRemote ? 'REMOTE Cloudflare Production' : 'LOCAL Miniflare';

  // Remote requires explicit confirmation unless --force is given.
  // Local runs unprompted for a fast dev loop.
  if (isRemote && !force) {
    console.log('======================================================');
    console.log(`⚠️  DANGER: RESET REMOTE PRODUCTION DATABASE (${targetName})`);
    console.log('======================================================');
    console.log('This will WIPE ALL DATA from your remote Cloudflare D1 database:');
    console.log('  - All users, accounts, sessions, and workspaces');
    console.log('  - All projects, boards, cards, and notepads');
    console.log('  - Returns the production database to a completely clean, initial slate.');
    console.log('======================================================\n');

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      'Type "RESET-PRODUCTION" to confirm resetting remote production: ',
    );
    rl.close();

    if (answer.trim() !== 'RESET-PRODUCTION') {
      console.log('Reset cancelled. No data was modified.');
      process.exit(0);
    }
  }

  const configArgs = isRemote
    ? getWranglerConfigArgs({ required: true, purpose: 'remote database reset' })
    : [];
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

  const uploadsDir = path.join(root, 'data', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    step('Pruning local uploads directory (./data/uploads)');
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  console.log('\n======================================================');
  console.log(`✅ ${targetName} database has been reset to clean default state.`);
  console.log('Ready for fresh bootstrap owner registration.');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
