import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import type { SearchHit } from '../../src/worker/adapters/search/types';

const app = createWorkerApp(env);

describe('GET /api/search endpoint contract', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let cookie = '';
  let projectId = '';
  let boardId = '';
  let cardId = '';
  let cardNotepadId = '';
  let plainNotepadId = '';
  let tagId = '';

  beforeAll(async () => {
    // 1. Sign up user
    const userRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'search-endpoint-test@example.com',
          password: 'password123',
          name: 'Search Tester',
          bootstrapToken,
        }),
      },
      env,
    );
    expect(userRes.status).toBe(200);
    cookie = userRes.headers.get('set-cookie')!;

    const meRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: cookie } },
      env,
    );
    const me = (await meRes.json()) as { lastProjectId: string };
    projectId = me.lastProjectId;
    expect(projectId).toBeDefined();

    // 2. Create Tag "#bug"
    const tagRes = await app.request(
      `http://localhost/api/projects/${projectId}/tags`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ name: 'bug', color: '#ef4444' }),
      },
      env,
    );
    expect(tagRes.status).toBe(201);
    const tag = (await tagRes.json()) as { id: string; name: string };
    tagId = tag.id;

    // 3. Create Board and retrieve first column
    const boardRes = await app.request(
      `http://localhost/api/projects/${projectId}/boards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ name: 'Sprint Board' }),
      },
      env,
    );
    expect(boardRes.status).toBe(201);
    const b = (await boardRes.json()) as { id: string };
    boardId = b.id;

    const boardDetailRes = await app.request(
      `http://localhost/api/boards/${boardId}`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(boardDetailRes.status).toBe(200);
    const boardDetail = (await boardDetailRes.json()) as {
      columns: Array<{ id: string; name: string }>;
    };
    const colId = boardDetail.columns[0]!.id;

    // 4. Create Card with #bug tag
    const cardRes = await app.request(
      `http://localhost/api/columns/${colId}/cards`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          title: 'Crash on login page',
          priority: 'high',
          tagIds: [tagId],
        }),
      },
      env,
    );
    expect(cardRes.status).toBe(201);
    const cData = (await cardRes.json()) as { cardId: string; notepadId: string };
    cardId = cData.cardId;
    cardNotepadId = cData.notepadId;

    // 5. Create Plain Notepad tagged with #bug
    const npRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'Bug triage meeting notes' }),
      },
      env,
    );
    expect(npRes.status).toBe(201);
    const np = (await npRes.json()) as { id: string };
    plainNotepadId = np.id;

    const tagAttachRes = await app.request(
      `http://localhost/api/notepads/${plainNotepadId}/tags`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ tagIds: [tagId] }),
      },
      env,
    );
    expect(tagAttachRes.status).toBe(200);
  });

  it('searching #bug finds both notepads and cards tagged #bug', async () => {
    const res = await app.request(
      `http://localhost/api/search?q=${encodeURIComponent('#bug')}&projectId=${projectId}&scope=project`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(res.status).toBe(200);
    const hits = (await res.json()) as SearchHit[];

    const cardHit = hits.find((h) => h.id === cardNotepadId);
    expect(cardHit).toBeDefined();
    expect(cardHit?.title).toBe('Crash on login page');
    expect(cardHit?.kind).toBe('card');

    const notepadHit = hits.find((h) => h.id === plainNotepadId);
    expect(notepadHit).toBeDefined();
    expect(notepadHit?.title).toBe('Bug triage meeting notes');
    expect(notepadHit?.kind).toBe('notepad');
  });

  it('card search results include cardId and boardId', async () => {
    // Search by card title
    const res = await app.request(
      `http://localhost/api/search?q=Crash&projectId=${projectId}&scope=project`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(res.status).toBe(200);
    const hits = (await res.json()) as SearchHit[];

    const cardHit = hits.find((h) => h.id === cardNotepadId);
    expect(cardHit).toBeDefined();
    expect(cardHit?.kind).toBe('card');
    expect(cardHit?.cardId).toBe(cardId);
    expect(cardHit?.boardId).toBe(boardId);

    // Regular notepad should not have cardId or boardId
    const npRes = await app.request(
      `http://localhost/api/search?q=triage&projectId=${projectId}&scope=project`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(npRes.status).toBe(200);
    const npHits = (await npRes.json()) as SearchHit[];
    const npHit = npHits.find((h) => h.id === plainNotepadId);
    expect(npHit).toBeDefined();
    expect(npHit?.kind).toBe('notepad');
    expect(npHit?.cardId).toBeUndefined();
    expect(npHit?.boardId).toBeUndefined();
  });
});
