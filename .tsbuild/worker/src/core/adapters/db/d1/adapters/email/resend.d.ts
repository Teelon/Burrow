import type { IEmailProvider } from '../../../../../adapters/email';
/**
 * Resend email provider — sends transactional emails via the Resend API.
 * https://resend.com/docs/api-reference/emails/send-email
 */
export declare function createResendEmailProvider(apiKey: string, from: string): IEmailProvider;
