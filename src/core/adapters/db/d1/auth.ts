import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from './schema';
import type { AuthProvider } from '../../../infrastructure/types';

interface EnvBindings {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

/**
 * Create an AuthProvider that throws if used without DB.
 * The real implementation is in createAuthProviderWithDB.
 */
export function createAuthProvider(_env: EnvBindings): AuthProvider {
  return {
    async getSession(_headers: Headers) {
      throw new Error('AuthProvider.getSession requires DB - use createAuthProviderWithDB instead');
    },

    async handler(_req: Request) {
      throw new Error('AuthProvider.handler requires DB - use createAuthProviderWithDB instead');
    },
  };
}

// Factory that creates the auth provider with a DB instance
export function createAuthProviderWithDB(db: any, env: EnvBindings): AuthProvider {
  const trustedOrigins = [
    'http://localhost',
    'http://127.0.0.1',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8787',
    'http://127.0.0.1:8787',
  ];
  if (env.BETTER_AUTH_URL) {
    try {
      const urlOrigin = new URL(env.BETTER_AUTH_URL).origin;
      if (!trustedOrigins.includes(urlOrigin)) {
        trustedOrigins.push(urlOrigin);
      }
    } catch {
      // ignore
    }
  }

  const auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || 'http://localhost:5173',
    trustedOrigins,
    emailAndPassword: {
      enabled: true,
    },
  });

  return {
    async getSession(headers: Headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      // Return only userId; middleware will resolve workspace/role via member repo
      return { userId: session.user.id };
    },

    async handler(req: Request) {
      return auth.handler(req);
    },
  };
}
