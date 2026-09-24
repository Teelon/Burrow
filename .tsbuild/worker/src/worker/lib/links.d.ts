import { type SQL } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { ExtractedLink } from '../../shared/extract';
import type { LinkTargetType } from '../../shared/blocks';
import type { DB } from '../db/client';
export interface StoredLink {
    targetType: LinkTargetType;
    targetId: string;
}
/** Diff previous vs new references: added drives notifications, removed is a silent delete. */
export declare function diffLinks(previous: StoredLink[], next: StoredLink[]): {
    added: StoredLink[];
    removed: StoredLink[];
};
/**
 * Security rule: link rows are only ever written for targets in the caller's
 * workspace (PLAN.md section 6.1, I8). Mentions of missing/foreign targets are
 * dropped from the extraction before diffing; they never produce links or
 * notifications. Large IN (...) lists are chunked (D1: max 100 bound params).
 */
export declare function filterWorkspaceTargets(db: DB, workspaceId: string, links: ExtractedLink[] | StoredLink[]): Promise<StoredLink[]>;
/** Remove `removed` links for `sourceId`, but only if `cond` holds (4 params). */
export declare function linkDeleteStatements(db: DB, args: {
    sourceId: string;
    removed: StoredLink[];
    cond: SQL;
    condParams: number;
}): BatchItem<'sqlite'>[];
/**
 * Insert `added` links for `sourceId`, but only if `cond` holds (4 params).
 * Chunked so no statement exceeds D1's 100 bound parameters:
 * 3 params per link (source, type, id) + 4 cond params.
 */
export declare function linkInsertStatements(db: DB, args: {
    sourceId: string;
    added: StoredLink[];
    cond: SQL;
    condParams: number;
}): BatchItem<'sqlite'>[];
/**
 * One `mention` notification per newly mentioned user (actor excluded).
 *
 * Runs BEFORE link inserts and double-guards with NOT EXISTS so a concurrent
 * save of identical content cannot notify twice. Costs 6 params per row
 * (id, workspace, user, actor, notepad, created) + condParams.
 */
export declare function mentionNotificationStatements(db: DB, args: {
    workspaceId: string;
    notepadId: string;
    actorId: string;
    addedUserIds: string[];
    cond: SQL;
    condParams: number;
    now: number;
}): BatchItem<'sqlite'>[];
