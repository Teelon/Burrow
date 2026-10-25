#!/usr/bin/env node
/**
 * Reset Burrow resources back to a clean initial default state.
 *
 * Targets:
 *   (default)              Local SQLite database (./data/burrow.db) and uploads (./data/uploads)
 *   --remote, --r, -r      Remote Cloudflare D1 database (requires confirmation phrase)
 *
 * Flags:
 *   --force                Bypass interactive confirmation on remote
 */
import readline from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
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

function applyLocalMigrations(dbPath, migrationsDir) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  try {
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    sqlite.exec(
      'CREATE TABLE IF NOT EXISTS _migrations (filename TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
    );
    const applied = new Set(
      sqlite
        .prepare('SELECT filename FROM _migrations')
        .all()
        .map((r) => r.filename),
    );
    const files = fs
      .readdirSync(migrationsDir)
      .filter((n) => n.endsWith('.sql'))
      .sort();
    for (const file of files) {
      if (!applied.has(file)) {
        const sqlText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        sqlite.exec(sqlText);
        sqlite
          .prepare('INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)')
          .run(file, Date.now());
      }
    }
  } finally {
    sqlite.close();
  }
}

async function main() {
  printTargetBanner('Reset Database', isRemote);

  if (!isRemote) {
    step('Resetting local SQLite database (./data/burrow.db)');
    const dbPath = path.join(root, 'data', 'burrow.db');
    for (const f of ['burrow.db', 'burrow.db-wal', 'burrow.db-shm']) {
      const p = path.join(root, 'data', f);
      try {
        if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      } catch (err) {
        console.warn(`  Could not remove ${f} (file locked by active server): ${err.message}`);
      }
    }

    const miniflareDir = path.join(root, 'data', 'v3');
    if (fs.existsSync(miniflareDir)) {
      try {
        fs.rmSync(miniflareDir, { recursive: true, force: true });
      } catch {
        // Ignored if in use
      }
    }

    step('Clearing local uploads directory (./data/uploads)');
    const uploadsDir = path.join(root, 'data', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      fs.rmSync(uploadsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(uploadsDir, { recursive: true });

    step('Applying migrations to ./data/burrow.db');
    applyLocalMigrations(dbPath, path.join(root, 'migrations'));

    step('Rebuilding server and web bundle (pnpm run build)');
    run('pnpm', ['run', 'build'], { allowFail: false });

    console.log('\n======================================================');
    console.log('✅ Local database and storage have been reset to clean default state.');
    console.log('Server and web assets rebuilt.');
    console.log('Ready for fresh bootstrap owner registration.');
    console.log('======================================================\n');
    return;
  }

  // --- Remote Cloudflare D1 Reset ---
  const targetName = 'REMOTE Cloudflare Production';

  if (!force) {
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

  const configArgs = getWranglerConfigArgs({ required: true, purpose: 'remote database reset' });

  step(`Ensuring migrations are applied on ${targetName} D1 database`);
  run(
    bin('wrangler'),
    [...configArgs, 'd1', 'migrations', 'apply', 'burrow', '--remote'],
    { env: { CI: '1' }, allowFail: true },
  );

  step(`Cleaning all records from ${targetName} D1 database`);
  run(
    bin('wrangler'),
    [...configArgs, 'd1', 'execute', 'burrow', '--remote', `--command=${cleanSql}`],
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
      '--remote',
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
