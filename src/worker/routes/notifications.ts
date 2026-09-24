import { Hono } from 'hono';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Env } from '../env';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import { requireSession } from '../middleware/session';
import { zValidator } from '../middleware/validator';
import { chunkInList } from '../lib/chunk';

const markReadSchema = z.object({
  ids: z.array(z.string()).optional(),
});

export const notificationsRoutes = new Hono<Env>()
  .get('/api/notifications', requireSession, async (c) => {
    const db = createDb(c.env.DB);
    const userId = c.get('userId');
    const workspaceId = c.get('workspaceId');
    const unreadOnly = c.req.query('unread') === '1';

    const rows = await db
      .select({
        id: t.notifications.id,
        type: t.notifications.type,
        actorId: t.notifications.actorId,
        actorName: t.user.name,
        actorImage: t.user.image,
        notepadId: t.notifications.notepadId,
        cardId: t.notifications.cardId,
        readAt: t.notifications.readAt,
        createdAt: t.notifications.createdAt,
      })
      .from(t.notifications)
      .innerJoin(t.user, eq(t.user.id, t.notifications.actorId))
      .where(
        and(
          eq(t.notifications.userId, userId),
          eq(t.notifications.workspaceId, workspaceId),
          unreadOnly ? isNull(t.notifications.readAt) : undefined,
        ),
      )
      .orderBy(desc(t.notifications.createdAt))
      .limit(50);

    // Load notepad titles for referenced notepads
    const notepadIds = rows.map((r) => r.notepadId).filter(Boolean) as string[];
    const titlesByNotepad = new Map<string, string>();
    if (notepadIds.length > 0) {
      for (const chunk of chunkInList(notepadIds, 1)) {
        const notepads = await db
          .select({ id: t.notepads.id, title: t.notepads.title })
          .from(t.notepads)
          .where(inArray(t.notepads.id, chunk));
        for (const np of notepads) {
          titlesByNotepad.set(np.id, np.title);
        }
      }
    }

    return c.json(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        actor: {
          id: r.actorId,
          name: r.actorName,
          image: r.actorImage,
        },
        notepadId: r.notepadId,
        cardId: r.cardId,
        targetTitle: r.notepadId ? titlesByNotepad.get(r.notepadId) || 'Untitled' : undefined,
        readAt: r.readAt,
        createdAt: r.createdAt,
      })),
    );
  })
  .post(
    '/api/notifications/read',
    requireSession,
    zValidator('json', markReadSchema),
    async (c) => {
      const db = createDb(c.env.DB);
      const userId = c.get('userId');
      const body = c.req.valid('json');
      const now = Date.now();

      if (body.ids && body.ids.length > 0) {
        for (const chunk of chunkInList(body.ids, 2)) {
          await db
            .update(t.notifications)
            .set({ readAt: now })
            .where(and(eq(t.notifications.userId, userId), inArray(t.notifications.id, chunk)));
        }
      } else {
        await db
          .update(t.notifications)
          .set({ readAt: now })
          .where(and(eq(t.notifications.userId, userId), isNull(t.notifications.readAt)));
      }

      return c.json({ ok: true });
    },
  );
