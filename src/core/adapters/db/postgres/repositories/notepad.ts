import type {
  INotepadRepository,
  Notepad,
  CreateNotepadData,
  UpdateNotepadData,
  NotepadContent,
  RestoredNotepad,
  HardDeletedNotepad,
  StoredLink,
  EditLock,
  MentionNotificationArgs,
} from '../../../../infrastructure/types';
import { eq, and, inArray, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import { notepads, notepadTags, notepadLinks, notifications, members, projects } from '../schema';

// Helper to safely get first element of array
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

export class PostgresNotepadRepository implements INotepadRepository {
  constructor(private db: PostgresDb) {}

  async listByProject(projectId: string): Promise<Notepad[]> {
    // Tree metadata only: live `notepad`-kind rows (excludes cards and deleted).
    return this.db
      .select()
      .from(notepads)
      .where(
        and(
          eq(notepads.projectId, projectId),
          eq(notepads.kind, 'notepad'),
          isNull(notepads.deletedAt),
        ),
      )
      .orderBy(notepads.position);
  }

  async listDeletedByProject(projectId: string): Promise<Notepad[]> {
    return this.db
      .select()
      .from(notepads)
      .where(and(eq(notepads.projectId, projectId), isNotNull(notepads.deletedAt)))
      .orderBy(desc(notepads.deletedAt));
  }

  async findById(id: string): Promise<Notepad | null> {
    const result = await this.db.select().from(notepads).where(eq(notepads.id, id)).limit(1);
    return first(result) ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Notepad | null> {
    const result = await this.db
      .select()
      .from(notepads)
      .innerJoin(projects, eq(notepads.projectId, projects.id))
      .where(and(eq(notepads.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);
    return first(result)?.notepads ?? null;
  }

  async create(data: CreateNotepadData): Promise<Notepad> {
    // Extract plain text from content JSON for FTS
    const plainText = extractPlainText(data.content);
    const result = await this.db
      .insert(notepads)
      .values({ ...data, plainText })
      .returning();
    if (!first(result)) throw new Error('Failed to create notepad');
    return first(result)!;
  }

  async update(id: string, data: UpdateNotepadData): Promise<void> {
    await this.db.update(notepads).set(data).where(eq(notepads.id, id));
  }

  async move(id: string, parentId: string | null, position: string): Promise<void> {
    await this.db
      .update(notepads)
      .set({ parentId, position, updatedAt: Date.now() })
      .where(eq(notepads.id, id));
  }

  async softDelete(id: string, deletedAt: number): Promise<void> {
    await this.db
      .update(notepads)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(eq(notepads.id, id));
  }

  async restore(id: string, deleteTimestamp: number): Promise<RestoredNotepad[]> {
    const result = await this.db
      .select({
        id: notepads.id,
        parentId: notepads.parentId,
        title: notepads.title,
        content: notepads.content,
        projectId: notepads.projectId,
      })
      .from(notepads)
      .where(and(eq(notepads.id, id), eq(notepads.deletedAt, deleteTimestamp)))
      .limit(1);

    if (result.length === 0) return [];

    await this.db
      .update(notepads)
      .set({ deletedAt: null, updatedAt: Date.now() })
      .where(eq(notepads.id, id));

    return result;
  }

  async hardDelete(id: string): Promise<HardDeletedNotepad[]> {
    const result = await this.db
      .select({ id: notepads.id, coverKey: notepads.coverKey })
      .from(notepads)
      .where(eq(notepads.id, id))
      .limit(1);

    await this.db.delete(notepads).where(eq(notepads.id, id));
    return result;
  }

  // Content & versioning
  async getContent(id: string): Promise<NotepadContent | null> {
    const result = await this.db
      .select({
        id: notepads.id,
        workspaceId: notepads.workspaceId,
        title: notepads.title,
        content: notepads.content,
        version: notepads.version,
      })
      .from(notepads)
      .where(eq(notepads.id, id))
      .limit(1);
    return first(result) ?? null;
  }

  async saveContent(id: string, content: string, expectedVersion: number): Promise<number> {
    const plainText = extractPlainText(content);
    const result = await this.db
      .update(notepads)
      .set({
        content,
        plainText,
        version: expectedVersion + 1,
        updatedAt: Date.now(),
      })
      .where(and(eq(notepads.id, id), eq(notepads.version, expectedVersion)))
      .returning({ version: notepads.version });

    if (result.length === 0) {
      throw new Error('Version conflict');
    }
    return first(result)!.version;
  }

  // Tree navigation
  async getChildren(parentIds: string[]): Promise<{ id: string; parentId: string | null }[]> {
    if (parentIds.length === 0) return [];
    return this.db
      .select({ id: notepads.id, parentId: notepads.parentId })
      .from(notepads)
      .where(inArray(notepads.parentId, parentIds));
  }

  async getParent(id: string): Promise<{ id: string; parentId: string | null } | null> {
    const result = await this.db
      .select({ id: notepads.id, parentId: notepads.parentId })
      .from(notepads)
      .where(eq(notepads.id, id))
      .limit(1);
    if (result.length === 0) return null;
    const row = first(result)!;
    if (!row.parentId) return null;
    return { id: row.id, parentId: row.parentId };
  }

  // Link validation
  async isValidLink(link: { targetType: string; targetId: string }): Promise<boolean> {
    // For now, just check if target exists based on type
    switch (link.targetType) {
      case 'notepad':
      case 'card':
        return this.db
          .select({ id: notepads.id })
          .from(notepads)
          .where(eq(notepads.id, link.targetId))
          .limit(1)
          .then((r) => r.length > 0);
      case 'board':
        return this.db
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.id, link.targetId))
          .limit(1)
          .then((r) => r.length > 0);
      case 'user':
        return this.db
          .select({ id: members.userId })
          .from(members)
          .where(eq(members.userId, link.targetId))
          .limit(1)
          .then((r) => r.length > 0);
      default:
        return false;
    }
  }

  // Tags
  async listTagIds(notepadId: string): Promise<string[]> {
    const result = await this.db
      .select({ tagId: notepadTags.tagId })
      .from(notepadTags)
      .where(eq(notepadTags.notepadId, notepadId));
    return result.map((r) => r.tagId);
  }

  async setTagIds(notepadId: string, tagIds: string[]): Promise<void> {
    await this.db.delete(notepadTags).where(eq(notepadTags.notepadId, notepadId));
    if (tagIds.length > 0) {
      await this.db.insert(notepadTags).values(tagIds.map((tagId) => ({ notepadId, tagId })));
    }
  }

  // Locks
  async getLock(_notepadId: string): Promise<EditLock | null> {
    // Delegated to lock adapter, but kept for interface compatibility
    return null; // Actual lock reading is in lock adapter
  }

  // FTS
  async deleteFts(_notepadId: string): Promise<void> {
    // FTS is handled by generated column, no separate table
  }

  async insertFts(notepadId: string, _title: string, body: string): Promise<void> {
    // FTS is handled by generated column, no separate table
    await this.db.update(notepads).set({ plainText: body }).where(eq(notepads.id, notepadId));
  }

  async insertFtsConditional(
    notepadId: string,
    _title: string,
    body: string,
    version: number,
    content: string,
  ): Promise<void> {
    await this.db
      .update(notepads)
      .set({ plainText: body, version, content, updatedAt: Date.now() })
      .where(and(eq(notepads.id, notepadId), eq(notepads.version, version)));
  }

  // Links
  async listLinks(sourceId: string): Promise<StoredLink[]> {
    const result = await this.db
      .select({
        targetType: notepadLinks.targetType,
        targetId: notepadLinks.targetId,
      })
      .from(notepadLinks)
      .where(eq(notepadLinks.sourceId, sourceId));
    return result as StoredLink[];
  }

  async replaceLinks(
    sourceId: string,
    added: StoredLink[],
    removed: StoredLink[],
    _version: number,
    _content: string,
  ): Promise<void> {
    // Remove old links
    if (removed.length > 0) {
      for (const link of removed) {
        await this.db
          .delete(notepadLinks)
          .where(
            and(
              eq(notepadLinks.sourceId, sourceId),
              eq(notepadLinks.targetType, link.targetType),
              eq(notepadLinks.targetId, link.targetId),
            ),
          );
      }
    }
    // Add new links
    if (added.length > 0) {
      await this.db.insert(notepadLinks).values(
        added.map((link) => ({
          sourceId,
          targetType: link.targetType,
          targetId: link.targetId,
        })),
      );
    }
  }

  async listBacklinks(notepadId: string): Promise<{ id: string; title: string }[]> {
    const rows = await this.db
      .select({ id: notepads.id, title: notepads.title })
      .from(notepadLinks)
      .innerJoin(notepads, eq(notepads.id, notepadLinks.sourceId))
      .where(
        and(
          eq(notepadLinks.targetId, notepadId),
          eq(notepadLinks.targetType, 'notepad'),
          isNull(notepads.deletedAt)
        )
      );
    return rows;
  }

  // Mentions
  async insertMentions(args: MentionNotificationArgs): Promise<void> {
    const now = args.now;
    const values = args.addedUserIds.map((userId) => ({
      id: `notif_${now}_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: args.workspaceId,
      userId,
      type: 'mention' as const,
      actorId: args.actorId,
      notepadId: args.notepadId,
      cardId: null,
      readAt: null,
      createdAt: now,
    }));
    if (values.length > 0) {
      await this.db.insert(notifications).values(values);
    }
  }

  // Position helpers
  async getLastChildPosition(parentId: string): Promise<string | null> {
    const result = await this.db
      .select({ position: notepads.position })
      .from(notepads)
      .where(eq(notepads.parentId, parentId))
      .orderBy(desc(notepads.position))
      .limit(1);
    const row = first(result);
    return row?.position ?? null;
  }

  async getLastRootPosition(projectId: string): Promise<string | null> {
    const result = await this.db
      .select({ position: notepads.position })
      .from(notepads)
      .where(and(eq(notepads.projectId, projectId), isNull(notepads.parentId)))
      .orderBy(desc(notepads.position))
      .limit(1);
    const row = first(result);
    return row?.position ?? null;
  }

  async getLastRootNotepadPosition(projectId: string): Promise<string> {
    const result = await this.db
      .select({ position: notepads.position })
      .from(notepads)
      .where(
        and(
          eq(notepads.projectId, projectId),
          isNull(notepads.parentId),
          eq(notepads.kind, 'notepad'),
        ),
      )
      .orderBy(desc(notepads.position))
      .limit(1);
    const row = first(result);
    return row?.position ?? 'a';
  }

  // Search/suggest
  async findByPattern(
    projectId: string,
    pattern: string,
    limit: number,
  ): Promise<{ id: string; title: string; icon: string | null }[]> {
    const result = await this.db
      .select({
        id: notepads.id,
        title: notepads.title,
        icon: notepads.icon,
      })
      .from(notepads)
      .where(and(eq(notepads.projectId, projectId), sql`${notepads.title} ILIKE ${`%${pattern}%`}`))
      .limit(limit);
    return result;
  }
}

function extractPlainText(contentJson: string): string {
  try {
    const blocks = JSON.parse(contentJson);
    if (!Array.isArray(blocks)) return '';
    return blocks
      .map((block: any) => {
        if (block.type === 'paragraph' && block.props?.text) return block.props.text;
        if (block.type === 'heading' && block.props?.text) return block.props.text;
        if (block.type === 'bullet' && block.props?.text) return block.props.text;
        if (block.type === 'numbered' && block.props?.text) return block.props.text;
        if (block.type === 'todo' && block.props?.text) return block.props.text;
        if (block.type === 'quote' && block.props?.text) return block.props.text;
        if (block.type === 'code' && block.props?.text) return block.props.text;
        return '';
      })
      .join(' ');
  } catch {
    return '';
  }
}
