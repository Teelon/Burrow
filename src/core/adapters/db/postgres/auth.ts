import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { AuthProvider } from '../../../infrastructure/types';
import type { PostgresDb } from './index';
import { schema } from './schema';

/**
 * Creates a BetterAuth instance wrapped as AuthProvider for the core app.
 * Uses the PostgreSQL drizzle adapter.
 */
export function createPostgresAuthProvider(
  db: PostgresDb,
  secret: string,
  url: string,
): AuthProvider {
  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    secret,
    baseURL: url,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID ?? '',
        clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'user',
        },
      },
    },
  });

  return {
    async getSession(headers: Headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;

      // Get workspace membership for this user
      // For now, return first workspace or null
      // In a real app, you'd resolve workspace from context/subdomain
      return {
        userId: session.user.id,
        workspaceId: '', // Will be resolved by the calling code
        role: 'editor',
      };
    },
    async handler(req: Request) {
      return auth.handler(req);
    },
  };
}
