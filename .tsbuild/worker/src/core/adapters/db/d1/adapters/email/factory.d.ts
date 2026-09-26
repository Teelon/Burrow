import type { IEmailProvider } from '../../../../../adapters/email';
/**
 * Create the appropriate email provider based on env configuration.
 * Falls back to console provider when RESEND_API_KEY is not set.
 */
export declare function createEmailFromEnv(env: {
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
}): IEmailProvider;
