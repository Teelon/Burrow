import { env } from 'cloudflare:test';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { extractPlainText } from '../../src/shared/extract';
import { createDb } from '../../src/worker/db/client';
import { cardCreationStatements, createCard, type CardPlan } from '../../src/worker/services/cards';
import { buildSaveContentStatements, saveContent } from '../../src/worker/services/notepads';
import { expectInvariantsHold } from './helpers';
import { runBatch } from '../../src/worker/lib/batch';

const db = createDb(env.DB);

/** Unique, collision-free ids so tests never share rows. */
function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Minimal BlockNote document: one paragraph of plain text. */
function contentWith(text: string): string {
  return JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }]);
}

/** BlockNote document with a user mention in front of the text. */
function contentMentioning(userId: string, text: string): string {
  return JSON.stringify([
    {
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          props: { kind: 'user', id: userId, label: 'Teammate' },
        },
        { type: 'text', text: ` ${text}` },
      ],
    },
  ]);
}

interface WorkspaceSeed {
  workspaceId: string;
  userId: string;
  member2Id: string;
  projectId: string;
}

async function seedWorkspace(): Promise<WorkspaceSeed> {
  const workspaceId = uid('ws');
  const userId = uid('user');
  const member2Id = uid('user');
  const projectId = uid('proj');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO workspaces (id, name, created_by, created_at) VALUES (?, 'Spike workspace', ?, ?)`,
    ).bind(workspaceId, userId, now),
    env.DB.prepare(
      `INSERT INTO members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
    ).bind(workspaceId, userId, now),
    env.DB.prepare(
      `INSERT INTO members (workspace_id, user_id, role, joined_at) VALUES (?, ?, 'editor', ?)`,
    ).bind(workspaceId, member2Id, now),
    env.DB.prepare(
      `INSERT INTO projects (id, workspace_id, name, position, created_at, updated_at) VALUES (?, ?, 'Spike project', 'a0', ?, ?)`,
    ).bind(projectId, workspaceId, now, now),
  ]);
  return { workspaceId, userId, member2Id, projectId };
}

async function seedNotepad(
  seed: WorkspaceSeed,
  text: string,
): Promise<{ id: string; content: string }> {
  const id = uid('np');
  const content = contentWith(text);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO notepads (id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'notepad', 'Spike notepad', ?, 1, 'a0', ?, ?, ?)`,
    ).bind(id, seed.workspaceId, seed.projectId, content, seed.userId, now, now),
    env.DB.prepare(
      `INSERT INTO notepads_fts (notepad_id, project_id, title, body) VALUES (?, ?, 'Spike notepad', ?)`,
    ).bind(id, seed.projectId, extractPlainText(content)),
  ]);
  return { id, content };
}

async function seedBoard(seed: WorkspaceSeed): Promise<{ boardId: string; columnId: string }> {
  const boardId = uid('board');
  const columnId = uid('col');
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO boards (id, workspace_id, project_id, name, position, created_at, updated_at) VALUES (?, ?, ?, 'Spike board', 'a0', ?, ?)`,
    ).bind(boardId, seed.workspaceId, seed.projectId, now, now),
    env.DB.prepare(
      `INSERT INTO board_columns (id, board_id, name, position) VALUES (?, ?, 'Todo', 'a0')`,
    ).bind(columnId, boardId),
  ]);
  return { boardId, columnId };
}

async function notepadRow(id: string): Promise<{ version: number; content: string } | null> {
  return env.DB.prepare('SELECT version, content FROM notepads WHERE id = ?')
    .bind(id)
    .first<{ version: number; content: string }>();
}

async function ftsMatches(term: string): Promise<string[]> {
  const res = await env.DB.prepare('SELECT notepad_id FROM notepads_fts WHERE notepads_fts MATCH ?')
    .bind(term)
    .all<{ notepad_id: string }>();
  return (res.results ?? []).map((r) => r.notepad_id);
}

