import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import { createDb } from '../../src/worker/db/client';

const app = createWorkerApp(env);
import * as t from '../../src/worker/db/schema';
import { expectInvariantsHold } from './helpers';
import { getSlashCommandsForContext } from '../../src/shared/slash';

const db = createDb(env.DB);

describe('Phase 5A & 5B: Suggestions, Slash Menus & Task Commands', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';
  let editorCookie = '';
  let ownerUserId = '';
  let editorUserId = '';
  let workspaceId = '';
  let projectId = '';
  let boardId = '';
  let columnId = '';
  let tagId = '';

  it('sets up workspaces for scoped suggestion testing', async () => {
    // 1. Owner of Workspace A
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'suggest-owner@example.com',
          password: 'password123',
          name: 'Suggest Owner',
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
    expect(ownerUserId).toBeDefined();
    expect(workspaceId).toBeDefined();

    // 2. Editor of Workspace A
    const inviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ email: 'suggest-editor@example.com', role: 'editor' }),
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
          email: 'suggest-editor@example.com',
          password: 'password123',
          name: 'Suggest Editor',
          inviteToken: invite.token,
        }),
      },
      env,
    );
    editorCookie = editorSignup.headers.get('set-cookie')!;
    const editorMeRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: editorCookie } },
      env,
    );
    editorUserId = ((await editorMeRes.json()) as { user: { id: string } }).user.id;
    expect(editorUserId).toBeDefined();

    // 3. Create board and column in Workspace A
    const bRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ name: 'Suggest Board' }),
      },
      env,
    );
    const bData = (await bRes.json()) as { id: string };
    boardId = bData.id;

    const bDetailRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    const bDetail = (await bDetailRes.json()) as { columns: Array<{ id: string }> };
    columnId = bDetail.columns[0]!.id;

    // 4. Create tag in Project A
    const tagRes = await db
      .insert(t.tags)
      .values({
        id: 'suggest-tag-1',
        projectId,
        name: 'frontend',
        color: '#3b82f6',
      })
      .returning();
    tagId = tagRes[0]!.id;
    expect(tagId).toBeDefined();

    await expectInvariantsHold(env.DB);
  });

  it('filters slash commands by context', () => {
    const notepadCommands = getSlashCommandsForContext('notepad');
    expect(notepadCommands.some((c) => c.id === 'notepad')).toBe(true);
    expect(notepadCommands.some((c) => c.id === 'task')).toBe(true);
    expect(notepadCommands.some((c) => c.id === 'board')).toBe(true);
    expect(notepadCommands.some((c) => c.id === 'due')).toBe(false); // due is card/quickadd only
    expect(notepadCommands.some((c) => c.id === 'move')).toBe(false); // move is card only

    const cardCommands = getSlashCommandsForContext('card');
    expect(cardCommands.some((c) => c.id === 'due')).toBe(true);
    expect(cardCommands.some((c) => c.id === 'priority')).toBe(true);
    expect(cardCommands.some((c) => c.id === 'move')).toBe(true);
    expect(cardCommands.some((c) => c.id === 'board')).toBe(false);

    const quickaddCommands = getSlashCommandsForContext('quickadd');
    expect(quickaddCommands.some((c) => c.id === 'notepad')).toBe(true);
    expect(quickaddCommands.some((c) => c.id === 'due')).toBe(true);
    expect(quickaddCommands.some((c) => c.id === 'priority')).toBe(true);
    expect(quickaddCommands.some((c) => c.id === 'assign')).toBe(true);
    expect(quickaddCommands.some((c) => c.id === 'tag')).toBe(true);
    expect(quickaddCommands.some((c) => c.id === 'move')).toBe(false);
  });

  it('returns strictly scoped suggestions from GET /api/suggest', async () => {
    // 1. Suggest users: returns Suggest Owner & Suggest Editor
    const userRes = await app.request(
      'http://localhost/api/suggest?type=user&q=Suggest',
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(userRes.status).toBe(200);
    const users = (await userRes.json()) as Array<{ label: string }>;
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(users.some((u) => u.label === 'Suggest Owner')).toBe(true);
    expect(users.some((u) => u.label === 'Suggest Editor')).toBe(true);

    // 2. Suggest notepads: returns welcome notepad or project notepads
    const npRes = await app.request(
      `http://localhost/api/suggest?type=notepad&projectId=${projectId}&q=`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(npRes.status).toBe(200);
    const notepads = (await npRes.json()) as Array<{ label: string; kind: string }>;
    expect(notepads.length).toBeGreaterThanOrEqual(1);
    expect(notepads[0]?.kind).toBe('notepad');

    // 3. Suggest tags: returns 'frontend'
    const tagSuggestRes = await app.request(
      `http://localhost/api/suggest?type=tag&projectId=${projectId}&q=front`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(tagSuggestRes.status).toBe(200);
    const tags = (await tagSuggestRes.json()) as Array<{ label: string }>;
    expect(tags.length).toBe(1);
    expect(tags[0]?.label).toBe('frontend');
  });

  it('quick-add with /notepad atomically creates card, linked notepad and card body link block', async () => {
    const res = await app.request(
      `http://localhost/api/columns/${columnId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({
          title: 'Design API Specs',
          priority: 'urgent',
          notepad: { mode: 'new' },
        }),
      },
      env,
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as {
      cardId: string;
      notepadId: string;
      linkedNotepadId: string | null;
    };
    expect(data.cardId).toBeDefined();
    expect(data.linkedNotepadId).toBeDefined();

    // Verify card notepad body contains the notepadLink block pointing to linkedNotepadId
    const cardDetail = await app.request(
      `http://localhost/api/cards/${data.cardId}`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(cardDetail.status).toBe(200);
    const card = (await cardDetail.json()) as { content: string };
    expect(card.content).toContain('notepadLink');
    expect(card.content).toContain(data.linkedNotepadId);

    // Verify linked notepad exists in project
    const linkedNotepadRes = await app.request(
      `http://localhost/api/notepads/${data.linkedNotepadId}`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    expect(linkedNotepadRes.status).toBe(200);
    const linkedNotepad = (await linkedNotepadRes.json()) as { title: string };
    expect(linkedNotepad.title).toBe('Design API Specs');

    await expectInvariantsHold(env.DB);
  });

  it('updates card metadata from card body context', async () => {
    // Create card
    const cRes = await app.request(
      `http://localhost/api/columns/${columnId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({ title: 'Task to update' }),
      },
      env,
    );
    const cData = (await cRes.json()) as { cardId: string };

    // Update due date and priority via PATCH /api/cards/:id
    const dueTime = Date.now() + 172800000;
    const patchRes = await app.request(
      `http://localhost/api/cards/${cData.cardId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: editorCookie },
        body: JSON.stringify({
          priority: 'high',
          dueDate: dueTime,
          tagIds: [tagId],
          assigneeIds: [editorUserId],
        }),
      },
      env,
    );
    expect(patchRes.status).toBe(200);

    const updated = await app.request(
      `http://localhost/api/cards/${cData.cardId}`,
      { headers: { Cookie: editorCookie } },
      env,
    );
    const card = (await updated.json()) as {
      priority: string;
      dueDate: number;
      assignees: Array<{ userId: string }>;
      tags: Array<{ id: string }>;
    };
    expect(card.priority).toBe('high');
    expect(card.dueDate).toBe(dueTime);
    expect(card.assignees[0]?.userId).toBe(editorUserId);
    expect(card.tags[0]?.id).toBe(tagId);

    await expectInvariantsHold(env.DB);
  });
});
