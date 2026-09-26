import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorkerApp } from '../../src/worker/index';

describe('Invites email integration end-to-end', () => {
  const bootstrapToken = env.BOOTSTRAP_TOKEN || 'test-bootstrap-token';
  let ownerCookie = '';

  beforeAll(async () => {
    const baseApp = createWorkerApp(env);
    const signupRes = await baseApp.request(
      'http://localhost/api/auth/sign-up/email',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'owner-invites-test@example.com',
          password: 'password123',
          name: 'Owner User',
          bootstrapToken,
        }),
      },
      env,
    );
    expect(signupRes.status).toBe(200);
    ownerCookie = signupRes.headers.get('set-cookie')!;
  });

  it('e2e without RESEND_API_KEY: invite creates successfully with console fallback', async () => {
    const app = createWorkerApp({
      ...env,
      RESEND_API_KEY: undefined,
    });

    const res = await app.request(
      'http://localhost/api/invites',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: ownerCookie,
        },
        body: JSON.stringify({
          email: 'invited-no-key@example.com',
          role: 'editor',
        }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      id: string;
      email: string;
      role: string;
      token: string;
      url: string;
    };
    expect(data.email).toBe('invited-no-key@example.com');
    expect(data.role).toBe('editor');
    expect(data.token).toBeDefined();
    expect(data.url).toContain('/invite/');
  });

  it('e2e with RESEND_API_KEY: dispatches email to Resend API and returns 200', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('api.resend.com')) {
        fetchCalls.push({ url: urlStr, init });
        return new Response(JSON.stringify({ id: 'msg_resend_mock' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;

    try {
      const app = createWorkerApp({
        ...env,
        RESEND_API_KEY: 're_test_12345',
        EMAIL_FROM: 'Burrow <noreply@burrow.test>',
      });

      const res = await app.request(
        'http://localhost/api/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({
            email: 'invited-with-key@example.com',
            role: 'editor',
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        id: string;
        email: string;
        role: string;
        token: string;
        url: string;
      };
      expect(data.email).toBe('invited-with-key@example.com');
      expect(data.url).toContain('/invite/');

      // Allow microtask queue / waitUntil to run
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fetchCalls.length).toBe(1);
      const call = fetchCalls[0]!;
      expect(call.url).toBe('https://api.resend.com/emails');
      const headers = call.init?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer re_test_12345');
      const body = JSON.parse(call.init?.body as string);
      expect(body.to).toBe('invited-with-key@example.com');
      expect(body.from).toBe('Burrow <noreply@burrow.test>');
      expect(body.subject).toBe("You've been invited to My Workspace");
      expect(body.html).toContain(data.url);
      expect(body.text).toContain(data.url);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('e2e failure swallow: email delivery failure never fails invite creation', async () => {
    const originalFetch = globalThis.fetch;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input.toString();
      if (urlStr.includes('api.resend.com')) {
        return new Response(JSON.stringify({ message: 'Rate limit exceeded' }), {
          status: 429,
        });
      }
      return originalFetch(input, init);
    }) as typeof globalThis.fetch;

    try {
      const app = createWorkerApp({
        ...env,
        RESEND_API_KEY: 're_failing_key',
      });

      const res = await app.request(
        'http://localhost/api/invites',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: ownerCookie,
          },
          body: JSON.stringify({
            email: 'invited-fail@example.com',
            role: 'editor',
          }),
        },
        env,
      );

      // Must succeed even if Resend returned 429
      expect(res.status).toBe(200);
      const data = (await res.json()) as { id: string; url: string };
      expect(data.url).toContain('/invite/');

      // Allow error logger to run
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      consoleErrorSpy.mockRestore();
    }
  });
});
