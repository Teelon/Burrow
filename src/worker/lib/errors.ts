import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** Standard error shape used by every route: { error: { code, message } }. */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class HttpError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError;
}

export function httpError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json<ApiErrorBody>({ error: { code, message } }, status);
}

export function badRequest(c: Context, message: string) {
  return httpError(c, 400, 'bad_request', message);
}

export function notFound(c: Context, message = 'Not found') {
  return httpError(c, 404, 'not_found', message);
}

export function forbidden(c: Context, message = 'Forbidden') {
  return httpError(c, 403, 'forbidden', message);
}

export function unauthorized(c: Context, message = 'Authentication required') {
  return httpError(c, 401, 'unauthorized', message);
}

export function conflict(c: Context, code: string, message: string) {
  return httpError(c, 409, code, message);
}
