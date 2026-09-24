/**
 * Server owns ordering: the client sends "place X after Y" and the server
 * computes the fractional index. Keys longer than this should trigger a one-off
 * rebalance of that sibling set (see PLAN.md section 7, ordering contract).
 */
export declare const MAX_POSITION_KEY_LENGTH = 64;
export declare function firstPosition(): string;
export declare function positionBetween(prev: string | null, next: string | null): string;
/** Append after the last sibling. */
export declare function positionAfterLast(last: string | null): string;
/** Regenerate `count` keys inside (prev, next) — used when a key overflows. */
export declare function rebalancePositions(count: number, prev?: string | null, next?: string | null): string[];
