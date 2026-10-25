/**
 * Compute SHA-256 hex digest of a token string.
 * Used for hashing invite tokens so raw tokens are never stored.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time string comparison using SHA-256 hashes to prevent timing attacks.
 */
export async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const hashA = await hashToken(a ?? '');
  const hashB = await hashToken(b ?? '');
  let mismatch = 0;
  for (let i = 0; i < hashA.length; i++) {
    mismatch |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  }
  return Boolean(a && b && mismatch === 0);
}

