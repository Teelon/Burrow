import { Hono } from 'hono';
import type { Env } from './env';
export declare const app: Hono<Env, import("hono/types").BlankSchema, "/">;
export type AppType = typeof app;
export default app;
