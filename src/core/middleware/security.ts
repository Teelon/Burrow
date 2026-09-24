import { createMiddleware } from 'hono/factory'

export const DEFAULT_MAX_BODY_BYTES = 2_000_000 // 2 MB

/**
 * Standard security headers for all responses.
 */
export const securityHeaders = createMiddleware(async (c, next) => {
  await next()
  c.header(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  )
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Frame-Options', 'DENY')
})

/**
 * Request body size limiter middleware.
 * Inspects Content-Length before or during stream read to return 413 quickly.
 */
export function bodyLimit(maxBytes = DEFAULT_MAX_BODY_BYTES) {
  return createMiddleware(async (c, next) => {
    const contentLength = c.req.header('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return c.json(
        {
          error: {
            code: 'payload_too_large',
            message: `Request body exceeds limit of ${maxBytes} bytes`,
          },
        },
        413,
      )
    }
    await next()
  })
}