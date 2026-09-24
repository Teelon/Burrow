import type { Env } from './env';
import type { Hono } from 'hono';
import type { ExecutionContext } from 'hono';
/**
 * Create the Hono app for a given Worker environment.
 * Used by tests and the production fetch handler.
 */
export declare function createWorkerApp(env: Env['Bindings']): Hono<any, any, any>;
/**
 * Worker entrypoint - creates the app with D1 infrastructure from Cloudflare bindings.
 * The infrastructure is created per-request since bindings come from the fetch handler.
 */
declare const _default: {
    fetch(request: Request, env: Env["Bindings"], ctx: ExecutionContext): Promise<Response>;
};
export default _default;
export type { AppType } from './types-app';
