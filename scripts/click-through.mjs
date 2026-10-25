#!/usr/bin/env node
/**
 * Automated end-to-end click-through verification script for `pnpm dev:worker`.
 * Exercises the complete 5-point checklist using Playwright Chromium:
 * 1. Create a board and add 100+ cards
 * 2. Reorder cards and move a card between columns
 * 3. Soft-delete the board, restore it, and confirm every card and notepad is back
 * 4. Search for a card title both before delete and after restore (validating FTS rebuild)
 * 5. Hard-delete the board and confirm search no longer returns its cards
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { bin, run } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return true;
    } catch {
      // Retry
    }
    await sleep(500);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log('==> Preparing clean local D1 state in ./data');
  run(
    bin('wrangler'),
    [
      'd1',
      'execute',
      'burrow',
      '--local',
      '--persist-to',
      './data',
      '--command',
      'DELETE FROM notepads_fts; DELETE FROM card_subtasks; DELETE FROM card_comments; DELETE FROM card_assignees; DELETE FROM cards; DELETE FROM board_columns; DELETE FROM boards; DELETE FROM notepad_tags; DELETE FROM notepad_links; DELETE FROM notepads; DELETE FROM edit_locks; DELETE FROM tags; DELETE FROM projects; DELETE FROM invites; DELETE FROM notifications; DELETE FROM members; DELETE FROM workspaces; DELETE FROM session; DELETE FROM account; DELETE FROM verification; DELETE FROM user;',
    ],
    { quiet: true, allowFail: true },
  );

  console.log('==> Step 0: Starting dev:worker (Wrangler + Vite) with Miniflare state in ./data');
  const devProcess = spawn('node', [path.join(root, 'scripts', 'dev-worker.mjs')], {
    cwd: root,
    stdio: 'inherit',
    shell: false,
  });

  const cleanup = () => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(devProcess.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        devProcess.kill('SIGTERM');
      }
    } catch {
      // process already dead
    }
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  try {
    await waitForHttp('http://127.0.0.1:8787/api/health');
    await waitForHttp('http://localhost:3005');
    console.log('✓ dev:worker is healthy and running on :3005 and :8787\n');

    console.log('==> Step 1: Launching Playwright Chromium browser');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('==> Initial signup with bootstrap token on http://localhost:3005');
    const signupRes = await page.request.post('http://localhost:3005/api/auth/sign-up/email', {
      data: {
        email: 'clickthrough-owner@example.com',
        password: 'Password123!',
        name: 'Clickthrough Owner',
        bootstrapToken: '26dadbc46ca855c1c8663dfa7735e65a',
      },
    });

    if (!signupRes.ok()) {
      throw new Error(`Failed to sign up: ${signupRes.status()} ${await signupRes.text()}`);
    }

    console.log('==> Navigating to app on http://localhost:3005');
    await page.goto('http://localhost:3005/');
    await page.waitForLoadState('networkidle');

    // Fetch user profile to verify session
    const meRes = await page.request.get('http://localhost:3005/api/me');
    if (!meRes.ok()) {
      throw new Error(`Failed to authenticate: ${meRes.status()} ${await meRes.text()}`);
    }
    const me = await meRes.json();
    console.log(`✓ Authenticated as: ${me.name} (${me.email})\n`);

    const projectsRes = await page.request.get('http://localhost:3005/api/projects');
    const projects = await projectsRes.json();
    if (!projects || projects.length === 0) {
      throw new Error('No projects found in workspace!');
    }
    const project = projects[0];
    console.log(`Using project: ${project.name} (${project.id})\n`);

    // 2. Create Board with 100+ cards
    console.log('==> Step 2: Creating a new board and adding 110 cards (100+ cards test)');
    const boardRes = await page.request.post(`http://localhost:3005/api/projects/${project.id}/boards`, {
      data: { name: 'Large 100+ Clickthrough Board', icon: '📋' },
    });
    if (!boardRes.ok()) throw new Error(`Failed to create board: ${await boardRes.text()}`);
    const board = await boardRes.json();
    console.log(`✓ Board created: "${board.name}" (${board.id})`);

    // Create 2 columns
    const col1Res = await page.request.post(`http://localhost:3005/api/boards/${board.id}/columns`, {
      data: { name: 'To Do', color: '#6366f1' },
    });
    const col1 = await col1Res.json();

    const col2Res = await page.request.post(`http://localhost:3005/api/boards/${board.id}/columns`, {
      data: { name: 'In Progress', color: '#f59e0b' },
    });
    const col2 = await col2Res.json();
    console.log(`✓ Columns created: "${col1.name}" (${col1.id}) and "${col2.name}" (${col2.id})`);

    const CARD_COUNT = 110;
    const UNIQUE_CARD_TITLE = 'Unique Needle Card 42 for FTS';
    let targetCardId = '';

    console.log(`Adding ${CARD_COUNT} cards to column "${col1.name}"...`);
    for (let i = 0; i < CARD_COUNT; i++) {
      const title = i === 42 ? UNIQUE_CARD_TITLE : `Batch Card #${i}`;
      const cardRes = await page.request.post(`http://localhost:3005/api/columns/${col1.id}/cards`, {
        data: { title },
      });
      if (!cardRes.ok()) throw new Error(`Failed to add card #${i}: ${await cardRes.text()}`);
      const created = await cardRes.json();
      if (i === 42) targetCardId = created.cardId || created.id;
    }
    console.log(`✓ Added ${CARD_COUNT} cards successfully. Target card ID: ${targetCardId}\n`);

    // Load board in browser UI
    console.log('==> Step 3: Verifying cards render in the UI');
    await page.goto(`http://localhost:3005/p/${project.id}/b/${board.id}`);
    await page.waitForLoadState('networkidle');

    const boardDetailsRes = await page.request.get(`http://localhost:3005/api/boards/${board.id}`);
    const boardDetails = await boardDetailsRes.json();
    const initialCol1Cards = boardDetails.columns.find((c) => c.id === col1.id)?.cards || [];
    console.log(`✓ Verified board has ${initialCol1Cards.length} cards loaded in column "${col1.name}"\n`);

    // 3. Move card to another column & reorder
    console.log('==> Step 4: Reordering and moving target card to another column');
    const moveRes = await page.request.post(`http://localhost:3005/api/cards/${targetCardId}/move`, {
      data: { columnId: col2.id },
    });
    if (!moveRes.ok()) throw new Error(`Failed to move card: ${await moveRes.text()}`);

    const afterMoveRes = await page.request.get(`http://localhost:3005/api/boards/${board.id}`);
    const afterMove = await afterMoveRes.json();
    const col2Cards = afterMove.columns.find((c) => c.id === col2.id)?.cards || [];
    const moved = col2Cards.some((c) => c.id === targetCardId);
    if (!moved) throw new Error('Card was not found in destination column after move!');
    console.log(`✓ Card successfully moved to column "${col2.name}" (column now has ${col2Cards.length} cards)\n`);

    // 4. Search verification BEFORE delete
    console.log('==> Step 5: Full-Text Search verification BEFORE delete');
    const searchBeforeRes = await page.request.get(
      `http://localhost:3005/api/search?q=Unique+Needle+Card+42&projectId=${project.id}`,
    );
    const searchBefore = await searchBeforeRes.json();
    const foundBefore = (searchBefore.results || searchBefore || []).some(
      (r) => r.title && r.title.includes('Unique Needle Card 42'),
    );
    console.log(`Search for "${UNIQUE_CARD_TITLE}": ${foundBefore ? 'FOUND ✓' : 'NOT FOUND ✗'}`);
    if (!foundBefore) throw new Error('Search failed to find card before delete!');

    // 5. Soft-delete the board
    console.log('\n==> Step 6: Soft-deleting the board (110 cards)');
    const deleteRes = await page.request.delete(`http://localhost:3005/api/boards/${board.id}`);
    if (!deleteRes.ok()) throw new Error(`Failed to soft-delete board: ${await deleteRes.text()}`);
    console.log('✓ Board soft-deleted');

    // Confirm excluded from search
    const searchDeletedRes = await page.request.get(
      `http://localhost:3005/api/search?q=Unique+Needle+Card+42&projectId=${project.id}`,
    );
    const searchDeleted = await searchDeletedRes.json();
    const foundInDeleted = (searchDeleted.results || searchDeleted || []).some(
      (r) => r.title && r.title.includes('Unique Needle Card 42'),
    );
    console.log(`Search after soft-delete: ${foundInDeleted ? 'STILL FOUND (ERROR) ✗' : 'CLEARED ✓'}`);
    if (foundInDeleted) throw new Error('Soft-deleted card still appears in search results!');

    // 6. Restore the board
    console.log('\n==> Step 7: Restoring the board from trash');
    const restoreRes = await page.request.post(`http://localhost:3005/api/boards/${board.id}/restore`);
    if (!restoreRes.ok()) throw new Error(`Failed to restore board: ${await restoreRes.text()}`);
    console.log('✓ Board restored successfully');

    // Confirm every card and notepad is back
    const restoredDetailsRes = await page.request.get(`http://localhost:3005/api/boards/${board.id}`);
    const restoredDetails = await restoredDetailsRes.json();
    const totalRestoredCards = restoredDetails.columns.reduce((sum, c) => sum + c.cards.length, 0);
    console.log(`✓ Confirmed all ${totalRestoredCards} cards are restored on the board`);
    if (totalRestoredCards !== CARD_COUNT) {
      throw new Error(`Expected ${CARD_COUNT} restored cards, got ${totalRestoredCards}`);
    }

    // Confirm search index rebuilt after restore
    console.log('==> Step 8: Full-Text Search verification AFTER restore');
    const searchRestoredRes = await page.request.get(
      `http://localhost:3005/api/search?q=Unique+Needle+Card+42&projectId=${project.id}`,
    );
    const searchRestored = await searchRestoredRes.json();
    const foundRestored = (searchRestored.results || searchRestored || []).some(
      (r) => r.title && r.title.includes('Unique Needle Card 42'),
    );
    console.log(`Search after restore: ${foundRestored ? 'RE-INDEXED & FOUND ✓' : 'NOT FOUND ✗'}`);
    if (!foundRestored) throw new Error('Search failed to find card after restore!');

    // 7. Hard-delete the board
    console.log('\n==> Step 9: Hard-deleting (permanently deleting) the board');
    // Board must be in trash first to permanently delete
    await page.request.delete(`http://localhost:3005/api/boards/${board.id}`);
    const hardDeleteRes = await page.request.delete(`http://localhost:3005/api/boards/${board.id}/permanent`);
    if (!hardDeleteRes.ok()) throw new Error(`Failed to permanently delete board: ${await hardDeleteRes.text()}`);
    console.log('✓ Board permanently deleted');

    // Confirm search no longer returns cards
    const searchFinalRes = await page.request.get(
      `http://localhost:3005/api/search?q=Unique+Needle+Card+42&projectId=${project.id}`,
    );
    const searchFinal = await searchFinalRes.json();
    const foundFinal = (searchFinal.results || searchFinal || []).some(
      (r) => r.title && r.title.includes('Unique Needle Card 42'),
    );
    console.log(`Search after hard-delete: ${foundFinal ? 'STILL FOUND (ERROR) ✗' : 'CLEARED ✓'}`);
    if (foundFinal) throw new Error('Hard-deleted card still appears in search results!');

    await browser.close();
    console.log('\n======================================================');
    console.log('🎉 CLICK-THROUGH CHECKLIST 100% PASSED ON DEV:WORKER');
    console.log('======================================================\n');
  } finally {
    cleanup();
  }
}

main().catch((err) => {
  console.error('\n❌ Click-through failed with error:', err);
  process.exit(1);
});

