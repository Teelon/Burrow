import type { Env } from './env';
/**
 * NOTE (Hono RPC): route registration returns a NEW type; a plain
 * `const app = new Hono(); app.get(...)` would export a schema-less app type
 * and the typed client (`hc`) would collapse to `unknown`. Always chain.
 */
export declare const app: import("hono/hono-base").HonoBase<Env, {
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
export type AppType = typeof app;
export default app;