async function countRows(query: string, bindValue: string): Promise<number> {
  const row = await env.DB.prepare(query).bind(bindValue).first<{ n: number }>();
  return row?.n ?? 0;
}

/**
 * Phase 0 spike: proves D1's db.batch() gives the service layer the atomicity
 * it depends on — a save either commits everything (content + FTS + links +
 * notifications) or changes nothing, and stale writes are complete no-ops.
 */
describe('D1 batch atomicity spike', () => {
  it('(a) a valid save batch commits content, FTS, links and notifications together', async () => {
    const seed = await seedWorkspace();
    const notepad = await seedNotepad(seed, 'original quokka draft');

    const content = contentMentioning(seed.member2Id, 'gazelle patrol');
    const result = await saveContent(db, {
      notepadId: notepad.id,
      content,
      baseVersion: 1,
      actorId: seed.userId,
    });
    expect(result.version).toBe(2);

    const row = await notepadRow(notepad.id);
    expect(row?.version).toBe(2);
    expect(row?.content).toBe(content);

    // FTS row was rebuilt: new text searchable, old text gone.
    expect(await ftsMatches('gazelle')).toContain(notepad.id);
    expect(await ftsMatches('quokka')).not.toContain(notepad.id);

    // The mention produced a link row and a notification in the same batch.
    const links = await env.DB.prepare(
      'SELECT target_type, target_id FROM notepad_links WHERE source_id = ?',
    )
      .bind(notepad.id)
      .all<{ target_type: string; target_id: string }>();
    expect(links.results).toEqual([{ target_type: 'user', target_id: seed.member2Id }]);

    const notifs = await env.DB.prepare(
      'SELECT type, actor_id FROM notifications WHERE notepad_id = ? AND user_id = ?',
    )
      .bind(notepad.id, seed.member2Id)
      .all<{ type: string; actor_id: string }>();
    expect(notifs.results).toHaveLength(1);
    expect(notifs.results?.[0]).toMatchObject({
      type: 'mention',
      actor_id: seed.userId,
    });

    await expectInvariantsHold(env.DB);
  });

  it('(b) a failing final statement rolls back the whole save batch, including FTS, links and notifications', async () => {
    const seed = await seedWorkspace();
    const notepad = await seedNotepad(seed, 'original quokka draft');

    const newContent = contentMentioning(seed.member2Id, 'wombat replacement');
    const statements = [
      ...buildSaveContentStatements(db, {
        row: {
          id: notepad.id,
          workspaceId: seed.workspaceId,
          title: 'Spike notepad',
        },
        content: newContent,
        baseVersion: 1,
        actorId: seed.userId,
        validLinks: [{ targetType: 'user', targetId: seed.member2Id }],
        previousLinks: [],
        now: Date.now(),
      }),
      // Gated to fail ONLY if the statements above really executed: it copies
      // the notepad row onto its own primary key, which can only match once
      // the UPDATE landed (version = 2 AND content = newContent). If D1 ran
      // nothing, this would be a no-op and the batch would NOT reject.
      db.run(sql`INSERT INTO notepads (id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at)
        SELECT id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at
        FROM notepads WHERE id = ${notepad.id} AND version = 2 AND content = ${newContent}`),
    ];
    // The final statement can only throw UNIQUE constraint failed (copying the
    // row onto its own primary key) if every statement above it really ran —
    // a generic rejection (e.g. a bind error) would mean nothing executed.
    await expect(runBatch(db, statements)).rejects.toThrow(/UNIQUE constraint failed/);

    // Nothing from the batch survived: content, version, FTS, links, notifications.
    const row = await notepadRow(notepad.id);
    expect(row?.version).toBe(1);
    expect(row?.content).toBe(notepad.content);

    expect(await ftsMatches('wombat')).not.toContain(notepad.id);
    expect(await ftsMatches('quokka')).toContain(notepad.id);

    expect(
      await countRows('SELECT COUNT(*) AS n FROM notepad_links WHERE source_id = ?', notepad.id),
    ).toBe(0);
    expect(
      await countRows('SELECT COUNT(*) AS n FROM notifications WHERE notepad_id = ?', notepad.id),
    ).toBe(0);

    await expectInvariantsHold(env.DB);
  });

  it('(c) createCard is atomic: success writes every row, a failing statement writes none of them', async () => {
    const seed = await seedWorkspace();
    const { boardId, columnId } = await seedBoard(seed);

    const created = await createCard(db, {
      workspaceId: seed.workspaceId,
      actorId: seed.userId,
      boardId,
      columnId,
      title: 'Spike card',
    });
    expect(created.linkedNotepadId).toBeNull();

    const card = await env.DB.prepare('SELECT notepad_id FROM cards WHERE id = ?')
      .bind(created.cardId)
      .first<{ notepad_id: string }>();
    expect(card?.notepad_id).toBe(created.notepadId);

    const cardNotepad = await env.DB.prepare(
      'SELECT kind, title, parent_id FROM notepads WHERE id = ?',
    )
      .bind(created.notepadId)
      .first<{ kind: string; title: string; parent_id: string | null }>();
    expect(cardNotepad?.kind).toBe('card');
    expect(cardNotepad?.title).toBe('Spike card');
    expect(cardNotepad?.parent_id).toBeNull(); // I2: card notepads are not in the tree

    expect(
      await countRows(
        'SELECT COUNT(*) AS n FROM notepads_fts WHERE notepad_id = ?',
        created.notepadId,
      ),
    ).toBe(1);
    await expectInvariantsHold(env.DB);

    // Forced failure: the real card-creation statements plus a final statement
    // that only errors if the first insert really ran (duplicate primary key).
    const plan: CardPlan = {
      workspaceId: seed.workspaceId,
      projectId: seed.projectId,
      boardId,
      columnId,
      actorId: seed.userId,
      cardId: uid('card'),
      notepadId: uid('np'),
      title: 'Doomed card',
      content: '[]',
      plainText: '',
      priority: null,
      dueDate: null,
      assigneeIds: [],
      tagIds: [],
      cardPosition: 'a0',
      linkedNotepad: null,
      now: Date.now(),
    };
    const failing = [
      ...cardCreationStatements(db, plan),
      db.run(sql`INSERT INTO notepads (id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at)
        SELECT id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at
        FROM notepads WHERE id = ${plan.notepadId}`),
    ];
    // Strict: UNIQUE constraint failed proves the card insert above executed
    // (visibility within the batch) before this statement hit its own key.
    await expect(runBatch(db, failing)).rejects.toThrow(/UNIQUE constraint failed/);

    expect(
      await env.DB.prepare('SELECT id FROM cards WHERE id = ?').bind(plan.cardId).first(),
    ).toBeNull();
    expect(
      await env.DB.prepare('SELECT id FROM notepads WHERE id = ?').bind(plan.notepadId).first(),
    ).toBeNull();
    expect(
      await countRows(
        'SELECT COUNT(*) AS n FROM notepads_fts WHERE notepad_id = ?',
        plan.notepadId,
      ),
    ).toBe(0);

    await expectInvariantsHold(env.DB);
  });

  it('(d) foreign keys are enforced and ON DELETE CASCADE removes dependent rows', async () => {
    const seed = await seedWorkspace();
    const notepad = await seedNotepad(seed, 'cascade wombat');
    const { boardId } = await seedBoard(seed);

    // FK enforcement: a notepad cannot point at a project that does not exist.
    const orphan = env.DB.prepare(
      `INSERT INTO notepads (id, workspace_id, project_id, kind, title, content, version, position, created_by, created_at, updated_at)
       VALUES (?, ?, ?, 'notepad', 'Orphan', '[]', 1, 'a0', ?, ?, ?)`,
    ).bind(uid('np'), seed.workspaceId, 'no-such-project', seed.userId, Date.now(), Date.now());
    await expect(orphan.run(), 'D1 must reject inserts that violate a foreign key').rejects.toThrow(
      /FOREIGN KEY constraint failed/,
    );

    // Cascade: deleting the project takes its notepads and boards with it.
    await env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(seed.projectId).run();
    expect(
      await env.DB.prepare('SELECT id FROM notepads WHERE id = ?').bind(notepad.id).first(),
    ).toBeNull();
    expect(
      await env.DB.prepare('SELECT id FROM boards WHERE id = ?').bind(boardId).first(),
    ).toBeNull();

    // FTS virtual tables have no foreign keys — app-level deletes must clean
    // them explicitly (this is what ftsDeleteAllStmt is for).
    await env.DB.prepare(
      'DELETE FROM notepads_fts WHERE notepad_id NOT IN (SELECT id FROM notepads)',
    ).run();
    await expectInvariantsHold(env.DB);
  });

  it('(e1) a stale baseVersion save is rejected before any write happens', async () => {
    const seed = await seedWorkspace();
    const notepad = await seedNotepad(seed, 'original quokka draft');

    const stale = contentWith('stale outsider narwhal');
    await expect(
      saveContent(db, {
        notepadId: notepad.id,
        content: stale,
        baseVersion: 99,
        actorId: seed.userId,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'version_conflict' });

    const row = await notepadRow(notepad.id);
    expect(row?.version).toBe(1);
    expect(row?.content).toBe(notepad.content);

    expect(await ftsMatches('narwhal')).not.toContain(notepad.id);
    expect(
      await countRows('SELECT COUNT(*) AS n FROM notepad_links WHERE source_id = ?', notepad.id),
    ).toBe(0);
    expect(
      await countRows('SELECT COUNT(*) AS n FROM notifications WHERE notepad_id = ?', notepad.id),
    ).toBe(0);

    await expectInvariantsHold(env.DB);
  });

  it('(e2) a save that loses the version race changes nothing anywhere — content, FTS, links, notifications', async () => {
    const seed = await seedWorkspace();
    const notepad = await seedNotepad(seed, 'original quokka draft');

    // Another writer wins: version 1 -> 2 with different content.
    const winningContent = contentWith('second writer gazelle');
    await saveContent(db, {
      notepadId: notepad.id,
      content: winningContent,
      baseVersion: 1,
      actorId: seed.userId,
    });

    // Our save was prepared against version 1 and commits after the winner.
    // A version-only gate would match here (baseVersion + 1 = 2 = actual
    // version); the content check is what keeps every statement a no-op.
    const staleContent = contentMentioning(seed.member2Id, 'sneaky intruder');
    const statements = buildSaveContentStatements(db, {
      row: {
        id: notepad.id,
        workspaceId: seed.workspaceId,
        title: 'Spike notepad',
      },
      content: staleContent,
      baseVersion: 1,
      actorId: seed.userId,
      validLinks: [{ targetType: 'user', targetId: seed.member2Id }],
      previousLinks: [],
      now: Date.now(),
    });
    await runBatch(db, statements);

    const row = await notepadRow(notepad.id);
    expect(row?.version).toBe(2);
    expect(row?.content).toBe(winningContent);

    expect(await ftsMatches('sneaky')).not.toContain(notepad.id);
    expect(await ftsMatches('gazelle')).toContain(notepad.id);

    expect(
      await countRows('SELECT COUNT(*) AS n FROM notepad_links WHERE source_id = ?', notepad.id),
    ).toBe(0);
    expect(
      await countRows('SELECT COUNT(*) AS n FROM notifications WHERE notepad_id = ?', notepad.id),
    ).toBe(0);

    await expectInvariantsHold(env.DB);
  });
});
