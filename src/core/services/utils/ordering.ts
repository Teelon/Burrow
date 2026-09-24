import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'

/**
 * Server owns ordering: the client sends "place X after Y" and the server
 * computes the fractional index. Keys longer than this should trigger a one-off
 * rebalance of that sibling set.
 */
export const MAX_POSITION_KEY_LENGTH = 64

export function firstPosition(): string {
  return generateKeyBetween(null, null)
}

export function positionBetween(prev: string | null, next: string | null): string {
  return generateKeyBetween(prev, next)
}

/** Append after the last sibling. */
export function positionAfterLast(last: string | null): string {
  return generateKeyBetween(last, null)
}

/** Regenerate `count` keys inside (prev, next) — used when a key overflows. */
export function rebalancePositions(
  count: number,
  prev: string | null = null,
  next: string | null = null,
): string[] {
  return generateNKeysBetween(prev, next, count)
}