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
}

export function createMeasuredWorkerApp(envBindings: any) {
  let queryCounter = 0;
  const queryLog: LoggedQuery[] = [];
  let captureQueries = false;

  function getCaller(): string {
    const err = new Error();
    const lines = err.stack?.split('\n') || [];
    for (const line of lines) {
      if (
        line.includes('src/') &&
        !line.includes('notepad-query-budget') &&
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
                rowsRead:
                  res?.meta?.rows_read ??
                  (Array.isArray(res) ? res.length : (res?.results?.length ?? 0)),
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
              const rowsRead =
                res?.reduce((acc: number, r: any) => acc + (r?.meta?.rows_read ?? 0), 0) ?? 0;
              const rowsWritten =
                res?.reduce((acc: number, r: any) => acc + (r?.meta?.rows_written ?? 0), 0) ?? 0;
              queryLog.push({
                id: queryCounter,
                sql: `D1 BATCH (${statements.length} stmts)`,
                params: [],
                durationMs: Math.round(durationMs * 100) / 100,
                rowsRead,
                rowsWritten,
                caller,
                isBatch: true,
              });
            }
            return res;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  const wrappedDb = wrapD1(envBindings.DB);
  const app = createWorkerApp({ ...envBindings, DB: wrappedDb });

  return {
    app,
    startCapture: () => {
      queryLog.length = 0;
      queryCounter = 0;
      captureQueries = true;
    },
    stopCapture: () => {
      captureQueries = false;
      return {
        count: queryLog.length,
        rowsRead: queryLog.reduce((s, q) => s + q.rowsRead, 0),
        rowsWritten: queryLog.reduce((s, q) => s + q.rowsWritten, 0),
        queries: [...queryLog],
      };
    },
  };
}

describe('D1 Query Budget Contract Tests', () => {
  it('enforces maximum query count budgets for notepad edit and read paths', async () => {
    const { app, startCapture, stopCapture } = createMeasuredWorkerApp(env);

    // Setup: Sign up owner, get session cookie
    const signUpRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'budget-contract-owner@example.com',
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

    const meRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: cookie } },
      env,
    );
    const meData = (await meRes.json()) as any;
    const projectId = meData.lastProjectId;

    // Create a notepad for testing
    const createRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          title: 'Budget Notepad',
          content: '[]',
        }),
      },
      env,
    );
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;
    const notepadId = createData.id;

    // -------------------------------------------------------------------------
    // Scenario F: Opening a notepad (read path)
    // Budget: <= 6 queries (GET notepad <= 4, GET tree <= 2)
    // -------------------------------------------------------------------------
    startCapture();
    const getRes = await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(getRes.status).toBe(200);
    const treeRes = await app.request(
      `http://localhost/api/projects/${projectId}/notepads`,
      { headers: { Cookie: cookie } },
      env,
    );
    expect(treeRes.status).toBe(200);
    const capF = stopCapture();
    expect(capF.count).toBeLessThanOrEqual(6);

    // -------------------------------------------------------------------------
    // Scenario E: Lock heartbeat
    // Budget: <= 2 queries (findById + upsert lock)
    // -------------------------------------------------------------------------
    startCapture();
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
    const capE = stopCapture();
    expect(capE.count).toBeLessThanOrEqual(2);

    // -------------------------------------------------------------------------
    // Scenario A: Change title only
    // Budget: <= 2 queries (findById + UPDATE)
    // -------------------------------------------------------------------------
    startCapture();
    const patchRes = await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'New Notepad Title' }),
      },
      env,
    );
    expect(patchRes.status).toBe(200);
    const capA = stopCapture();
    expect(capA.count).toBeLessThanOrEqual(2);

    // -------------------------------------------------------------------------
    // Scenario B: Type a few words in body (Content Save)
    // Budget: <= 4 queries (findById + lock check + listLinks + runBatch)
    // -------------------------------------------------------------------------
    const bodyContent = JSON.stringify([
      {
        id: 'b1',
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello world from test', styles: {} }],
      },
    ]);
    startCapture();
    const saveRes = await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: bodyContent, baseVersion: 1, clientId: 'client-1' }),
      },
      env,
    );
    expect(saveRes.status).toBe(200);
    const capB = stopCapture();
    expect(capB.count).toBeLessThanOrEqual(4);

    // -------------------------------------------------------------------------
    // Scenario C: Title + Body together
    // Budget: <= 6 queries (Title PATCH <= 2 + Content PUT <= 4)
    // -------------------------------------------------------------------------
    startCapture();
    const patchBothRes = await app.request(
      `http://localhost/api/notepads/${notepadId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ title: 'Second Notepad Title' }),
      },
      env,
    );
    expect(patchBothRes.status).toBe(200);
    const saveBothRes = await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: bodyContent, baseVersion: 2, clientId: 'client-1' }),
      },
      env,
    );
    expect(saveBothRes.status).toBe(200);
    const capC = stopCapture();
    expect(capC.count).toBeLessThanOrEqual(6);

    // -------------------------------------------------------------------------
    // Scenario D: One full autosave cycle (focus / claim lock + save content + blur release)
    // Budget: <= 8 queries (Lock acquire <= 2 + Content save <= 4 + Lock release <= 2)
    // -------------------------------------------------------------------------
    startCapture();
    const cycleLock = await app.request(
      `http://localhost/api/notepads/${notepadId}/lock`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ clientId: 'client-1' }),
      },
      env,
    );
    expect(cycleLock.status).toBe(200);
    const cycleSave = await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: bodyContent, baseVersion: 3, clientId: 'client-1' }),
      },
      env,
    );
    expect(cycleSave.status).toBe(200);
    const cycleRelease = await app.request(
      `http://localhost/api/notepads/${notepadId}/lock`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ clientId: 'client-1' }),
      },
      env,
    );
    expect(cycleRelease.status).toBe(200);
    const capD = stopCapture();
    expect(capD.count).toBeLessThanOrEqual(8);

    // -------------------------------------------------------------------------
    // Optimistic Version Conflict Verification
    // Stale baseVersion must fail with 409 conflict
    // -------------------------------------------------------------------------
    const conflictRes = await app.request(
      `http://localhost/api/notepads/${notepadId}/content`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: bodyContent, baseVersion: 1, clientId: 'client-1' }),
      },
      env,
    );
    expect(conflictRes.status).toBe(409);

    // -------------------------------------------------------------------------
    // Member Cache Verification & Logout Invalidation
    // -------------------------------------------------------------------------
    // While logged in, isolate member cache prevents querying members table
    startCapture();
    await app.request('http://localhost/api/me', { headers: { Cookie: cookie } }, env);
    const warmCap = stopCapture();
    const memberQueriesWarm = warmCap.queries.filter((q) => q.sql.includes('members'));
    expect(memberQueriesWarm.length).toBe(0);

    // Logout
    const signOutRes = await app.request(
      'http://localhost/api/auth/sign-out',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost',
          Cookie: cookie,
        },
      },
      env,
    );
    expect(signOutRes.status).toBe(200);

    // Verify Better Auth clears session cookies on logout
    const clearedCookies = signOutRes.headers.getSetCookie
      ? signOutRes.headers.getSetCookie()
      : [signOutRes.headers.get('set-cookie')!];
    expect(clearedCookies.some((c) => c.includes('Max-Age=0') || c.includes('1970'))).toBe(true);

    // Requests without cookie are 401 unauthorized
    const meAfterLogout = await app.request('http://localhost/api/me', {}, env);
    expect(meAfterLogout.status).toBe(401);
  });
});

