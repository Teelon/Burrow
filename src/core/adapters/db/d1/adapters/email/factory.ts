import type { IEmailProvider } from '../../../../../adapters/email';
import { createConsoleEmailProvider } from './console';
import { createResendEmailProvider } from './resend';

/**
 * Create the appropriate email provider based on env configuration.
 * Falls back to console provider when RESEND_API_KEY is not set.
 */
export function createEmailFromEnv(env: {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}): IEmailProvider {
  if (env.RESEND_API_KEY) {
    const from = env.EMAIL_FROM ?? 'Burrow <noreply@example.com>';
    return createResendEmailProvider(env.RESEND_API_KEY, from);
  }
  return createConsoleEmailProvider();
}
