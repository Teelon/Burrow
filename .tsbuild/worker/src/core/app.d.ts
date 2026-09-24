import type { Infrastructure } from './infrastructure/types';
interface Env {
    Variables: {
        userId: string;
        workspaceId: string;
        role: 'owner' | 'editor' | 'viewer';
    };
}
/**
 * Create the core Hono app with all routes registered.
 * This factory can be called from both Worker and Node entrypoints.
 */
export declare function createCoreApp(infra: Infrastructure): import("hono/hono-base").HonoBase<Env, {
    "/api/health": {
        $get: {
            input: {};
            output: {
                ok: true;
                now: number;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/health">;
export {};
