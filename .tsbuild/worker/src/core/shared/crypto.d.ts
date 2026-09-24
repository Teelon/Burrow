/**
 * Compute SHA-256 hex digest of a token string.
 * Used for hashing invite tokens so raw tokens are never stored.
 */
export declare function hashToken(token: string): Promise<string>;
