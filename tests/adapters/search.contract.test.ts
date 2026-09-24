import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { SqliteFtsSearchAdapter } from '../../src/worker/adapters/search/sqlite-fts';
import { createDb } from '../../src/worker/db/client';
import * as schema from '../../src/worker/db/schema';

/** Unique FTS-safe token: lowercase hex run, matched via FTS5 prefix search. */
function token(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

describe('SqliteFtsSearchAdapter contract', () => {
  let ws1 = '';
  let proj1 = '';
  let ws2 = '';
  let proj2 = '';
  let proj3 = '';

  beforeAll(async () => {
    const db = createDb(env.DB);
    ws1 = crypto.randomUUID();
    proj1 = crypto.randomUUID();
    ws2 = crypto.randomUUID();
    proj2 = crypto.randomUUID();
    proj3 = crypto.randomUUID();
    const now = Date.now();
    for (const id of [ws1, ws2]) {
      await db.insert(schema.workspaces).values({
        id,
        name: `search-contract-ws-${id}`,
        createdBy: 'search-contract-user',
        createdAt: now,
      });
    }
    for (const [id, workspaceId] of [
      [proj1, ws1],
      [proj2, ws2],
      [proj3, ws1],
    ] as Array<[string, string]>) {
      await db.insert(schema.projects).values({
        id,
        workspaceId,
        name: `search-contract-project-${id}`,
        position: 'a0',
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  /** Insert the notepad row (indexing pulls project_id from it); no FTS row yet. */
  async function seedNotepad(
    workspaceId: string,
    projectId: string,
    title: string,
  ): Promise<string> {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.insert(schema.notepads).values({
      id,
      workspaceId,
      projectId,
      title,
      position: 'a0',
      createdBy: 'search-contract-user',
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  function searcher(): SqliteFtsSearchAdapter {
    return new SqliteFtsSearchAdapter(createDb(env.DB));
  }

  it('indexDocument makes the document searchable', async () => {
    const t = token();
    const title = `Quantum Overview ${t}`;
    const id = await seedNotepad(ws1, proj1, title);
    await searcher().indexDocument({
      id,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title,
      body: `Superposition enables parallel calculation ${t}`,
    });

    const hits = await searcher().search({ workspaceId: ws1, text: t });
    expect(hits.some((h) => h.id === id)).toBe(true);
  });

  it('matches multiple query terms (title term + body term)', async () => {
    const t1 = token();
    const t2 = token();
    const title = `Relativity primer ${t1}`;
    const id = await seedNotepad(ws1, proj1, title);
    await searcher().indexDocument({
      id,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title,
      body: `curved spacetime geodesics ${t2}`,
    });

    const hits = await searcher().search({ workspaceId: ws1, text: `${t1} ${t2}` });
    expect(hits.some((h) => h.id === id)).toBe(true);
  });

  it('isolates results by workspace', async () => {
    const t = token();
    const idA = await seedNotepad(ws1, proj1, `Workspace doc ${t}`);
    await searcher().indexDocument({
      id: idA,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title: `Workspace doc ${t}`,
      body: `shared content marker ${t}`,
    });
    const idB = await seedNotepad(ws2, proj2, `Other workspace doc ${t}`);
    await searcher().indexDocument({
      id: idB,
      workspaceId: ws2,
      projectId: proj2,
      kind: 'notepad',
      title: `Other workspace doc ${t}`,
      body: `shared content marker ${t}`,
    });

    const hitsW1 = await searcher().search({ workspaceId: ws1, text: t });
    expect(hitsW1.some((h) => h.id === idA)).toBe(true);
    expect(hitsW1.some((h) => h.id === idB)).toBe(false);

    const hitsW2 = await searcher().search({ workspaceId: ws2, text: t });
    expect(hitsW2.some((h) => h.id === idB)).toBe(true);
    expect(hitsW2.some((h) => h.id === idA)).toBe(false);
  });

  it('filters by projectId when provided', async () => {
    const t = token();
    const idP1 = await seedNotepad(ws1, proj1, `Project doc ${t}`);
    await searcher().indexDocument({
      id: idP1,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title: `Project doc ${t}`,
      body: `project filter marker ${t}`,
    });
    const idP3 = await seedNotepad(ws1, proj3, `Other project doc ${t}`);
    await searcher().indexDocument({
      id: idP3,
      workspaceId: ws1,
      projectId: proj3,
      kind: 'notepad',
      title: `Other project doc ${t}`,
      body: `project filter marker ${t}`,
    });

    const filtered = await searcher().search({
      workspaceId: ws1,
      projectId: proj1,
      text: t,
    });
    expect(filtered.some((h) => h.id === idP1)).toBe(true);
    expect(filtered.some((h) => h.id === idP3)).toBe(false);

    const unfiltered = await searcher().search({ workspaceId: ws1, text: t });
    expect(unfiltered.some((h) => h.id === idP1)).toBe(true);
    expect(unfiltered.some((h) => h.id === idP3)).toBe(true);
  });

  it('respects the limit', async () => {
    const t = token();
    for (let i = 0; i < 4; i += 1) {
      const id = await seedNotepad(ws1, proj1, `Limit doc ${i} ${t}`);
      await searcher().indexDocument({
        id,
        workspaceId: ws1,
        projectId: proj1,
        kind: 'notepad',
        title: `Limit doc ${i} ${t}`,
        body: `limit marker ${t} number ${i}`,
      });
    }

    const hits = await searcher().search({ workspaceId: ws1, text: t, limit: 2 });
    expect(hits).toHaveLength(2);
  });

  it('returns a non-empty snippet with hit metadata', async () => {
    const t = token();
    const title = `Snippet doc ${t}`;
    const id = await seedNotepad(ws1, proj1, title);
    await searcher().indexDocument({
      id,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title,
      body: `a long body so the snippet has material to quote ${t} with trailing words`,
    });

    const hits = await searcher().search({ workspaceId: ws1, text: t });
    expect(hits).toHaveLength(1);
    const hit = hits.find((h) => h.id === id);
    if (!hit) throw new Error('expected search hit');
    expect(typeof hit.snippet).toBe('string');
    expect(hit.snippet.length).toBeGreaterThan(0);
    expect(hit.title).toBe(title);
    expect(hit.projectId).toBe(proj1);
  });

  it('deleteDocument removes the document from results', async () => {
    const t = token();
    const id = await seedNotepad(ws1, proj1, `Ephemeral doc ${t}`);
    await searcher().indexDocument({
      id,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title: `Ephemeral doc ${t}`,
      body: `soon to be deleted ${t}`,
    });
    expect((await searcher().search({ workspaceId: ws1, text: t })).some((h) => h.id === id)).toBe(
      true,
    );

    await searcher().deleteDocument(id);

    const after = await searcher().search({ workspaceId: ws1, text: t });
    expect(after.some((h) => h.id === id)).toBe(false);
  });

  it('deleteByProject removes every document in the project only', async () => {
    const t = token();
    const ids: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const id = await seedNotepad(ws1, proj3, `Doomed doc ${i} ${t}`);
      await searcher().indexDocument({
        id,
        workspaceId: ws1,
        projectId: proj3,
        kind: 'notepad',
        title: `Doomed doc ${i} ${t}`,
        body: `project purge marker ${t} number ${i}`,
      });
      ids.push(id);
    }
    const controlToken = token();
    const controlId = await seedNotepad(ws1, proj1, `Control doc ${controlToken}`);
    await searcher().indexDocument({
      id: controlId,
      workspaceId: ws1,
      projectId: proj1,
      kind: 'notepad',
      title: `Control doc ${controlToken}`,
      body: `control marker ${controlToken}`,
    });

    await searcher().deleteByProject(proj3);

    const purged = await searcher().search({ workspaceId: ws1, text: t });
    for (const id of ids) {
      expect(purged.some((h) => h.id === id)).toBe(false);
    }
    const control = await searcher().search({
      workspaceId: ws1,
      text: controlToken,
    });
    expect(control.some((h) => h.id === controlId)).toBe(true);
  });
});
