import type { Infrastructure } from '../../../infrastructure/types';
import type { DB } from './client';
interface EnvBindings {
    FILES?: any;
    LOCAL_STORAGE_PATH?: string;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BOOTSTRAP_TOKEN: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
}
/**
 * Create the full D1 infrastructure bundle for the core app.
 * This factory wires the existing D1/Drizzle implementation behind
 * the Phase 1 repository interfaces.
 */
export declare function createD1Infrastructure(db: DB, env: EnvBindings): Infrastructure;
export { MAX_NOTEPAD_DEPTH, MAX_CONTENT_BYTES, LOCK_TTL_MS } from './lib/constants';
