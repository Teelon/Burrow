import type { IEmailProvider } from '../../../../../adapters/email';
/**
 * Console email provider — logs send attempts instead of delivering.
 * Used automatically when RESEND_API_KEY is not configured.
 * Invite links still work via manual sharing; no email infra needed.
 */
export declare function createConsoleEmailProvider(): IEmailProvider;
