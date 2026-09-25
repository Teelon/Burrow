import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import { expectInvariantsHold } from './helpers';

const app = createWorkerApp(env);

type TreeNode = {
  id: string;
  parentId: string | null;
  title: string;
  icon: string | null;
  position: string;
  isFavorite: boolean | number;
};

async function getTree(projectId: string, cookie: string): Promise<TreeNode[]> {
  const res = await app.request(
    `http://localhost/api/projects/${projectId}/notepads`,
    { headers: { Cookie: cookie } },
    env,
  );
  expect(res.status).toBe(200);
  const data = (await res.json()) as TreeNode[] | { notepads: TreeNode[] };
  return Array.isArray(data) ? data : data.notepads;
}

describe('Notepad tree excludes soft-deleted and card-kind notepads', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';
  let projectId = '';
  let parentId = '';
  let childId = '';

  it('sets up owner with a parent + child notepad, both visible in the tree', async () => {
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'tree-owner@example.com',
          password: 'password123',
          name: 'Tree Owner',
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
    const me = (await meRes.json()) as { lastProjectId: string };
    projectId = me.lastProjectId;
    expect(projectId).toBeDefined();

    const pRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Tree Parent' }),
      },
      env,
    );
    expect(pRes.status).toBe(201);
    parentId = ((await pRes.json()) as { id: string }).id;

    const cRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ parentId, title: 'Tree Child' }),
      },
      env,
    );
    expect(cRes.status).toBe(201);
    childId = ((await cRes.json()) as { id: string }).id;

    const tree = await getTree(projectId, ownerCookie);
    const parent = tree.find((n) => n.id === parentId);
    const child = tree.find((n) => n.id === childId);
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
    // Expected shape
    for (const node of [parent!, child!]) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('parentId');
      expect(node).toHaveProperty('title');
      expect(node).toHaveProperty('icon');
      expect(node).toHaveProperty('position');
      expect(node).toHaveProperty('isFavorite');
    }
    expect(child!.parentId).toBe(parentId);
  });

  it('excludes a soft-deleted child from the tree but keeps the parent', async () => {
    const delRes = await app.request(
      `http://localhost/api/notepads/${childId}`,
      { method: 'DELETE', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(delRes.status).toBe(200);

    const tree = await getTree(projectId, ownerCookie);
    expect(tree.find((n) => n.id === childId)).toBeUndefined();
    expect(tree.find((n) => n.id === parentId)).toBeDefined();
  });

  it('lists the deleted child in trash, restores it, and shows it in the tree again', async () => {
    const trashRes = await app.request(
      `http://localhost/api/projects/${projectId}/trash`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(trashRes.status).toBe(200);
    const trash = (await trashRes.json()) as { notepads: Array<{ id: string }> };
    expect(trash.notepads.some((n) => n.id === childId)).toBe(true);

    const restoreRes = await app.request(
      `http://localhost/api/notepads/${childId}/restore`,
      { method: 'POST', headers: { Cookie: ownerCookie } },
      env,
    );
    expect(restoreRes.status).toBe(200);

    const tree = await getTree(projectId, ownerCookie);
    expect(tree.find((n) => n.id === childId)).toBeDefined();
    expect(tree.find((n) => n.id === parentId)).toBeDefined();

    await expectInvariantsHold(env.DB);
  });

  it('excludes card-kind notepads from the tree', async () => {
    const boardRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ name: 'Tree Board' }),
      },
      env,
    );
    expect(boardRes.status).toBe(201);
    const board = (await boardRes.json()) as { id: string };

    const boardDetailRes = await app.request(
      `http://localhost/api/boards/${board.id}`,
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(boardDetailRes.status).toBe(200);
    const detail = (await boardDetailRes.json()) as { columns: Array<{ id: string }> };
    const columnId = detail.columns[0]!.id;

    const cardRes = await app.request(
      `http://localhost/api/columns/${columnId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
        body: JSON.stringify({ title: 'Tree Card' }),
      },
      env,
    );
    expect(cardRes.status).toBe(201);
    const card = (await cardRes.json()) as {
      cardId: string;
      notepadId?: string;
      linkedNotepadId?: string | null;
    };
    const cardNotepadId = card.notepadId ?? card.linkedNotepadId;
    expect(cardNotepadId).toBeDefined();

    const tree = await getTree(projectId, ownerCookie);
    expect(tree.find((n) => n.id === cardNotepadId)).toBeUndefined();
    // Regular notepads are still present
    expect(tree.find((n) => n.id === parentId)).toBeDefined();
    expect(tree.find((n) => n.id === childId)).toBeDefined();

    await expectInvariantsHold(env.DB);
  });
});
