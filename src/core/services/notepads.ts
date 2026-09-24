import { nanoid } from 'nanoid';
import type {
  INotepadRepository,
  ITagRepository,
  Notepad,
  StoredLink,
} from '../infrastructure/types';
import { notFound, badRequest, conflict, payloadTooLarge } from './errors';
import { positionBetween } from './utils/ordering';
import { chunkByParamBudget } from './utils/chunk';
import { extractFromContent, extractPlainText, type ExtractedLink } from '../shared/extract';
import { diffLinks } from '../shared/links';
import { getDescendantIds, getDepth, getSubtreeHeight, wouldCauseCycle } from '../shared/tree';
import type { ILockAdapter } from '../adapters/lock';

/** Root notepads are depth 1; reject anything deeper than 8. */
export const MAX_NOTEPAD_DEPTH = 8;
/** D1 rows are limited to ~2MB; reject oversized content with 413. */
export const MAX_CONTENT_BYTES = 1_500_000;
/** Rolling edit-lock window (ms). */
export const LOCK_TTL_MS = 60_000;

export interface CreateNotepadArgs {
  workspaceId: string;
  projectId: string;
  parentId?: string | null;
  title?: string;
  createdBy: string;
  position?: string;
}

export interface CreatedNotepad {
  id: string;
  position: string;
  version: number;
}

export interface MoveNotepadArgs {
  workspaceId: string;
  notepadId: string;
  parentId?: string | null;
  afterId?: string | null;
}

export interface SoftDeleteNotepadArgs {
  workspaceId: string;
  notepadId: string;
}

export interface RestoreNotepadArgs {
  workspaceId: string;
  notepadId: string;
}

export interface PermanentDeleteNotepadArgs {
  workspaceId: string;
  notepadId: string;
  storage?: IStorageAdapter | null;
}

export interface SaveContentArgs {
  notepadId: string;
  content: string;
  baseVersion: number;
  actorId: string;
  clientId?: string;
}

export interface SaveContentResult {
  version: number;
}

export interface PreparedSave {
  row: { id: string; workspaceId: string; title: string; version: number };
  validLinks: StoredLink[];
  previousLinks: StoredLink[];
}

export interface SaveStatementArgs {
  row: { id: string; workspaceId: string; title: string };
  content: string;
  baseVersion: number;
  actorId: string;
  validLinks: StoredLink[];
  previousLinks: StoredLink[];
  now: number;
}

export interface ClaimLockArgs {
  notepadId: string;
  userId: string;
  clientId: string;
  takeover?: boolean;
}

export interface IStorageAdapter {
  delete(key: string): Promise<void>;
}

export class NotepadService {
  constructor(
    private readonly repos: {
      notepads: INotepadRepository;
      tags: ITagRepository;
    },
    private readonly locks: ILockAdapter,
    private readonly storage?: IStorageAdapter,
  ) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------
  async createNotepad(args: CreateNotepadArgs): Promise<CreatedNotepad> {
    // Note: Project validation should be done by caller or project service
    // For now we assume project exists and is accessible

    let position = args.position ?? null;
    if (args.parentId) {
      const parent = await this.repos.notepads.findById(args.parentId);
      if (!parent || parent.deletedAt !== null || parent.kind !== 'notepad') {
        throw notFound('not_found', 'Parent notepad not found');
      }
      const parentDepth = await getDepth((id) => this.repos.notepads.getParent(id), parent.id);
      if (parentDepth + 1 > MAX_NOTEPAD_DEPTH) {
        throw badRequest('too_deep', `Notepads can nest at most ${MAX_NOTEPAD_DEPTH} deep`);
      }
      if (!position) position = await this.repos.notepads.getLastChildPosition(parent.id);
    } else if (!position) {
      position = await this.repos.notepads.getLastRootPosition(args.projectId);
    }

    // Ensure position is never null (fallback)
    if (!position) position = 'a0';

    const id = nanoid();
    const now = Date.now();
    const title = args.title?.trim() || 'Untitled';

    await this.repos.notepads.create({
      id,
      workspaceId: args.workspaceId,
      projectId: args.projectId,
      parentId: args.parentId ?? null,
      kind: 'notepad',
      title,
      content: '[]',
      version: 1,
      position,
      isFavorite: false,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });

    // Insert FTS row for new notepad
    await this.repos.notepads.insertFts(id, title, '');

    return { id, position, version: 1 };
  }

