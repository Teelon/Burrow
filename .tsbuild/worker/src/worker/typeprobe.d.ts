import { app } from './index';
import type { Hono } from 'hono';
type SchemaOf<T> = T extends Hono<any, infer S, any> ? S : 'nope';
export type AppSchema = SchemaOf<typeof app>;
export declare const probe: (args?: {} | undefined, options?: import("hono").ClientRequestOptions) => Promise<import("hono/client").ClientResponse<{
    ok: true;
    now: number;
}, import("hono/utils/http-status").ContentfulStatusCode, "json">>;
export {};
