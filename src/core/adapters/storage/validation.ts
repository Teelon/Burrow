/**
 * Validates a storage key to prevent path traversal, drive-letter escapes,
 * null-byte injection, and malformed segments.
 *
 * @returns The normalized key with backslashes replaced by forward slashes.
 * @throws Error if key is invalid or attempts directory traversal.
 */
export function validateStorageKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid storage key: key must be a non-empty string');
  }
  if (key.includes('\0')) {
    throw new Error('Invalid storage key: key contains null byte');
  }
  if (/^[a-zA-Z]:[\\/]/.test(key)) {
    throw new Error(`Invalid storage key (drive letter): ${key}`);
  }
  if (key.startsWith('/') || key.startsWith('\\')) {
    throw new Error(`Invalid storage key (leading slash): ${key}`);
  }
  const normalized = key.split('\\').join('/');
  const segments = normalized.split('/');
  if (segments.some((seg) => seg === '..' || seg === '')) {
    throw new Error(`Invalid storage key (traversal/empty segment): ${key}`);
  }
  return normalized;
}

/**
 * Validates a storage prefix to ensure safe deletion boundaries.
 * Prefixes cannot be empty, root, or contain traversal segments.
 *
 * @returns The normalized prefix with backslashes replaced by forward slashes.
 * @throws Error if prefix is empty, root, or attempts traversal.
 */
export function validateStoragePrefix(prefix: string): string {
  if (!prefix || typeof prefix !== 'string' || prefix.trim() === '') {
    throw new Error('Invalid storage prefix: prefix cannot be empty');
  }
  if (prefix.includes('\0')) {
    throw new Error('Invalid storage prefix: prefix contains null byte');
  }
  if (/^[a-zA-Z]:[\\/]/.test(prefix)) {
    throw new Error(`Invalid storage prefix (drive letter): ${prefix}`);
  }
  if (prefix.startsWith('/') || prefix.startsWith('\\')) {
    throw new Error(`Invalid storage prefix (leading slash): ${prefix}`);
  }
  const normalized = prefix.split('\\').join('/');
  if (normalized === '.' || normalized === './') {
    throw new Error(`Invalid storage prefix (root): ${prefix}`);
  }
  const segments = normalized.split('/');
  if (segments.includes('..')) {
    throw new Error(`Invalid storage prefix (traversal): ${prefix}`);
  }
  return normalized;
}

