import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
/** Standard error shape used by every route: { error: { code, message } }. */
export interface ApiErrorBody {
    error: {
        code: string;
        message: string;
    };
}
export declare class HttpError extends Error {
    status: ContentfulStatusCode;
    code: string;
    constructor(status: ContentfulStatusCode, code: string, message: string);
}
export declare function isHttpError(err: unknown): err is HttpError;
export declare function httpError(c: Context, status: ContentfulStatusCode, code: string, message: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
export declare function badRequest(c: Context, message: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
export declare function notFound(c: Context, message?: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
export declare function forbidden(c: Context, message?: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
export declare function unauthorized(c: Context, message?: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
export declare function conflict(c: Context, code: string, message: string): Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, ContentfulStatusCode, "json">;
