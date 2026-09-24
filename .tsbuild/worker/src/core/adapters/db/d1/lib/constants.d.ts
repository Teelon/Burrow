/** Root notepads are depth 1; reject anything deeper than 8 (PLAN.md section 6). */
export declare const MAX_NOTEPAD_DEPTH = 8;
/** D1 rows are limited to ~2MB; reject oversized content with 413. */
export declare const MAX_CONTENT_BYTES = 1500000;
/** Rolling edit-lock window (ms). Passed as ttlMs to the lock adapter. */
export declare const LOCK_TTL_MS = 60000;
