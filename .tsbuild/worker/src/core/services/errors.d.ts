/**
 * Standard error shape used by every service: { error: { code, message } }.
 */
export interface ApiErrorBody {
    error: {
        code: string;
        message: string;
    };
}
export declare class HttpError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string);
}
export declare function isHttpError(err: unknown): err is HttpError;
export declare function httpError(status: number, code: string, message: string): HttpError;
export declare function badRequest(code: string, message: string): HttpError;
export declare function notFound(code: string, message?: string): HttpError;
export declare function forbidden(code: string, message?: string): HttpError;
export declare function unauthorized(code: string, message?: string): HttpError;
export declare function conflict(code: string, message: string): HttpError;
export declare function payloadTooLarge(code: string, message: string): HttpError;
