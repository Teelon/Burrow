import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { createStorageFromEnv } from '../adapters/storage/factory'
import type { Env } from '../env'
import { requireRole, requireSession } from '../middleware/session'
import { HttpError } from '../lib/errors'

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5 MB

const EXTENSION_MAP: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

export const filesRoutes = new Hono<Env>()
  .post('/api/uploads', requireSession, requireRole('editor'), async (c) => {
    const workspaceId = c.get('workspaceId')
    const body = await c.req.parseBody()
    const file = body['file']

    if (!file || !(file instanceof File)) {
      throw new HttpError(400, 'invalid_file', 'No file provided in form field "file"')
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new HttpError(
        400,
        'invalid_mime_type',
        `File type ${file.type} not allowed. Supported image types: png, jpeg, webp, gif, svg`,
      )
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, 'payload_too_large', 'Image exceeds 5 MB limit')
    }

    const ext = EXTENSION_MAP[file.type] || 'bin'
    const key = `${workspaceId}/${nanoid()}.${ext}`

    const storage = c.env.FILES ? createStorageFromEnv(c.env) : null
    if (storage) {
      await storage.put(key, await file.arrayBuffer(), file.type)
    }

    const origin = new URL(c.req.url).origin
    return c.json({
      key,
      url: `${origin}/api/files/${encodeURIComponent(key)}`,
    })
  })
  .get('/api/files/:key', requireSession, async (c) => {
    const workspaceId = c.get('workspaceId')
    const key = decodeURIComponent(c.req.param('key'))

    // Prefix check against session's workspace
    if (!key.startsWith(`${workspaceId}/`)) {
      throw new HttpError(404, 'not_found', 'File not found')
    }

    if (!c.env.FILES) {
      throw new HttpError(404, 'not_found', 'File storage not configured')
    }

    const storage = createStorageFromEnv(c.env)
    const object = await storage.get(key)
    if (!object) {
      throw new HttpError(404, 'not_found', 'File not found')
    }

    const headers = new Headers()
    headers.set('Content-Type', object.contentType || 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')

    return new Response(object.body as BodyInit, { headers })
  })
