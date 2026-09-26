import type { IEmailProvider, SendEmailParams } from '../../../../../adapters/email';

/**
 * Resend email provider — sends transactional emails via the Resend API.
 * https://resend.com/docs/api-reference/emails/send-email
 */
export function createResendEmailProvider(apiKey: string, from: string): IEmailProvider {
  return {
    async send({ to, subject, html, text }: SendEmailParams) {
      // eslint-disable-next-line no-console
      console.log(`[email:resend] Attempting delivery via Resend:`);
      // eslint-disable-next-line no-console
      console.log(`  To:      ${to}`);
      // eslint-disable-next-line no-console
      console.log(`  From:    ${from}`);
      // eslint-disable-next-line no-console
      console.log(`  Subject: "${subject}"`);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html,
          ...(text ? { text } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[email:resend] Delivery failed (HTTP ${res.status}): ${body}`);
        throw new Error(`Resend send failed (${res.status}): ${body}`);
      }

      const data = (await res.json()) as { id: string };
      // eslint-disable-next-line no-console
      console.log(`[email:resend] Delivered successfully (id=${data.id})`);
      return data;
    },
  };
}
