import type { AuthProvider, IMemberRepository } from '../infrastructure/types';
declare const ROLE_RANK: {
    readonly viewer: 1;
    readonly editor: 2;
    readonly owner: 3;
};
type Role = keyof typeof ROLE_RANK;
/**
 * Resolves session and member info, attaching userId, workspaceId, and role to context.
 * Uses the auth provider to get the user, then the member repository to resolve workspace/role.
 */
export declare const createSessionMiddleware: (auth: AuthProvider, members: IMemberRepository) => import("hono").MiddlewareHandler<any, string, {}, Response>;
/**
 * Requires an active session. Returns 401 otherwise.
 */
export declare const requireSession: import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, 401, "json">)>;
/**
 * Requires a minimum role level (viewer < editor < owner).
 * Mutating routes require editor or owner; owner routes require owner. Returns 403 otherwise.
 */
export declare function requireRole(minRole: Role): import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, 403, "json">)>;
export {};
