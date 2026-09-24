import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import { expectInvariantsHold } from './helpers';

const app = createWorkerApp(env);

describe('Phase 5C: Relationships, Notifications & Backlinks', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';
  let editorCookie = '';
  let ownerUserId = '';
  let editorUserId = '';
  let projectId = '';

  let notepad1Id = '';
  let notepad2Id = '';
  let boardId = '';
  let columnId = '';
  let cardId = '';

  it('sets up workspace with owner and editor', async () => {
    // 1. Owner
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'notif-owner@example.com',
          password: 'password123',
          name: 'Notif Owner',
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
    const me = (await meRes.json()) as {
      user: { id: string };
      workspace: { id: string };
      lastProjectId: string;
    };
    ownerUserId = me.user.id;
    projectId = me.lastProjectId;

    // 2. Editor
    const inviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'notif-editor@example.com', role: 'editor' }),
      },
      env,
    );
    const invite = (await inviteRes.json()) as { token: string };

    const editorSignup = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'notif-editor@example.com',
          password: 'password123',
          name: 'Notif Editor',
          inviteToken: invite.token,
        }),
      },
      env,
    );
    editorCookie = editorSignup.headers.get('set-cookie')!;

    const editorMe = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: editorCookie } },
      env,
    );
    editorUserId = ((await editorMe.json()) as { user: { id: string } }).user.id;

    // 3. Create notepads
    const np1Res = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Notepad 1' }),
      },
      env,
    );
    notepad1Id = ((await np1Res.json()) as { id: string }).id;

    const np2Res = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Notepad 2' }),
      },
      env,
    );
    notepad2Id = ((await np2Res.json()) as { id: string }).id;

    // 4. Create board & card
    const bRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ name: 'Notif Board' }),
      },
      env,
    );
    boardId = ((await bRes.json()) as { id: string }).id;

    const bDetailRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    columnId = ((await bDetailRes.json()) as { columns: Array<{ id: string }> }).columns[0]!.id;

    const cRes = await app.request(
      `http://localhost/api/columns/${columnId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Important Task' }),
      },
      env,
    );
    cardId = ((await cRes.json()) as { cardId: string }).cardId;

    await expectInvariantsHold(env.DB);
  });

  it('notifies user on mention exactly once and excludes self-mentions', async () => {
    // Owner mentions editor in Notepad 1
    const contentWithMention = JSON.stringify([
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [
          { type: 'text', text: 'Hey ' },
          {
            type: 'mention',
            props: { kind: 'user', id: editorUserId, label: 'Notif Editor' },
          },
          { type: 'text', text: ' check this out' },
          // Self-mention should NOT notify owner
          {
            type: 'mention',
            props: { kind: 'user', id: ownerUserId, label: 'Notif Owner' },
          },
        ],
        children: [],
      },
    ]);

    const saveRes = await app.request(
      `http://localhost/api/notepads/${notepad1Id}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ content: contentWithMention, baseVersion: 1 }),
      },
      env,
    );
    expect(saveRes.status).toBe(200);

    // Check editor's notifications
    const editorNotifsRes = await app.request(
      'http://localhost/api/notifications?unread=1',
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(editorNotifsRes.status).toBe(200);
    const editorNotifs = (await editorNotifsRes.json()) as Array<{
      type: string;
      actor: { name: string };
      notepadId: string;
    }>;
    expect(editorNotifs.length).toBe(1);
    expect(editorNotifs[0]?.type).toBe('mention');
    expect(editorNotifs[0]?.actor.name).toBe('Notif Owner');
    expect(editorNotifs[0]?.notepadId).toBe(notepad1Id);

    // Check owner has no notifications (no self-mention notification)
    const ownerNotifsRes = await app.request(
      'http://localhost/api/notifications',
      { headers: { Cookie: ownerCookie } },
      env,
    );
    const ownerNotifs = (await ownerNotifsRes.json()) as Array<unknown>;
    expect(ownerNotifs.length).toBe(0);

    // Editing again with the same mention does NOT re-notify
    const save2Res = await app.request(
      `http://localhost/api/notepads/${notepad1Id}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({
          content: contentWithMention.replace('check this out', 'updated check this out'),
          baseVersion: 2,
        }),
      },
      env,
    );
    expect(save2Res.status).toBe(200);

    const recheckNotifs = await app.request(
      'http://localhost/api/notifications',
      { headers: { Cookie: editorCookie } },
      env,
    );
    const allNotifs = (await recheckNotifs.json()) as Array<unknown>;
    expect(allNotifs.length).toBe(1); // Still exactly 1 notification

    await expectInvariantsHold(env.DB);
  });

  it('notifies assignee on card assignment', async () => {
    // Assign card to editor
    const assignRes = await app.request(
      `http://localhost/api/cards/${cardId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ assigneeIds: [editorUserId] }),
      },
      env,
    );
    expect(assignRes.status).toBe(200);

    // Editor should have an 'assigned' notification
    const editorNotifsRes = await app.request(
      'http://localhost/api/notifications?unread=1',
      { headers: { Cookie: editorCookie } },
      env,
    );
    const notifs = (await editorNotifsRes.json()) as Array<{ type: string; cardId: string }>;
    const assignedNotif = notifs.find((n) => n.type === 'assigned');
    expect(assignedNotif).toBeDefined();
    expect(assignedNotif?.cardId).toBe(cardId);

    // Marking notifications read
    const markReadRes = await app.request(
      'http://localhost/api/notifications/read',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({}),
      },
      env,
    );
    expect(markReadRes.status).toBe(200);

    // Unread count should now be 0
    const unreadRes = await app.request(
      'http://localhost/api/notifications?unread=1',
      { headers: { Cookie: editorCookie } },
      env,
    );
    const unread = (await unreadRes.json()) as Array<unknown>;
    expect(unread.length).toBe(0);

    await expectInvariantsHold(env.DB);
  });

  it('indexes backlinks and removes deleted sources', async () => {
    // Notepad 2 links to Notepad 1
    const contentWithLink = JSON.stringify([
      {
        id: 'block-2',
        type: 'notepadLink',
        props: { notepadId: notepad1Id },
        content: [],
        children: [],
      },
    ]);

    const saveLinkRes = await app.request(
      `http://localhost/api/notepads/${notepad2Id}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ content: contentWithLink, baseVersion: 1 }),
      },
      env,
    );
    expect(saveLinkRes.status).toBe(200);

    // GET /api/notepads/:id returns backlinks: Notepad 1 should show Notepad 2 in backlinks
    const np1Detail = await app.request(
      `http://localhost/api/notepads/${notepad1Id}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(np1Detail.status).toBe(200);
    const np1Data = (await np1Detail.json()) as {
      backlinks: Array<{ id: string; title: string }>;
    };
    expect(np1Data.backlinks.length).toBe(1);
    expect(np1Data.backlinks[0]?.id).toBe(notepad2Id);
    expect(np1Data.backlinks[0]?.title).toBe('Notepad 2');

    // Soft delete Notepad 2
    const delRes = await app.request(
      `http://localhost/api/notepads/${notepad2Id}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(delRes.status).toBe(200);

    // Trashed source should disappear from backlinks
    const np1AfterDel = await app.request(
      `http://localhost/api/notepads/${notepad1Id}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    const np1AfterDelData = (await np1AfterDel.json()) as {
      backlinks: Array<{ id: string }>;
    };
    expect(np1AfterDelData.backlinks.length).toBe(0);

    await expectInvariantsHold(env.DB);
  });
});
