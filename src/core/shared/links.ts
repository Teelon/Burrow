import type { ExtractedLink } from './extract'
import type { LinkTargetType } from './blocks'

export interface StoredLink {
  targetType: LinkTargetType
  targetId: string
}

const linkKey = (l: { targetType: string; targetId: string }) => `${l.targetType}:${l.targetId}`

/** Diff previous vs new references: added drives notifications, removed is a silent delete. */
export function diffLinks(
  previous: StoredLink[],
  next: StoredLink[],
): { added: StoredLink[]; removed: StoredLink[] } {
  const prevMap = new Map(previous.map((l) => [linkKey(l), l]))
  const nextMap = new Map(next.map((l) => [linkKey(l), l]))
  const added = [...nextMap.entries()].filter(([k]) => !prevMap.has(k)).map(([, v]) => v)
  const removed = [...prevMap.entries()].filter(([k]) => !nextMap.has(k)).map(([, v]) => v)
  return { added, removed }
}

/**
 * Security rule: link rows are only ever written for targets in the caller's
 * workspace. Mentions of missing/foreign targets are dropped from the extraction
 * before diffing; they never produce links or notifications.
 * 
 * This is a pure function that filters links based on a validation function.
 * The actual workspace validation is done by the repository implementation.
 */
export function filterWorkspaceTargets(
  links: ExtractedLink[] | StoredLink[],
  isValid: (link: ExtractedLink | StoredLink) => boolean,
): StoredLink[] {
  return links.filter((l) => isValid(l))
}