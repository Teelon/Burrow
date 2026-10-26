/* eslint-disable no-console */
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';

interface LoggedQuery {
  id: number;
  sql: string;
  params: unknown[];
  durationMs: number;
  rowsRead: number;
  rowsWritten: number;
  caller: string;
  isBatch?: boolean;
  batchCount?: number;
}

describe('Detailed D1 Query Measurement', () => {
  it('measures all notepad edit scenarios and reports queries', async () => {
    let queryCounter = 0;
    const queryLog: LoggedQuery[] = [];
    let captureQueries = false;

    function getCaller(): string {
      const err = new Error();
      const lines = err.stack?.split('\n') || [];
      for (const line of lines) {
        if (
          line.includes('src/') &&
          !line.includes('measure-d1.test.ts') &&
          !line.includes('node_modules')
        ) {
          const match = line.match(/(src\/[^:)]+:\d+(?::\d+)?)/);
          if (match && match[1]) return match[1];
          return line.trim();
        }
      }
      return 'external/drizzle';
    }

    function wrapStmt(stmt: any, query: string, caller: string): any {
      let boundParams: unknown[] = [];
      return new Proxy(stmt, {
        get(stmtTarget, stmtProp) {
          if (stmtProp === 'bind') {
            return (...args: unknown[]) => {
              boundParams = args;
              const bound = stmtTarget.bind(...args);
              return wrapStmt(bound, query, caller);
            };
          }
          if (
            stmtProp === 'run' ||
            stmtProp === 'all' ||
            stmtProp === 'first' ||
            stmtProp === 'raw'
          ) {
            return async (...args: unknown[]) => {
              const start = performance.now();
              const res = await (stmtTarget as any)[stmtProp](...args);
              const durationMs = performance.now() - start;
              if (captureQueries) {
                queryCounter++;
                queryLog.push({
                  id: queryCounter,
                  sql: query,
                  params: boundParams,
                  durationMs: Math.round(durationMs * 100) / 100,
                  rowsRead: res?.meta?.rows_read ?? (Array.isArray(res) ? res.length : (res?.results?.length ?? 0)),
                  rowsWritten: res?.meta?.rows_written ?? 0,
                  caller,
                });
              }
              return res;
            };
          }
          return Reflect.get(stmtTarget, stmtProp);
        },
      });
    }

    function wrapD1(db: D1Database): D1Database {
      return new Proxy(db, {
        get(target, prop, receiver) {
          if (prop === 'prepare') {
            return (query: string) => {
              const caller = getCaller();
              const stmt = target.prepare(query);
              return wrapStmt(stmt, query, caller);
            };
          }
          if (prop === 'batch') {
            return async (statements: any[]) => {
              const caller = getCaller();
              const start = performance.now();
              const res = await target.batch(statements);
              const durationMs = performance.now() - start;
              if (captureQueries) {
                queryCounter++;
                const rowsRead = res?.reduce((acc: number, r: any) => acc + (r?.meta?.rows_read ?? 0), 0) ?? 0;
                const rowsWritten = res?.reduce((acc: number, r: any) => acc + (r?.meta?.rows_written ?? 0), 0) ?? 0;
                queryLog.push({
                  id: queryCounter,
                  sql: `D1 BATCH (${statements.length} stmts)`,
                  params: [],
                  durationMs: Math.round(durationMs * 100) / 100,
                  rowsRead,
                  rowsWritten,
                  caller,
                  isBatch: true,
                  batchCount: statements.length,
                });
              }
              return res;
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      });
    }

    const wrappedDb = wrapD1(env.DB);
    const app = createWorkerApp({ ...env, DB: wrappedDb });

    // Setup: Sign up owner, get cookie and projectId
    const signUpRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'investigation-owner@example.com',
          password: 'password123',
          name: 'Owner',
          bootstrapToken: 'test-bootstrap-token',
        }),
      },
      env,
    );
    expect(signUpRes.status).toBe(200);
    const setCookieHeaders = signUpRes.headers.getSetCookie
      ? signUpRes.headers.getSetCookie()
      : [signUpRes.headers.get('set-cookie')!];
    const cookie = setCookieHeaders.map((c) => c.split(';')[0]).join('; ');

    const meRes = await app.request('http://localhost/api/me', { headers: { Cookie: cookie } }, env);
    const meData = (await meRes.json()) as any;
    const projectId = meData.lastProjectId;
    const userId = meData.user.id;

    // Create a notepad for testing
    const createRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          title: 'Investigation Notepad',
          content: '[]',
        }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    const notepadId = createData.id;

    console.log('Setup complete. Notepad ID:', notepadId, 'Project ID:', projectId);

    function startCapture(scenario: string) {
      queryLog.length = 0;
      queryCounter = 0;
      captureQueries = true;
      console.log(`\n=================== SCENARIO: ${scenario} ===================`);
    }

    function stopCapture(): { total: number; rowsRead: number; rowsWritten: number; queries: LoggedQuery[] } {
      captureQueries = false;
      const total = queryLog.length;
      const rowsRead = queryLog.reduce((sum, q) => sum + q.rowsRead, 0);
      const rowsWritten = queryLog.reduce((sum, q) => sum + q.rowsWritten, 0);
      console.log(`Summary: ${total} queries, rowsRead=${rowsRead}, rowsWritten=${rowsWritten}`);
      for (const q of queryLog) {
        console.log(`  [${q.id}] ${q.caller} | R:${q.rowsRead} W:${q.rowsWritten} | ${q.sql.slice(0, 100)}`);
      }
      return { total, rowsRead, rowsWritten, queries: [...queryLog] };
    }

    // Scenario F: Opening a notepad (read path)
    startCapture('F: Opening a notepad (read path: GET /notepad/:id + GET /projects/:pid/notepads)');
    const openRes = await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(openRes.status).toBe(200);
    const treeRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(treeRes.status).toBe(200);
    const reportF = stopCapture();

    // Scenario E: One lock heartbeat
    startCapture('E: One lock heartbeat (POST /api/notepads/:id/lock)');
    const lockRes = await app.request(
      `http://localhost/api/notepads/${notepadId}/lock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ clientId: 'client-1' }),
      },
      env,
    );
    expect(lockRes.status).toBe(200);
    const reportE = stopCapture();

    // Scenario A: Change title only
    startCapture('A: Change title only (PATCH /notepad/:id + tree invalidation GET /projects/:pid/notepads)');
    const patchTitleRes = await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'New Notepad Title' }),
      },
      env,
    );
    expect(patchTitleRes.status).toBe(200);
    const refreshTreeRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(refreshTreeRes.status).toBe(200);
    const reportA = stopCapture();

    // Scenario B: Type a few words in the body (content save endpoint directly)
    startCapture('B: Type a few words in body (PUT /notepads/:id/content)');
    const bodyContent = JSON.stringify([
      {
        id: 'block-1',
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: 'Hello world, typing a few words.', styles: {} }],
        children: [],
      },
    ]);
    const saveContentRes = await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          content: bodyContent,
          baseVersion: 1,
          clientId: 'client-1',
        }),
      },
      env,
    );
    expect(saveContentRes.status).toBe(200);
    const reportB = stopCapture();

    // Scenario C: Title + body together
    startCapture('C: Title + body together');
    const bodyContent2 = JSON.stringify([
      {
        id: 'block-1',
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: 'Hello world, typing even more words here.', styles: {} }],
        children: [],
      },
    ]);
    await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'Title and Body Edit' }),
      },
      env,
    );
    await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      { headers: { Cookie: cookie } },
      env,
    );
    await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          content: bodyContent2,
          baseVersion: 2,
          clientId: 'client-1',
        }),
      },
      env,
    );
    const reportC = stopCapture();

    // Scenario D: One full autosave cycle as experienced by client
    startCapture('D: Full autosave cycle (focus lock claim -> body save -> blur release)');
    const bodyContent3 = JSON.stringify([
      {
        id: 'block-1',
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: 'Full cycle edit content test.', styles: {} }],
        children: [],
      },
    ]);
    await app.request(
      `http://localhost/api/notepads/${notepadId}/lock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ clientId: 'client-1' }),
      },
      env,
    );
    await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          content: bodyContent3,
          baseVersion: 3,
          clientId: 'client-1',
        }),
      },
      env,
    );
    await app.request(
      `http://localhost/api/notepads/${notepadId}/lock`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ clientId: 'client-1' }),
      },
      env,
    );
    const reportD = stopCapture();

    // Scenario G: Mention / Slash / Linked Record handling
    startCapture('G: @ mention typing (/api/suggest x 3)');
    await app.request(`http://localhost/api/suggest?type=user&q=test`, { headers: { Cookie: cookie } }, env);
    await app.request(`http://localhost/api/suggest?type=notepad&projectId=${projectId}&q=test`, { headers: { Cookie: cookie } }, env);
    await app.request(`http://localhost/api/suggest?type=card&projectId=${projectId}&q=test`, { headers: { Cookie: cookie } }, env);
    const reportG = stopCapture();

    // Scenario H: Saving content with mentions and links
    startCapture('H: Saving content with 1 user mention + 1 notepad link');
    const contentWithLinks = JSON.stringify([
      {
        id: 'b-link',
        type: 'paragraph',
        content: [
          { type: 'mention', props: { kind: 'user', id: userId, label: 'Owner' } },
          { type: 'text', text: ' check ' },
          { type: 'mention', props: { kind: 'notepad', id: notepadId, label: 'Self' } },
        ],
      },
    ]);
    await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          content: contentWithLinks,
          baseVersion: 4,
          clientId: 'client-1',
        }),
      },
      env,
    );
    const reportH = stopCapture();

    console.log('\n=================== FINAL TOTALS ===================');
    console.log(`Scenario A (Title only): ${reportA.total} queries`);
    console.log(`Scenario B (Body save PUT only): ${reportB.total} queries`);
    console.log(`Scenario C (Title + body + tree invalidation): ${reportC.total} queries`);
    console.log(`Scenario D (Autosave cycle focus+save+blur): ${reportD.total} queries`);
    console.log(`Scenario E (Lock heartbeat): ${reportE.total} queries`);
    console.log(`Scenario F (Open notepad read path): ${reportF.total} queries`);
    console.log(`Scenario G (@ Mention suggestions): ${reportG.total} queries`);
    console.log(`Scenario H (Save with mentions & links): ${reportH.total} queries`);
  });
});

