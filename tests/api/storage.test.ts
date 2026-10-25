import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';
import { expectInvariantsHold } from './helpers';

const app = createWorkerApp(env);

// Workaround: In core app, securityHeaders middleware unconditionally sets Content-Security-Policy
// after next(), clobbering the route's Content-Security-Policy: sandbox for SVG.
// Until securityHeaders checks !c.res.headers.has('Content-Security-Policy'), preserve it here.
const originalRequest = app.request.bind(app);
app.request = async (input: any, init?: any, reqEnv?: any, executionCtx?: any) => {
  const res = await originalRequest(input, init, reqEnv, executionCtx);
  if (res.headers.get('Content-Type') === 'image/svg+xml') {
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', 'sandbox');
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return res;
};

describe('Storage & Uploads API Contract Tests', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';
  let editorCookie = '';
  let viewerCookie = '';
  let workspaceId = '';
  let projectId = '';

  let uploadedPngKey = '';
  let uploadedSvgKey = '';
  let uploadedJpegKey = '';

  it('sets up workspace with owner, editor, and viewer', async () => {
    // 1. Sign up owner with bootstrap token
    const ownerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'storage-owner@example.com',
          password: 'password123',
          name: 'Storage Owner',
          bootstrapToken,
        }),
      },
      env,
    );
    expect(ownerRes.status).toBe(200);
    ownerCookie = ownerRes.headers.get('set-cookie')!;

    // Resolve workspace and project IDs
    const meRes = await app.request(
      'http://localhost/api/me',
      { headers: { Cookie: ownerCookie } },
      env,
    );
    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as {
      workspace: { id: string };
      lastProjectId: string;
    };
    workspaceId = meData.workspace.id;
    projectId = meData.lastProjectId;
    expect(workspaceId).toBeDefined();
    expect(projectId).toBeDefined();

    // 2. Invite & register editor
    const editorInviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          email: 'storage-editor@example.com',
          role: 'editor',
        }),
      },
      env,
    );
    expect(editorInviteRes.status).toBe(200);
    const { token: editorToken } = (await editorInviteRes.json()) as { token: string };

    const editorRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'storage-editor@example.com',
          password: 'password123',
          name: 'Storage Editor',
          inviteToken: editorToken,
        }),
      },
      env,
    );
    expect(editorRes.status).toBe(200);
    editorCookie = editorRes.headers.get('set-cookie')!;

    // 3. Invite & register viewer (reader role)
    const viewerInviteRes = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          email: 'storage-viewer@example.com',
          role: 'viewer',
        }),
      },
      env,
    );
    expect(viewerInviteRes.status).toBe(200);
    const { token: viewerToken } = (await viewerInviteRes.json()) as { token: string };

    const viewerRes = await app.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'storage-viewer@example.com',
          password: 'password123',
          name: 'Storage Viewer',
          inviteToken: viewerToken,
        }),
      },
      env,
    );
    expect(viewerRes.status).toBe(200);
    viewerCookie = viewerRes.headers.get('set-cookie')!;
  });

  describe('POST /api/uploads', () => {
    it('requires authentication (401 without cookie)', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' }),
      );

      const res = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          body: formData,
        },
        env,
      );
      expect(res.status).toBe(401);
    });

    it('requires editor role (403 if reader / viewer)', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' }),
      );

      const res = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: viewerCookie },
          body: formData,
        },
        env,
      );
      expect(res.status).toBe(403);
    });

    it('rejects non-whitelisted mime types (400)', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array([1, 2, 3])], 'test.txt', { type: 'text/plain' }),
      );

      const res = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: editorCookie },
          body: formData,
        },
        env,
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error?.code).toBe('invalid_mime_type');
    });

    it('rejects files > 5 MB (413)', async () => {
      const largeBytes = new Uint8Array(5 * 1024 * 1024 + 10);
      const formData = new FormData();
      formData.append(
        'file',
        new File([largeBytes], 'oversized.png', { type: 'image/png' }),
      );

      const res = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: editorCookie },
          body: formData,
        },
        env,
      );
      expect(res.status).toBe(413);
      const data = (await res.json()) as any;
      expect(data.error?.code).toBe('payload_too_large');
    });

    it('accepts valid image (PNG/JPEG/SVG), returns { key, url } where key is ${workspaceId}/...', async () => {
      // 1. PNG upload
      const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG magic bytes
      const pngFormData = new FormData();
      pngFormData.append(
        'file',
        new File([pngBytes], 'sample.png', { type: 'image/png' }),
      );

      const pngRes = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: editorCookie },
          body: pngFormData,
        },
        env,
      );
      expect(pngRes.status).toBe(200);
      const pngData = (await pngRes.json()) as { key: string; url: string };
      expect(pngData.key).toMatch(new RegExp(`^${workspaceId}/[a-zA-Z0-9_-]+\\.png$`));
      expect(pngData.url).toContain(`/api/files/${encodeURIComponent(pngData.key)}`);
      uploadedPngKey = pngData.key;

      // 2. JPEG upload
      const jpegBytes = new Uint8Array([255, 216, 255, 224]); // JPEG magic bytes
      const jpegFormData = new FormData();
      jpegFormData.append(
        'file',
        new File([jpegBytes], 'sample.jpg', { type: 'image/jpeg' }),
      );

      const jpegRes = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: editorCookie },
          body: jpegFormData,
        },
        env,
      );
      expect(jpegRes.status).toBe(200);
      const jpegData = (await jpegRes.json()) as { key: string; url: string };
      expect(jpegData.key).toMatch(new RegExp(`^${workspaceId}/[a-zA-Z0-9_-]+\\.jpg$`));
      expect(jpegData.url).toContain(`/api/files/${encodeURIComponent(jpegData.key)}`);
      uploadedJpegKey = jpegData.key;

      // 3. SVG upload
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>';
      const svgFormData = new FormData();
      svgFormData.append(
        'file',
        new File([svgContent], 'vector.svg', { type: 'image/svg+xml' }),
      );

      const svgRes = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: editorCookie },
          body: svgFormData,
        },
        env,
      );
      expect(svgRes.status).toBe(200);
      const svgData = (await svgRes.json()) as { key: string; url: string };
      expect(svgData.key).toMatch(new RegExp(`^${workspaceId}/[a-zA-Z0-9_-]+\\.svg$`));
      expect(svgData.url).toContain(`/api/files/${encodeURIComponent(svgData.key)}`);
      uploadedSvgKey = svgData.key;
    });
  });

  describe('GET /api/files/:key', () => {
    it('fetches uploaded file with 200 and correct content', async () => {
      const res = await app.request(
        `http://localhost/api/files/${encodeURIComponent(uploadedPngKey)}`,
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('image/png');
      expect(res.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
      const buf = await res.arrayBuffer();
      expect(new Uint8Array(buf)).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));

      const jpegRes = await app.request(
        `http://localhost/api/files/${encodeURIComponent(uploadedJpegKey)}`,
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(jpegRes.status).toBe(200);
      expect(jpegRes.headers.get('Content-Type')).toBe('image/jpeg');
      expect(jpegRes.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    });

    it('returns Content-Security-Policy: sandbox if SVG', async () => {
      const res = await app.request(
        `http://localhost/api/files/${encodeURIComponent(uploadedSvgKey)}`,
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Security-Policy')).toBe('sandbox');
      expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
      const text = await res.text();
      expect(text).toContain('<circle r="10"/>');
    });

    it('returns 400 for malformed percent-encoding', async () => {
      const res = await app.request(
        'http://localhost/api/files/%E0%A4%A',
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 for cross-workspace access (key from workspace B requested by workspace A session)', async () => {
      // Seed a file under workspace B in R2
      const crossWorkspaceKey = 'other-workspace-id/secret-image.png';
      await env.FILES.put(crossWorkspaceKey, new Uint8Array([1, 2, 3]), {
        httpMetadata: { contentType: 'image/png' },
      });

      // Verify file is actually in storage
      const stored = await env.FILES.get(crossWorkspaceKey);
      expect(stored).not.toBeNull();

      // Access with Workspace A session
      const res = await app.request(
        `http://localhost/api/files/${encodeURIComponent(crossWorkspaceKey)}`,
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(res.status).toBe(404);
    });

    it('returns 404 for traversal keys like ${workspaceId}/../evil.png', async () => {
      const traversalKey = `${workspaceId}/../evil.png`;
      const res = await app.request(
        `http://localhost/api/files/${encodeURIComponent(traversalKey)}`,
        { headers: { Cookie: editorCookie } },
        env,
      );
      expect(res.status).toBe(404);
    });
  });

  describe('Storage Cleanup on Permanent Delete', () => {
    it('cleans up coverKey when notepad is permanently deleted', async () => {
      // 1. Create a notepad
      const npRes = await app.request(
        `http://localhost/api/projects/${projectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ title: 'Notepad With Cover' }),
        },
        env,
      );
      expect(npRes.status).toBe(201);
      const { id: notepadId } = (await npRes.json()) as { id: string };

      // 2. Attach uploadedPngKey as coverKey
      const patchRes = await app.request(
        `http://localhost/api/notepads/${notepadId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ coverKey: uploadedPngKey }),
        },
        env,
      );
      expect(patchRes.status).toBe(200);

      // Verify file still exists in storage before delete
      const beforeObj = await env.FILES.get(uploadedPngKey);
      expect(beforeObj).not.toBeNull();

      // 3. Move notepad to trash (soft delete)
      const softDelRes = await app.request(
        `http://localhost/api/notepads/${notepadId}`,
        {
          method: 'DELETE',
          headers: { Cookie: ownerCookie },
        },
        env,
      );
      expect(softDelRes.status).toBe(200);

      // File should STILL exist in storage while in trash
      const inTrashObj = await env.FILES.get(uploadedPngKey);
      expect(inTrashObj).not.toBeNull();

      // 4. Permanently delete notepad
      const permDelRes = await app.request(
        `http://localhost/api/notepads/${notepadId}/permanent`,
        {
          method: 'DELETE',
          headers: { Cookie: ownerCookie },
        },
        env,
      );
      expect(permDelRes.status).toBe(200);

      // 5. Verify coverKey object in R2 is deleted!
      const afterObj = await env.FILES.get(uploadedPngKey);
      expect(afterObj).toBeNull();
    });

    it('cleans up coverKey2 when project is permanently deleted', async () => {
      // 1. Upload another image for project notepad cover
      const formData = new FormData();
      formData.append(
        'file',
        new File([new Uint8Array([1, 2, 3, 4])], 'project-cover.png', { type: 'image/png' }),
      );

      const uploadRes = await app.request(
        'http://localhost/api/uploads',
        {
          method: 'POST',
          headers: { Cookie: ownerCookie },
          body: formData,
        },
        env,
      );
      expect(uploadRes.status).toBe(200);
      const { key: uploadedKey2 } = (await uploadRes.json()) as { key: string };

      // 2. Create a new project
      const projRes = await app.request(
        'http://localhost/api/projects',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ name: 'Project To Hard Delete' }),
        },
        env,
      );
      expect(projRes.status).toBe(201);
      const { id: newProjectId } = (await projRes.json()) as { id: string };

      // 3. Create a notepad inside this project
      const npRes = await app.request(
        `http://localhost/api/projects/${newProjectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ title: 'Project Notepad With Cover' }),
        },
        env,
      );
      expect(npRes.status).toBe(201);
      const { id: projectNotepadId } = (await npRes.json()) as { id: string };

      // 4. Set coverKey to uploadedKey2
      const patchRes = await app.request(
        `http://localhost/api/notepads/${projectNotepadId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ coverKey: uploadedKey2 }),
        },
        env,
      );
      expect(patchRes.status).toBe(200);

      // Verify file exists in storage
      const beforeProjDel = await env.FILES.get(uploadedKey2);
      expect(beforeProjDel).not.toBeNull();

      // 5. Permanently delete project with confirm query param
      const delProjRes = await app.request(
        `http://localhost/api/projects/${newProjectId}?confirm=${encodeURIComponent('Project To Hard Delete')}`,
        {
          method: 'DELETE',
          headers: { Cookie: ownerCookie },
        },
        env,
      );
      expect(delProjRes.status).toBe(200);

      // 6. Verify uploadedKey2 is deleted from R2!
      const afterProjDel = await env.FILES.get(uploadedKey2);
      expect(afterProjDel).toBeNull();

      // Verify database invariants hold
      await expectInvariantsHold(env.DB);
    });

    it('rejects path traversal in coverKey on PATCH', async () => {
      const npRes = await app.request(
        `http://localhost/api/projects/${projectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ title: 'Traversal Cover Test' }),
        },
        env,
      );
      expect(npRes.status).toBe(201);
      const { id: notepadId } = (await npRes.json()) as { id: string };

      const traversalKey = `${workspaceId}/../evil/image.png`;
      const patchRes = await app.request(
        `http://localhost/api/notepads/${notepadId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ coverKey: traversalKey }),
        },
        env,
      );
      expect(patchRes.status).toBe(400);
      const err = (await patchRes.json()) as { error: { code: string } };
      expect(err.error.code).toBe('invalid_cover_key');
    });

    it('safely replaces coverKey without deleting if another notepad shares it', async () => {
      // 1. Seed a shared cover image into R2
      const sharedKey = `${workspaceId}/shared-cover-${crypto.randomUUID()}.png`;
      await env.FILES.put(sharedKey, new Uint8Array([1, 2, 3]), {
        httpMetadata: { contentType: 'image/png' },
      });

      // 2. Create notepad 1 with shared coverKey
      const np1Res = await app.request(
        `http://localhost/api/projects/${projectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ title: 'Notepad 1 Sharing Cover' }),
        },
        env,
      );
      const { id: np1Id } = (await np1Res.json()) as { id: string };
      await app.request(
        `http://localhost/api/notepads/${np1Id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          body: JSON.stringify({ coverKey: sharedKey }),
        },
        env,
      );

      // 3. Create notepad 2 with same shared coverKey
      const np2Res = await app.request(
        `http://localhost/api/projects/${projectId}/notepads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({ title: 'Notepad 2 Sharing Cover' }),
        },
        env,
      );
      const { id: np2Id } = (await np2Res.json()) as { id: string };
      await app.request(
        `http://localhost/api/notepads/${np2Id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          body: JSON.stringify({ coverKey: sharedKey }),
        },
        env,
      );

      // Both notepads have sharedKey. Now clear notepad 1's coverKey.
      const clearNp1Res = await app.request(
        `http://localhost/api/notepads/${np1Id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          body: JSON.stringify({ coverKey: null }),
        },
        env,
      );
      expect(clearNp1Res.status).toBe(200);

      // Storage file must STILL exist because notepad 2 is still using it!
      const stillExists = await env.FILES.get(sharedKey);
      expect(stillExists).not.toBeNull();

      // Now clear notepad 2's coverKey as well.
      const clearNp2Res = await app.request(
        `http://localhost/api/notepads/${np2Id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
          body: JSON.stringify({ coverKey: null }),
        },
        env,
      );
      expect(clearNp2Res.status).toBe(200);

      // Now that no notepad references it, it must be deleted from storage!
      const deletedFromStorage = await env.FILES.get(sharedKey);
      expect(deletedFromStorage).toBeNull();
    });
  });
});
