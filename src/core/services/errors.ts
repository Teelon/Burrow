/**
 * Standard error shape used by every service: { error: { code, message } }.
 */
export interface ApiErrorBody {
  error: { code: string; message: string }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function isHttpError(err: unknown): err is HttpError {
  return err instanceof HttpError
}

export function httpError(status: number, code: string, message: string): HttpError {
  return new HttpError(status, code, message)
}

export function badRequest(code: string, message: string): HttpError {
  return new HttpError(400, code, message)
}

export function notFound(code: string, message = 'Not found'): HttpError {
  return new HttpError(404, code, message)
}

export function forbidden(code: string, message = 'Forbidden'): HttpError {
  return new HttpError(403, code, message)
}

export function unauthorized(code: string, message = 'Authentication required'): HttpError {
  return new HttpError(401, code, message)
}

export function conflict(code: string, message: string): HttpError {
  return new HttpError(409, code, message)
}

export function payloadTooLarge(code: string, message: string): HttpError {
  return new HttpError(413, code, message)
}