  // ---------------------------------------------------------------------------
  // Move
  // ---------------------------------------------------------------------------
  async moveNotepad(args: MoveNotepadArgs): Promise<{ parentId: string | null; position: string }> {
    const notepad = await this.repos.notepads.findByIdAndWorkspace(
      args.notepadId,
      args.workspaceId,
    );
    if (!notepad || notepad.deletedAt !== null) {
      throw notFound('not_found', 'Notepad not found');
    }

    if (notepad.kind === 'card') {
      throw badRequest('cannot_move_card_notepad', 'Cards cannot be moved in the notepad tree');
    }

    const targetParentId = args.parentId === undefined ? notepad.parentId : args.parentId;

    // Cycle check
    if (targetParentId) {
      if (
        await wouldCauseCycle(
          (rootId) =>
            getDescendantIds((parentIds) => this.repos.notepads.getChildren(parentIds), rootId),
          args.notepadId,
          targetParentId,
        )
      ) {
        throw badRequest('cycle_detected', 'Cannot move a notepad under its own descendant');
      }

      const parent = await this.repos.notepads.findById(targetParentId);
      if (
        !parent ||
        parent.projectId !== notepad.projectId ||
        parent.deletedAt !== null ||
        parent.kind !== 'notepad'
      ) {
        throw notFound('not_found', 'Target parent not found');
      }

      const parentDepth = await getDepth((id) => this.repos.notepads.getParent(id), parent.id);
      const subtreeHeight = await getSubtreeHeight(
        (parentIds) => this.repos.notepads.getChildren(parentIds),
        args.notepadId,
      );
      if (parentDepth + subtreeHeight > MAX_NOTEPAD_DEPTH) {
        throw badRequest('too_deep', `Move would exceed max depth of ${MAX_NOTEPAD_DEPTH}`);
      }
    }

    // Calculate new position among target siblings
    const siblings = await this.getSiblings(notepad.projectId, targetParentId);
    const otherSiblings = siblings.filter((s) => s.id !== args.notepadId);

    let newPosition: string;
    if (!args.afterId) {
      const next = otherSiblings[0]?.position ?? null;
      newPosition = positionBetween(null, next);
    } else {
      const afterIndex = otherSiblings.findIndex((s) => s.id === args.afterId);
      if (afterIndex === -1)
        throw badRequest('invalid_after_id', 'afterId not found among siblings');
      const prev = otherSiblings[afterIndex]!.position;
      const next = otherSiblings[afterIndex + 1]?.position ?? null;
      newPosition = positionBetween(prev, next);
    }

    await this.repos.notepads.move(args.notepadId, targetParentId, newPosition);
    return { parentId: targetParentId, position: newPosition };
  }

  private async getSiblings(projectId: string, parentId: string | null): Promise<Notepad[]> {
    // This is a simplified version - in reality we'd need a repository method
    // that filters by projectId, parentId, deletedAt, and kind
    // For now, we'll list all by project and filter in memory
    const all = await this.repos.notepads.listByProject(projectId);
    return all.filter(
      (n) =>
        (parentId ? n.parentId === parentId : n.parentId === null) &&
        n.deletedAt === null &&
        n.kind === 'notepad',
    );
  }

