import type { Env } from '../env';
/**
 * Resolves session and member info, attaching userId, workspaceId, and role to context.
 */
export declare const sessionMiddleware: import("hono").MiddlewareHandler<Env, string, {}, Response>;
/**
 * Requires an active session. Returns 401 otherwise.
 */
export declare const requireSession: import("hono").MiddlewareHandler<Env, string, {}, Response>;
/**
 * Requires a minimum role level (viewer < editor < owner).
 * Mutating routes require editor or owner; owner routes require owner. Returns 403 otherwise.
 */
export declare function requireRole(minRole: 'viewer' | 'editor' | 'owner'): import("hono").MiddlewareHandler<Env, string, {}, Response>;
