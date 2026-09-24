import type { ExtractedLink } from './extract';
import type { LinkTargetType } from './blocks';
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
 * workspace. Mentions of missing/foreign targets are dropped from the extraction
 * before diffing; they never produce links or notifications.
 *
 * This is a pure function that filters links based on a validation function.
 * The actual workspace validation is done by the repository implementation.
 */
export declare function filterWorkspaceTargets(links: ExtractedLink[] | StoredLink[], isValid: (link: ExtractedLink | StoredLink) => boolean): StoredLink[];
