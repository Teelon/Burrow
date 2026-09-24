import type { DB } from './db/client';
import type { Env } from './env';
export declare function createAuth(db: DB, env: Env['Bindings']): import("better-auth").Auth<{
    database: (options: import("better-auth").BetterAuthOptions) => import("better-auth").DBAdapter<import("better-auth").BetterAuthOptions>;
    secret: string;
    baseURL: string;
    trustedOrigins: string[];
    emailAndPassword: {
        enabled: true;
    };
}>;
export type AuthInstance = ReturnType<typeof createAuth>;
