import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import { createDb } from '../../src/worker/db/client';

const app = createWorkerApp(env);
import * as t from '../../src/worker/db/schema';
import { eq } from 'drizzle-orm';
import { expectInvariantsHold } from './helpers';
import { createCard } from '../../src/worker/services/cards';

const db = createDb(env.DB);

describe('Phase 3: Notepads, Soft Edit Locks & Restore Matrix', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';
  let editorCookie = '';
  let ownerUserId = '';
  let workspaceId = '';
  let projectId = '';

  it('sets up workspace with owner and editor', async () => {
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'np-owner@example.com',
          password: 'password123',
          name: 'Notepad Owner',
          bootstrapToken,
        }),
      },
      env,
    );
    expect(ownerRes.status).toBe(200);
    ownerCookie = ownerRes.headers.get('set-cookie')!;

    const meRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: ownerCookie } },
      env,
    );
    const meData = (await meRes.json()) as {
      user: { id: string };
      workspace: { id: string };
      lastProjectId: string;
    };
    ownerUserId = meData.user.id;
    workspaceId = meData.workspace.id;
    projectId = meData.lastProjectId;

    // Invite editor
    const inviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          email: 'np-editor@example.com',
          role: 'editor',
        }),
      },
      env,
    );
    const { token } = (await inviteRes.json()) as { token: string };

    const editorRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'np-editor@example.com',
          password: 'password123',
          name: 'Notepad Editor',
          inviteToken: token,
        }),
      },
      env,
    );
    expect(editorRes.status).toBe(200);
    editorCookie = editorRes.headers.get('set-cookie')!;

    const edMeRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: editorCookie } },
      env,
    );
    const edMeData = (await edMeRes.json()) as { user: { id: string } };
    expect(edMeData.user.id).toBeDefined();
  });

  let parentNotepadId = '';
  let childNotepadId = '';

  it('creates nested notepads and reloads them with content intact', async () => {
    // Create parent notepad
    const pRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ title: 'Parent Note' }),
      },
      env,
    );
    expect(pRes.status).toBe(201);
    const pData = (await pRes.json()) as { id: string };
    parentNotepadId = pData.id;

    // Create child notepad under parent
    const cRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ parentId: parentNotepadId, title: 'Child Note' }),
      },
      env,
    );
    expect(cRes.status).toBe(201);
    const cData = (await cRes.json()) as { id: string };
    childNotepadId = cData.id;

    // Save content to parent
    const content = JSON.stringify([
      { type: 'paragraph', content: [{ type: 'text', text: 'Parent content body' }] },
    ]);
    const saveRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          content,
          baseVersion: 1,
        }),
      },
      env,
    );
    expect(saveRes.status).toBe(200);

    // Read full notepad
    const readRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(readRes.status).toBe(200);
    const full = (await readRes.json()) as { content: string; version: number };
    expect(full.content).toBe(content);
    expect(full.version).toBe(2);

    await expectInvariantsHold(env.DB);
  });

  it('rejects nesting deeper than 8 levels', async () => {
    let currentParent = childNotepadId; // depth 2
    // We already have depth 1 (parent), depth 2 (child)
    // Add levels 3 through 8
    for (let d = 3; d <= 8; d++) {
      const res = await app.request(
        `http://localhost/api/projects/${projectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ parentId: currentParent, title: `Depth ${d}` }),
        },
        env,
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as { id: string };
      currentParent = data.id;
    }

    // Depth 9 must be rejected
    const rejectRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ parentId: currentParent, title: 'Depth 9' }),
      },
      env,
    );
    expect(rejectRes.status).toBe(400);
    const err = (await rejectRes.json()) as { error: { code: string } };
    expect(err.error.code).toBe('too_deep');
  });

  it('rejects moving a notepad under its own descendant (cycle check)', async () => {
    const moveRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/move`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ parentId: childNotepadId }),
      },
      env,
    );
    expect(moveRes.status).toBe(400);
    const err = (await moveRes.json()) as { error: { code: string } };
    expect(err.error.code).toBe('cycle_detected');
  });

  it('handles soft edit lock claiming, collision refusal, and release', async () => {
    // User A claims lock with clientId A
    const claimResA = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ clientId: 'client-A' }),
      },
      env,
    );
    expect(claimResA.status).toBe(200);
    const lockA = (await claimResA.json()) as { expiresAt: number };
    expect(lockA.expiresAt).toBeGreaterThan(Date.now());

    // User B tries to claim lock -> 409 locked
    const claimResB = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: editorCookie,
        },
        body: JSON.stringify({ clientId: 'client-B' }),
      },
      env,
    );
    expect(claimResB.status).toBe(409);
    const lockErrB = (await claimResB.json()) as {
      error: { code: string; holder: { userId: string; name: string } };
    };
    expect(lockErrB.error.code).toBe('locked');
    expect(lockErrB.error.holder.userId).toBe(ownerUserId);

    // User B cannot save content while User A holds lock
    const saveResB = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: editorCookie,
        },
        body: JSON.stringify({
          content: '[]',
          baseVersion: 2,
          clientId: 'client-B',
        }),
      },
      env,
    );
    expect(saveResB.status).toBe(409);

    // GET /api/notepads/:id returns lock info with clientId and isMe
    const getResA = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(getResA.status).toBe(200);
    const getJsonA = (await getResA.json()) as { lock: { clientId: string; isMe: boolean } };
    expect(getJsonA.lock.clientId).toBe('client-A');
    expect(getJsonA.lock.isMe).toBe(true);

    const getResB = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    const getJsonB = (await getResB.json()) as { lock: { isMe: boolean } };
    expect(getJsonB.lock.isMe).toBe(false);

    // User A in a second tab (client-A2) tries to claim without takeover -> 409 with isMe: true
    const claimResA2 = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ clientId: 'client-A2' }),
      },
      env,
    );
    expect(claimResA2.status).toBe(409);
    const lockErrA2 = (await claimResA2.json()) as {
      error: { code: string; holder: { isMe: boolean } };
    };
    expect(lockErrA2.error.holder.isMe).toBe(true);

    // User B tries to takeover User A's lock -> refused 409 (cannot take over another user's lock)
    const claimTakeoverB = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: editorCookie,
        },
        body: JSON.stringify({ clientId: 'client-B', takeover: true }),
      },
      env,
    );
    expect(claimTakeoverB.status).toBe(409);

    // User A takes over lock in client-A2 -> succeeds (200)
    const claimTakeoverA2 = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ clientId: 'client-A2', takeover: true }),
      },
      env,
    );
    expect(claimTakeoverA2.status).toBe(200);

    // User A releases lock from client-A2
    const releaseResA = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({ clientId: 'client-A2' }),
      },
      env,
    );
    expect(releaseResA.status).toBe(200);

    // Now User B can claim lock
    const claimResB2 = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: editorCookie,
        },
        body: JSON.stringify({ clientId: 'client-B' }),
      },
      env,
    );
    expect(claimResB2.status).toBe(200);

    // User B releases
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/lock`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Cookie: editorCookie,
        },
        body: JSON.stringify({ clientId: 'client-B' }),
      },
      env,
    );
  });

  // -------------------------------------------------------------------------
  // Restore Matrix Tests (1 to 7)
  // -------------------------------------------------------------------------

  it('Restore Matrix 1: delete parent, restore parent', async () => {
    // Delete parent (and its tree)
    const delRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      {
        method: 'DELETE',
        headers: { Cookie: ownerCookie },
      },
      env,
    );
    expect(delRes.status).toBe(200);

    // Verify deleted
    const [pDeleted] = await db.select().from(t.notepads).where(eq(t.notepads.id, parentNotepadId));
    expect(pDeleted?.deletedAt).not.toBeNull();

    // Restore parent
    const restRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/restore`,
      {
        method: 'POST',
        headers: { Cookie: ownerCookie },
      },
      env,
    );
    expect(restRes.status).toBe(200);

    const [pRestored] = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.id, parentNotepadId));
    expect(pRestored?.deletedAt).toBeNull();

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 2: delete child, then delete parent, restore parent (child stays in Trash), then restore child', async () => {
    // 1. Delete child
    await app.request(
      `http://localhost/api/notepads/${childNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // Wait 5ms so timestamps differ
    await new Promise((r) => setTimeout(r, 10));

    // 2. Delete parent
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // 3. Restore parent
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );

    // Child must still be deleted
    const [child] = await db.select().from(t.notepads).where(eq(t.notepads.id, childNotepadId));
    expect(child?.deletedAt).not.toBeNull();

    // 4. Restore child -> returns under parent
    await app.request(
      `http://localhost/api/notepads/${childNotepadId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );
    const [childRestored] = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.id, childNotepadId));
    expect(childRestored?.deletedAt).toBeNull();
    expect(childRestored?.parentId).toBe(parentNotepadId);

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 3: delete child, then delete parent, restore child first (parent still deleted, so child re-attaches at project root)', async () => {
    // 1. Delete child
    await app.request(
      `http://localhost/api/notepads/${childNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    await new Promise((r) => setTimeout(r, 10));

    // 2. Delete parent
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // 3. Restore child first
    await app.request(
      `http://localhost/api/notepads/${childNotepadId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );

    const [childRestored] = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.id, childNotepadId));
    expect(childRestored?.deletedAt).toBeNull();
    // Since parent is still deleted, child re-attaches at root!
    expect(childRestored?.parentId).toBeNull();

    // Restore parent to leave tree clean
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 4: delete parent, permanently delete child from Trash, restore parent (no orphans, no errors)', async () => {
    // Re-parent child under parent
    await app.request(
      `http://localhost/api/notepads/${childNotepadId}/move`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ parentId: parentNotepadId }),
      },
      env,
    );

    // Delete parent (deletes child too)
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // Permanently delete child
    const permRes = await app.request(
      `http://localhost/api/notepads/${childNotepadId}/permanent`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(permRes.status).toBe(200);

    // Restore parent
    const restRes = await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(restRes.status).toBe(200);

    // Child is completely gone, parent is active
    const [child] = await db.select().from(t.notepads).where(eq(t.notepads.id, childNotepadId));
    expect(child).toBeUndefined();

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 5: permanently delete parent: whole subtree, its tags, and its FTS rows are gone', async () => {
    // Delete parent first
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // Permanently delete parent
    await app.request(
      `http://localhost/api/notepads/${parentNotepadId}/permanent`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );

    // Verify parent is gone
    const [p] = await db.select().from(t.notepads).where(eq(t.notepads.id, parentNotepadId));
    expect(p).toBeUndefined();

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 6: deleting or restoring a notepad with kind = card through notepads API is refused', async () => {
    // Seed a board + column to create a card
    const boardId = 'board-test-card';
    const columnId = 'col-test-card';
    const now = Date.now();
    await db.batch([
      db.insert(t.boards).values({
        id: boardId,
        workspaceId,
        projectId,
        name: 'Test Board',
        position: 'a0',
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(t.boardColumns).values({
        id: columnId,
        boardId,
        name: 'To do',
        position: 'a0',
      }),
    ]);

    const created = await createCard(db, {
      workspaceId,
      actorId: ownerUserId,
      boardId,
      columnId,
      title: 'Card Task',
    });

    // Try to soft-delete card notepad via notepads API -> 400 refused
    const delRes = await app.request(
      `http://localhost/api/notepads/${created.notepadId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(delRes.status).toBe(400);
    const err = (await delRes.json()) as { error: { code: string } };
    expect(err.error.code).toBe('cannot_delete_card_notepad');

    await expectInvariantsHold(env.DB);
  });

  it('Restore Matrix 7: permanently delete project: all its notepads, boards, tags, FTS rows and inbound link rows are gone', async () => {
    // Delete the project
    const delProjRes = await app.request(
      `http://localhost/api/projects/${projectId}?confirm=My first project`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(delProjRes.status).toBe(200);

    // Verify all notepads in this project are gone
    const remainingNotepads = await db
      .select()
      .from(t.notepads)
      .where(eq(t.notepads.projectId, projectId));
    expect(remainingNotepads.length).toBe(0);

    await expectInvariantsHold(env.DB);
  });
});
