export declare const DEFAULT_MAX_BODY_BYTES = 2000000;
/**
 * Standard security headers for all responses.
 */
export declare const securityHeaders: import("hono").MiddlewareHandler<any, string, {}, Response>;
/**
 * Request body size limiter middleware.
 * Inspects Content-Length before or during stream read to return 413 quickly.
 */
export declare function bodyLimit(maxBytes?: number): import("hono").MiddlewareHandler<any, string, {}, Response | (Response & import("hono").TypedResponse<{
    error: {
        code: string;
        message: string;
    };
}, 413, "json">)>;
