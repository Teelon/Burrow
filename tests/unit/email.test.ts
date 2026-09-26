import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createConsoleEmailProvider } from '../../src/core/adapters/db/d1/adapters/email/console';
import { createResendEmailProvider } from '../../src/core/adapters/db/d1/adapters/email/resend';
import { createEmailFromEnv } from '../../src/core/adapters/db/d1/adapters/email/factory';
import { inviteEmail } from '../../src/core/services/email-templates';

describe('Email integration', () => {
  describe('createConsoleEmailProvider', () => {
    it('returns an id starting with console- and does not throw', async () => {
      const provider = createConsoleEmailProvider();
      const res = await provider.send({
        to: 'user@example.com',
        subject: 'Welcome',
        html: '<p>Hello</p>',
      });
      expect(res.id).toMatch(/^console-/);
    });
  });

  describe('createEmailFromEnv', () => {
    it('returns console provider when RESEND_API_KEY is not configured', async () => {
      const provider = createEmailFromEnv({});
      const res = await provider.send({
        to: 'user@example.com',
        subject: 'Hello',
        html: '<p>Test</p>',
      });
      expect(res.id).toMatch(/^console-/);
    });

    it('returns resend provider when RESEND_API_KEY is present', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'resend_123' }),
      } as Response);

      const provider = createEmailFromEnv({
        RESEND_API_KEY: 're_test_key',
        EMAIL_FROM: 'App <test@example.com>',
      });

      const res = await provider.send({
        to: 'user@example.com',
        subject: 'Invite',
        html: '<p>Invite</p>',
      });

      expect(res.id).toBe('resend_123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer re_test_key',
          }),
        }),
      );

      fetchSpy.mockRestore();
    });
  });

  describe('createResendEmailProvider', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('sends POST request to Resend API and parses JSON response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'msg_abc' }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const provider = createResendEmailProvider('re_abc', 'Burrow <notify@burrow.test>');
      const res = await provider.send({
        to: 'invitee@test.com',
        subject: 'Subject',
        html: '<b>Body</b>',
        text: 'Body plain',
      });

      expect(res.id).toBe('msg_abc');
      expect(fetchMock).toHaveBeenCalledWith('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer re_abc',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Burrow <notify@burrow.test>',
          to: 'invitee@test.com',
          subject: 'Subject',
          html: '<b>Body</b>',
          text: 'Body plain',
        }),
      });
    });

    it('throws descriptive error on failed API response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });
      vi.stubGlobal('fetch', fetchMock);

      const provider = createResendEmailProvider('bad_key', 'Burrow <notify@burrow.test>');
      await expect(
        provider.send({
          to: 'invitee@test.com',
          subject: 'Subject',
          html: '<b>Body</b>',
        }),
      ).rejects.toThrow('Resend send failed (401): Unauthorized');
    });
  });

  describe('inviteEmail template', () => {
    it('escapes HTML in workspace and inviter names and includes plain text fallback', () => {
      const email = inviteEmail(
        '<script>alert("inviter")</script>',
        'Workspace & Co <evil>',
        'https://burrow.app/invite/token123',
      );

      expect(email.subject).toBe("You've been invited to Workspace & Co <evil>");
      expect(email.html).toContain('&lt;script&gt;alert(&quot;inviter&quot;)&lt;/script&gt;');
      expect(email.html).toContain('Workspace &amp; Co &lt;evil&gt;');
      expect(email.html).toContain('https://burrow.app/invite/token123');
      expect(email.html).toContain('Accept Invitation');
      expect(email.html).not.toContain('<script>');
      expect(email.text).toContain('https://burrow.app/invite/token123');
      expect(email.text).toContain('Workspace & Co <evil>');
    });

    it('provides graceful fallback when inviter and workspace names are undefined', () => {
      const email = inviteEmail(undefined, undefined, 'https://burrow.app/invite/token123');

      expect(email.subject).toBe("You've been invited to collaborate on Burrow");
      expect(email.html).toContain('Join the team on Burrow');
      expect(email.text).toContain('You have been invited to collaborate on Burrow');
    });
  });
});
