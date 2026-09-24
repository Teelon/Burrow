import type { AuthProvider } from '../../../infrastructure/types';
interface EnvBindings {
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
}
/**
 * Create an AuthProvider that throws if used without DB.
 * The real implementation is in createAuthProviderWithDB.
 */
export declare function createAuthProvider(_env: EnvBindings): AuthProvider;
export declare function createAuthProviderWithDB(db: any, env: EnvBindings): AuthProvider;
export {};
