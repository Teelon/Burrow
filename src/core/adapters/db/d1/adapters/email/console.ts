import type { IEmailProvider, SendEmailParams } from '../../../../../adapters/email';

/**
 * Console email provider — logs send attempts instead of delivering.
 * Used automatically when RESEND_API_KEY is not configured.
 * Invite links still work via manual sharing; no email infra needed.
 */
export function createConsoleEmailProvider(): IEmailProvider {
  return {
    async send({ to, subject }: SendEmailParams) {
      // eslint-disable-next-line no-console
      console.log(`[email:console] Fallback delivery (RESEND_API_KEY unset in environment)`);
      // eslint-disable-next-line no-console
      console.log(`  To:      ${to}`);
      // eslint-disable-next-line no-console
      console.log(`  Subject: "${subject}"`);
      // eslint-disable-next-line no-console
      console.log(`  Notice:  Uncomment RESEND_API_KEY in .dev.vars to deliver via Resend`);
      return { id: 'console-' + crypto.randomUUID() };
    },
  };
}
