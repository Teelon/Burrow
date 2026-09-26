/**
 * Type-only Hono app for Hono RPC type inference.
 * Mirrors the old worker index exactly using the existing route modules.
 * This is never executed at runtime — it exists solely so TypeScript
 * can infer the complete route type from the chained route registrations.
 */
import { Hono } from 'hono';
import type { Env } from './env';
import { securityHeaders, bodyLimit } from './middleware/security';
import { sessionMiddleware } from './middleware/session';
import { httpError, isHttpError } from './lib/errors';
import { authRoutes } from './routes/auth';
import { membersRoutes } from './routes/members';
import { projectsRoutes } from './routes/projects';
import { notepadsRoutes } from './routes/notepads';
import { filesRoutes } from './routes/files';
import { boardsRoutes } from './routes/boards';
import { columnsRoutes } from './routes/columns';
import { cardsRoutes } from './routes/cards';
import { suggestRoutes } from './routes/suggest';
import { notificationsRoutes } from './routes/notifications';
import { tagsRoutes } from './routes/tags';
import { searchRoutes } from './routes/search';

const _typeOnlyApp = new Hono<Env>()
  .use('*', securityHeaders)
  .use('/api/*', bodyLimit())
  .use('/api/*', sessionMiddleware)
  .get('/api/health', (c) => c.json({ ok: true, now: Date.now() }))
  .route('', authRoutes)
  .route('', membersRoutes)
  // Invite routes live in core/app.ts — no worker duplicate needed
  .route('', projectsRoutes)
  .route('', notepadsRoutes)
  .route('', filesRoutes)
  .route('', boardsRoutes)
  .route('', columnsRoutes)
  .route('', cardsRoutes)
  .route('', suggestRoutes)
  .route('', notificationsRoutes)
  .route('', tagsRoutes)
  .route('', searchRoutes)
  .onError((err, c) => {
    if (isHttpError(err)) {
      return c.json({ error: { code: err.code, message: err.message } }, err.status);
    }
    console.error('unhandled error', err);
    return httpError(c, 500, 'internal_error', 'Internal server error');
  })
  .notFound((c) => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404));

export type AppType = typeof _typeOnlyApp;
