/**
 * Stored object returned by IStorageAdapter.get().
 */
export interface StorageObject {
  /** Object body as a ReadableStream, ArrayBuffer, or Uint8Array. */
  body: ReadableStream | ArrayBuffer | Uint8Array;
  /** MIME type of the stored object, if known or provided on put(). */
  contentType?: string;
  /** Size in bytes, if known. */
  contentLength?: number;
  /** Entity tag (ETag) if available. */
  etag?: string;
  /** Timestamp when the object was last modified/uploaded. */
  lastModified?: Date;
}

/**
 * Filter and operational semantics for storage adapters:
 *
 * - Key semantics:
 *   - Keys must be non-empty strings representing relative, normalized paths (e.g. `${workspaceId}/${id}.${ext}`).
 *   - Keys must NOT start with a forward slash ('/') or backslash ('\\').
 *   - Keys must NOT contain Windows drive letters (e.g. 'C:'), null bytes ('\0'), or traversal segments ('..').
 *   - Empty path segments (e.g. '//') are disallowed.
 *
 * - Method semantics:
 *   - put(key, data, contentType?): Writes or overwrites binary data at `key`. Validates `key`.
 *   - get(key): Returns `StorageObject` if found, or `null` if the key does not exist. Validates `key`.
 *   - delete(key): Deletes the object at `key`. Must be idempotent: succeeds even if `key` does not exist. Validates `key`.
 *   - deletePrefix(prefix): Deletes all objects matching the prefix. `prefix` must be a non-empty, non-root string
 *     without traversal ('..') or null bytes. Throws Error('Invalid storage prefix') if prefix is empty or invalid.
 */
export interface IStorageAdapter {
  put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
}