  // ---------------------------------------------------------------------------
  // Soft Delete
  // ---------------------------------------------------------------------------
  async softDeleteNotepad(args: SoftDeleteNotepadArgs): Promise<void> {
    const notepad = await this.repos.notepads.findByIdAndWorkspace(
      args.notepadId,
      args.workspaceId,
    );
    if (!notepad || notepad.deletedAt !== null) {
      throw notFound('not_found', 'Notepad not found');
    }

    if (notepad.kind === 'card') {
      throw badRequest(
        'cannot_delete_card_notepad',
        'Card notepads must be deleted via card service',
      );
    }

    const descendants = await getDescendantIds(
      (parentIds) => this.repos.notepads.getChildren(parentIds),
      args.notepadId,
    );
    const allIds = [args.notepadId, ...descendants];
    const now = Date.now();

    // Set identical deleted_at timestamp on subtree and remove from FTS
    for (const chunk of chunkByParamBudget(allIds, 1, 1)) {
      const id = chunk[0];
      if (id) await this.repos.notepads.softDelete(id, now); // Simplified - need batch
      // TODO: Proper batch soft delete for multiple IDs
    }

    for (const chunk of chunkByParamBudget(allIds, 1, 0)) {
      for (const id of chunk) {
        await this.repos.notepads.deleteFts(id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Restore
  // ---------------------------------------------------------------------------
  async restoreNotepad(args: RestoreNotepadArgs): Promise<void> {
    const notepad = await this.repos.notepads.findByIdAndWorkspace(
      args.notepadId,
      args.workspaceId,
    );
    if (!notepad || notepad.deletedAt === null) {
      throw notFound('not_found', 'Deleted notepad not found');
    }

    if (notepad.kind === 'card') {
      throw badRequest(
        'cannot_restore_card_notepad',
        'Card notepads must be restored via card service',
      );
    }

    const deleteTimestamp = notepad.deletedAt!;

    // Restore exactly the rows sharing this deletion timestamp
    const matchingNotepads = await this.repos.notepads.restore(args.notepadId, deleteTimestamp);

    // Check if restored root's parent is still deleted or missing
    let newParentId = notepad.parentId;
    let newPosition: string | null = null;
    if (notepad.parentId) {
      const parent = await this.repos.notepads.findById(notepad.parentId);
      if (!parent || parent.deletedAt !== null) {
        newParentId = null;
        newPosition = await this.repos.notepads.getLastRootPosition(notepad.projectId);
      }
    }

    if (newParentId !== notepad.parentId || newPosition) {
      await this.repos.notepads.move(args.notepadId, newParentId, newPosition ?? notepad.position);
    }

    // Restore FTS entries
    for (const item of matchingNotepads) {
      await this.repos.notepads.insertFts(item.id, item.title, extractPlainText(item.content));
    }
  }

  // ---------------------------------------------------------------------------
  // Permanent Delete
  // ---------------------------------------------------------------------------
  async permanentDeleteNotepad(args: PermanentDeleteNotepadArgs): Promise<void> {
    const notepad = await this.repos.notepads.findByIdAndWorkspace(
      args.notepadId,
      args.workspaceId,
    );
    if (!notepad) throw notFound('not_found', 'Notepad not found');

    if (notepad.deletedAt === null) {
      throw badRequest('not_in_trash', 'Only items in trash can be permanently deleted');
    }

    const descendants = await getDescendantIds(
      (parentIds) => this.repos.notepads.getChildren(parentIds),
      args.notepadId,
    );
    const allIds = [args.notepadId, ...descendants];

    // Collect cover keys for R2 cleanup
    const allRows = await Promise.all(allIds.map((id) => this.repos.notepads.findById(id)));
    const r2Keys = allRows.map((r) => r?.coverKey).filter((k): k is string => Boolean(k));

    // Hard delete (cascades via FK: notepadTags, notepadLinks, etc.)
    for (const id of allIds) {
      await this.repos.notepads.hardDelete(id);
    }

    // Post-batch best-effort cleanup of R2 files
    if (this.storage && r2Keys.length > 0) {
      try {
        await Promise.allSettled(r2Keys.map((k) => this.storage!.delete(k)));
      } catch (err) {
        console.warn('R2 cleanup error after notepad deletion', err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Content Save
  // ---------------------------------------------------------------------------
  async prepareSave(args: SaveContentArgs): Promise<PreparedSave> {
    const row = await this.repos.notepads.getContent(args.notepadId);
    if (!row) throw notFound('not_found', 'Notepad not found');

    const extraction = extractFromContent(args.content);
    const validLinks: StoredLink[] = [];
    for (const link of extraction.links as ExtractedLink[]) {
      if (await this.repos.notepads.isValidLink(link)) {
        validLinks.push(link);
      }
    }
    const previousLinks = await this.repos.notepads.listLinks(args.notepadId);

    return {
      row: {
        id: args.notepadId,
        workspaceId: row.workspaceId,
        title: row.title,
        version: row.version,
      },
      validLinks,
      previousLinks,
    };
  }

  async saveContent(args: SaveContentArgs): Promise<SaveContentResult> {
    if (byteLength(args.content) > MAX_CONTENT_BYTES) {
      throw payloadTooLarge('content_too_large', 'Notepad content exceeds 1.5 MB');
    }

    // Check live edit lock
    const now = Date.now();
    const lock = await this.repos.notepads.getLock(args.notepadId);

    if (
      lock &&
      lock.expiresAt > now &&
      (lock.userId !== args.actorId || (args.clientId && lock.clientId !== args.clientId))
    ) {
      const holderName = 'Someone'; // Would need user repo to get name
      throw conflict(
        'locked',
        JSON.stringify({
          code: 'locked',
          holder: {
            userId: lock.userId,
            name: holderName,
            isMe: lock.userId === args.actorId,
          },
          expiresAt: lock.expiresAt,
        }),
      );
    }

    const prepared = await this.prepareSave(args);
    if (prepared.row.version !== args.baseVersion) {
      throw conflict('version_conflict', 'This notepad changed elsewhere');
    }

    await this.buildAndExecuteSaveStatements({
      row: prepared.row,
      content: args.content,
      baseVersion: args.baseVersion,
      actorId: args.actorId,
      validLinks: prepared.validLinks,
      previousLinks: prepared.previousLinks,
      now,
    });

    const after = await this.repos.notepads.getContent(args.notepadId);
    if (!after || after.content !== args.content) {
      throw conflict('version_conflict', 'This notepad changed elsewhere');
    }
    return { version: after.version };
  }

  private async buildAndExecuteSaveStatements(args: SaveStatementArgs): Promise<void> {
    const { row, content, baseVersion, actorId, validLinks, previousLinks, now } = args;
    const newVersion = baseVersion + 1;
    const plain = extractPlainText(content);
    const { added, removed } = diffLinks(previousLinks, validLinks);

    // In the core service, we build the statement args and delegate execution
    // to the infrastructure layer (which has runBatch). For Phase 1, we'll
    // call the repository methods directly which should handle batching internally.

    // Update notepad content with version check
    await this.repos.notepads.saveContent(row.id, content, baseVersion);

    // Conditional FTS update
    await this.repos.notepads.insertFtsConditional(row.id, row.title, plain, newVersion, content);

    // Mentions
    const addedUserIds = added.filter((l) => l.targetType === 'user').map((l) => l.targetId);
    if (addedUserIds.length > 0) {
      await this.repos.notepads.insertMentions({
        workspaceId: row.workspaceId,
        notepadId: row.id,
        actorId,
        addedUserIds,
        version: newVersion,
        content,
        now,
      });
    }

    // Link sync
    if (removed.length > 0 || added.length > 0) {
      await this.repos.notepads.replaceLinks(row.id, added, removed, newVersion, content);
    }
  }

  // The buildSaveContentStatements is moved to infrastructure layer since it
  // produces Drizzle-specific BatchItem[]. Services return statement args instead.
  // If needed for atomicity spike, infrastructure can expose a similar function.

  // ---------------------------------------------------------------------------
  // Edit Locks
  // ---------------------------------------------------------------------------
  async claimLock(args: ClaimLockArgs): Promise<{ expiresAt: number }> {
    const result = await this.locks.acquire(
      args.notepadId,
      args.userId,
      args.clientId,
      LOCK_TTL_MS,
      { takeover: args.takeover },
    );

    if (!result.acquired) {
      throw conflict(
        'locked',
        JSON.stringify({
          code: 'locked',
          holder: {
            userId: result.holderUserId,
            name: result.holderName || 'Someone',
            isMe: result.holderUserId === args.userId,
          },
          expiresAt: result.expiresAt,
        }),
      );
    }

    return { expiresAt: result.expiresAt! };
  }

  async releaseLock(args: ClaimLockArgs): Promise<void> {
    await this.locks.release(args.notepadId, args.clientId);
  }

  // ---------------------------------------------------------------------------
  // Tags
  // ---------------------------------------------------------------------------
  async setNotepadTags(notepadId: string, tagIds: string[], workspaceId: string): Promise<void> {
    const notepad = await this.repos.notepads.findByIdAndWorkspace(notepadId, workspaceId);
    if (!notepad) throw notFound('not_found', 'Notepad not found');

    // Invariant I9: Every tag must belong to the notepad's project
    const uniqueTagIds = [...new Set(tagIds)];
    if (uniqueTagIds.length > 0) {
      for (const tagId of uniqueTagIds) {
        const tag = await this.repos.tags.findById(tagId);
        if (!tag || tag.projectId !== notepad.projectId) {
          throw badRequest('invalid_tags', 'All tags must belong to the notepad project');
        }
      }
    }

    await this.repos.notepads.setTagIds(notepadId, uniqueTagIds);
  }

  // ---------------------------------------------------------------------------
  // Tree Queries
  // ---------------------------------------------------------------------------
  async getTree(projectId: string): Promise<Notepad[]> {
    return this.repos.notepads.listByProject(projectId);
  }

  async listByProject(projectId: string): Promise<Notepad[]> {
    return this.repos.notepads.listByProject(projectId);
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
