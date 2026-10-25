import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { createWorkerApp } from '../../src/worker/index';
import { createDb } from '../../src/worker/db/client';
import * as t from '../../src/worker/db/schema';
import { loadConfig } from '../../src/server/config';

const app = createWorkerApp(env);
const db = createDb(env.DB);

describe('Security Contract Suite', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';

  let ws1OwnerCookie = '';
  let ws1Id = '';
  let ws1ProjectId = '';

  let ws2Id = '';
  let ws2ProjectId = '';
  let ws2OwnerUserId = '';
  let ws2OwnerCookie = '';
  let ws2NotepadId = '';

  it('rejects direct sign-up with trailing slash without valid bootstrap token (403 Forbidden)', async () => {
    const res = await app.request(
      'http://localhost/api/auth/sign-up/email/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'direct-bypass@example.com',
          password: 'password123',
          name: 'Direct Bypass',
        }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it('sets up Workspace 1 with Owner and Project', async () => {
    const signupRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ws1-owner@example.com',
          password: 'password123',
          name: 'Workspace 1 Owner',
          bootstrapToken,
        }),
      },
      env,
    );
    expect(signupRes.status).toBe(200);
    ws1OwnerCookie = signupRes.headers.get('set-cookie')!;
    expect(ws1OwnerCookie).toBeTruthy();

    const [ws1] = await db.select().from(t.workspaces);
    expect(ws1).toBeDefined();
    ws1Id = ws1!.id;
    expect(ws1Id).toBeTruthy();

    const [proj1] = await db.select().from(t.projects);
    expect(proj1).toBeDefined();
    ws1ProjectId = proj1!.id;
    expect(ws1ProjectId).toBeTruthy();
  });

  it('sets up Workspace 2 with a separate project and resources in database', async () => {
    ws2Id = `ws2-${nanoid()}`;
    ws2ProjectId = `proj2-${nanoid()}`;

    // 1. Create an invite from WS1 to register ws2 owner with better-auth
    const inviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ws1OwnerCookie,
        },
        body: JSON.stringify({
          email: 'ws2-owner@example.com',
          role: 'editor',
        }),
      },
      env,
    );
    expect(inviteRes.status).toBe(200);
    const { token: ws2InviteToken } = (await inviteRes.json()) as { token: string };

    const signup2Res = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ws2-owner@example.com',
          password: 'password123',
          name: 'Workspace 2 User',
          inviteToken: ws2InviteToken,
        }),
      },
      env,
    );
    expect(signup2Res.status).toBe(200);
    ws2OwnerCookie = signup2Res.headers.get('set-cookie')!;
    expect(ws2OwnerCookie).toBeTruthy();

    const [user2] = await db
      .select()
      .from(t.user)
      .where(eq(t.user.email, 'ws2-owner@example.com'));
    expect(user2).toBeDefined();
    ws2OwnerUserId = user2!.id;

    const now = Date.now();

    // Create Workspace 2
    await db.insert(t.workspaces).values({
      id: ws2Id,
      name: 'Workspace 2',
      createdBy: ws2OwnerUserId,
      createdAt: now,
    });

    // Move User 2 member record to Workspace 2 as owner
    await db
      .update(t.members)
      .set({ workspaceId: ws2Id, role: 'owner' })
      .where(eq(t.members.userId, ws2OwnerUserId));

    // Create Project 2 under Workspace 2
    await db.insert(t.projects).values({
      id: ws2ProjectId,
      workspaceId: ws2Id,
      name: 'Workspace 2 Confidential Project',
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });

    // Create a notepad under Project 2
    ws2NotepadId = `pad2-${nanoid()}`;
    await db.insert(t.notepads).values({
      id: ws2NotepadId,
      workspaceId: ws2Id,
      projectId: ws2ProjectId,
      parentId: null,
      title: 'Confidential Notes',
      createdBy: ws2OwnerUserId,
      position: 'a0',
      kind: 'notepad',
      content: '[]',
      version: 1,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create a board under Project 2
    await db.insert(t.boards).values({
      id: `board2-${nanoid()}`,
      workspaceId: ws2Id,
      projectId: ws2ProjectId,
      name: 'Confidential Board',
      position: 'a0',
      createdAt: now,
      updatedAt: now,
    });
  });

  describe('IDOR Protection on Project Routes', () => {
    it('user in Workspace 1 requesting GET /api/projects/:pid/notepads for Workspace 2 receives 404', async () => {
      const res = await app.request(
        `http://localhost/api/projects/${ws2ProjectId}/notepads`,
        {
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('user in Workspace 1 requesting GET /api/projects/:pid/recent for Workspace 2 receives 404', async () => {
      const res = await app.request(
        `http://localhost/api/projects/${ws2ProjectId}/recent`,
        {
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('user in Workspace 1 requesting GET /api/projects/:pid/boards for Workspace 2 receives 404', async () => {
      const res = await app.request(
        `http://localhost/api/projects/${ws2ProjectId}/boards`,
        {
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('user in Workspace 1 requesting POST /api/projects/:pid/notepads for Workspace 2 receives 404', async () => {
      const res = await app.request(
        `http://localhost/api/projects/${ws2ProjectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Malicious Injected Notepad',
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('user in Workspace 1 requesting POST /api/projects/:pid/boards for Workspace 2 receives 404', async () => {
      const res = await app.request(
        `http://localhost/api/projects/${ws2ProjectId}/boards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            name: 'Malicious Injected Board',
          }),
        },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('user in Workspace 1 requesting GET /api/suggest?projectId=:pid for Workspace 2 returns empty []', async () => {
      const res = await app.request(
        `http://localhost/api/suggest?projectId=${ws2ProjectId}&type=notepad&q=Confidential`,
        {
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });
  });

  describe('Cross-Workspace Backlinks & Parent Attachment Isolation', () => {
    it('prevents cross-workspace backlinks leakage (WS1 mention does not appear in WS2 backlinks)', async () => {
      // Create notepad in WS1
      const ws1NoteRes = await app.request(
        `http://localhost/api/projects/${ws1ProjectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'WS1 Note Mentioning WS2',
          }),
        },
        env,
      );
      expect(ws1NoteRes.status).toBe(201);
      const { id: ws1NoteId } = (await ws1NoteRes.json()) as { id: string };

      // Mention/link WS2 notepad ID in WS1 notepad content
      const contentWithWs2Link = JSON.stringify([
        {
          type: 'paragraph',
          content: [
            {
              type: 'mention',
              props: {
                kind: 'notepad',
                id: ws2NotepadId,
                label: 'Confidential Notes',
              },
            },
          ],
        },
      ]);

      const saveRes = await app.request(
        `http://localhost/api/notepads/${ws1NoteId}/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            content: contentWithWs2Link,
            baseVersion: 1,
          }),
        },
        env,
      );
      expect(saveRes.status).toBe(200);

      // Fetch WS2 notepad via GET /api/notepads/:id in WS2 session
      const ws2GetRes = await app.request(
        `http://localhost/api/notepads/${ws2NotepadId}`,
        {
          headers: { Cookie: ws2OwnerCookie },
        },
        env,
      );
      expect(ws2GetRes.status).toBe(200);
      const ws2Data = (await ws2GetRes.json()) as { backlinks: unknown[] };
      // Assert backlinks array in the response is empty (WS1 mention does NOT leak into WS2 backlinks)
      expect(ws2Data.backlinks).toEqual([]);
    });

    it('rejects cross-workspace parentId on notepad creation (404/400)', async () => {
      // Attempt POST /api/projects/:pid/notepads in WS1 with parentId belonging to WS2
      const crossParentRes = await app.request(
        `http://localhost/api/projects/${ws1ProjectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Malicious Child Notepad Attached to WS2 Parent',
            parentId: ws2NotepadId,
          }),
        },
        env,
      );
      expect([400, 404]).toContain(crossParentRes.status);
    });
  });

  describe('Soft-Deleted Notepad Mutation Rejection', () => {
    let trashedNotepadId = '';

    it('creates and soft-deletes (trashes) a notepad', async () => {
      const createRes = await app.request(
        `http://localhost/api/projects/${ws1ProjectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Notepad to Trash',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(201);
      const data = (await createRes.json()) as { id: string };
      trashedNotepadId = data.id;

      // Soft delete it
      const deleteRes = await app.request(
        `http://localhost/api/notepads/${trashedNotepadId}`,
        {
          method: 'DELETE',
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(deleteRes.status).toBe(200);
    });

    it('rejects PATCH /api/notepads/:id with 400 notepad_deleted', async () => {
      const res = await app.request(
        `http://localhost/api/notepads/${trashedNotepadId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Mutated Trashed Title',
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('notepad_deleted');
    });

    it('rejects PUT /api/notepads/:id/content with 400 notepad_deleted', async () => {
      const res = await app.request(
        `http://localhost/api/notepads/${trashedNotepadId}/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            content: '[]',
            baseVersion: 1,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('notepad_deleted');
    });

    it('rejects PUT /api/notepads/:id/tags with 400 notepad_deleted', async () => {
      const res = await app.request(
        `http://localhost/api/notepads/${trashedNotepadId}/tags`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            tagIds: [],
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('notepad_deleted');
    });
  });

  describe('Soft-Deleted Card Mutation Rejection', () => {
    let boardId = '';
    let colId1 = '';
    let colId2 = '';
    let trashedCardId = '';

    it('creates board, columns, card and soft-deletes the card', async () => {
      const boardRes = await app.request(
        `http://localhost/api/projects/${ws1ProjectId}/boards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({ name: 'Card Security Board' }),
        },
        env,
      );
      expect(boardRes.status).toBe(201);
      const boardData = (await boardRes.json()) as { id: string };
      boardId = boardData.id;

      const col1Res = await app.request(
        `http://localhost/api/boards/${boardId}/columns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({ name: 'Column 1' }),
        },
        env,
      );
      expect(col1Res.status).toBe(201);
      const col1Data = (await col1Res.json()) as { id: string };
      colId1 = col1Data.id;

      const col2Res = await app.request(
        `http://localhost/api/boards/${boardId}/columns`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({ name: 'Column 2' }),
        },
        env,
      );
      expect(col2Res.status).toBe(201);
      const col2Data = (await col2Res.json()) as { id: string };
      colId2 = col2Data.id;

      const cardRes = await app.request(
        `http://localhost/api/columns/${colId1}/cards`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Card To Soft Delete',
          }),
        },
        env,
      );
      expect(cardRes.status).toBe(201);
      const cardData = (await cardRes.json()) as { cardId: string };
      trashedCardId = cardData.cardId;

      const delRes = await app.request(
        `http://localhost/api/cards/${trashedCardId}`,
        {
          method: 'DELETE',
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(delRes.status).toBe(200);
    });

    it('rejects attempting to PATCH /api/cards/:id on a soft-deleted card with 400 card_deleted', async () => {
      const res = await app.request(
        `http://localhost/api/cards/${trashedCardId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            title: 'Mutated Trashed Card Title',
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: { code: string; message: string } | string };
      const code = typeof data.error === 'object' && data.error ? data.error.code : data.error;
      expect(code).toBe('card_deleted');
    });

    it('rejects attempting to move a soft-deleted card with 400 card_deleted', async () => {
      const res = await app.request(
        `http://localhost/api/cards/${trashedCardId}/move`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            columnId: colId2,
          }),
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as { error: { code: string; message: string } | string };
      const code = typeof data.error === 'object' && data.error ? data.error.code : data.error;
      expect(code).toBe('card_deleted');
    });
  });

  describe('Invites Security & Token Protection', () => {
    let inviteToken = '';
    const inviteEmail = 'contract-invitee@example.com';

    it('creates an invite and verifies GET /api/invites does not leak tokenHash', async () => {
      const createRes = await app.request(
        'http://localhost/api/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            email: inviteEmail,
            role: 'editor',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(200);
      const created = (await createRes.json()) as { token: string };
      inviteToken = created.token;
      expect(inviteToken).toBeTruthy();

      const listRes = await app.request(
        'http://localhost/api/invites',
        {
          headers: { Cookie: ws1OwnerCookie },
        },
        env,
      );
      expect(listRes.status).toBe(200);
      const invites = (await listRes.json()) as Array<Record<string, unknown>>;
      expect(invites.length).toBeGreaterThanOrEqual(1);

      for (const inv of invites) {
        expect(inv).not.toHaveProperty('tokenHash');
        expect(inv.tokenHash).toBeUndefined();
      }
    });

    it('rejects invite acceptance with mismatched email', async () => {
      // 1. Trying to sign up with different email using this inviteToken
      const signupMismatchRes = await app.request(
        'http://localhost/api/auth/sign-up/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'attacker-different@example.com',
            password: 'password123',
            name: 'Attacker',
            inviteToken,
          }),
        },
        env,
      );
      // Mismatched email should be rejected (400 or 403)
      expect(signupMismatchRes.status).toBeGreaterThanOrEqual(400);

      // 2. Or existing user with different email accepting via /api/invites/accept
      // ws1Owner email is ws1-owner@example.com, which does not match inviteEmail
      const acceptMismatchRes = await app.request(
        'http://localhost/api/invites/accept',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            token: inviteToken,
          }),
        },
        env,
      );
      expect(acceptMismatchRes.status).toBeGreaterThanOrEqual(400);
    });

    it('enforces single-use invite tokens: second attempt returns 400', async () => {
      // First acceptance with correct email
      const firstRes = await app.request(
        'http://localhost/api/auth/sign-up/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: inviteEmail,
            password: 'password123',
            name: 'Invited Member',
            inviteToken,
          }),
        },
        env,
      );
      expect(firstRes.status).toBe(200);

      // Second acceptance attempt with the same token via /api/invites/accept
      const secondRes = await app.request(
        'http://localhost/api/invites/accept',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            token: inviteToken,
          }),
        },
        env,
      );
      expect(secondRes.status).toBe(400);
    });

    it('enforces atomic single-use: invite token cannot be accepted multiple times or with different emails', async () => {
      // Create fresh invite
      const createRes = await app.request(
        'http://localhost/api/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            email: 'atomic-single-use@example.com',
            role: 'editor',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(200);
      const { token: singleToken } = (await createRes.json()) as { token: string };

      // Attempt signup with different email
      const diffSignupRes = await app.request(
        'http://localhost/api/auth/sign-up/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'different-email@example.com',
            password: 'password123',
            name: 'Different Email User',
            inviteToken: singleToken,
          }),
        },
        env,
      );
      expect(diffSignupRes.status).toBeGreaterThanOrEqual(400);

      // First valid acceptance succeeds
      const accept1 = await app.request(
        'http://localhost/api/auth/sign-up/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'atomic-single-use@example.com',
            password: 'password123',
            name: 'Accepted User',
            inviteToken: singleToken,
          }),
        },
        env,
      );
      expect(accept1.status).toBe(200);

      // Subsequent concurrent attempts to accept this already-used token must all fail
      const attemptSignupAgain = app.request(
        'http://localhost/api/auth/sign-up/email',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'atomic-single-use-second@example.com',
            password: 'password123',
            name: 'Second User',
            inviteToken: singleToken,
          }),
        },
        env,
      );

      const attemptAcceptAgain = app.request(
        'http://localhost/api/invites/accept',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ws1OwnerCookie,
          },
          body: JSON.stringify({
            token: singleToken,
          }),
        },
        env,
      );

      const [resAgain1, resAgain2] = await Promise.all([attemptSignupAgain, attemptAcceptAgain]);
      expect(resAgain1.status).toBeGreaterThanOrEqual(400);
      expect(resAgain2.status).toBe(400);
    });
  });

  describe('loadConfig Production Secret Validation', () => {
    it('throws in production when BETTER_AUTH_SECRET is too short (< 32 characters)', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'short-secret-less-than-32-chars',
          BOOTSTRAP_TOKEN: 'valid-bootstrap-token-16-chars',
        }),
      ).toThrow(/BETTER_AUTH_SECRET/);
    });

    it('throws in production when BETTER_AUTH_SECRET is a weak default string', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'dev-secret-change-me-32-bytes-minimum!!',
          BOOTSTRAP_TOKEN: 'valid-bootstrap-token-16-chars',
        }),
      ).toThrow(/BETTER_AUTH_SECRET/);

      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'local-dev-secret-change-me',
          BOOTSTRAP_TOKEN: 'valid-bootstrap-token-16-chars',
        }),
      ).toThrow(/BETTER_AUTH_SECRET/);
    });

    it('throws in production when BOOTSTRAP_TOKEN is weak or too short', () => {
      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'a-sufficiently-long-and-secure-secret-32-chars!!',
          BOOTSTRAP_TOKEN: 'short',
        }),
      ).toThrow(/BOOTSTRAP_TOKEN/);

      expect(() =>
        loadConfig({
          NODE_ENV: 'production',
          BETTER_AUTH_SECRET: 'a-sufficiently-long-and-secure-secret-32-chars!!',
          BOOTSTRAP_TOKEN: 'dev-bootstrap-token',
        }),
      ).toThrow(/BOOTSTRAP_TOKEN/);
    });
  });
});
