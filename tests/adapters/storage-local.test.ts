// @vitest-environment node
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageAdapter } from '../../src/worker/adapters/storage/local';
import type { StorageObject } from '../../src/worker/adapters/storage/types';

async function bodyToBytes(body: StorageObject['body']): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const bytes = value as Uint8Array;
      chunks.push(bytes);
      total += bytes.length;
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

describe('LocalStorageAdapter', () => {
  let root = '';
  let adapter: LocalStorageAdapter;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'burrow-storage-test-'));
    adapter = new LocalStorageAdapter(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes via put/get', async () => {
    const key = `docs/${randomUUID()}.txt`;
    const data = new TextEncoder().encode('hello burrow carrot');
    await adapter.put(key, data, 'text/plain');

    const obj = await adapter.get(key);
    if (!obj) throw new Error('expected stored object');
    expect(new TextDecoder().decode(await bodyToBytes(obj.body))).toBe('hello burrow carrot');
    expect(obj.contentLength).toBe(data.byteLength);
    // The local adapter accepts contentType on put but persists bytes only.
    expect(obj.contentType).toBeUndefined();
  });

  it('round-trips an ArrayBuffer payload', async () => {
    const key = `bin/${randomUUID()}.bin`;
    const buf = new ArrayBuffer(4);
    new Uint8Array(buf).set([0, 1, 250, 255]);
    await adapter.put(key, buf, 'application/octet-stream');

    const obj = await adapter.get(key);
    if (!obj) throw new Error('expected stored object');
    expect(Array.from(await bodyToBytes(obj.body))).toEqual([0, 1, 250, 255]);
  });

  it('returns null for a missing key', async () => {
    expect(await adapter.get(`missing/${randomUUID()}.txt`)).toBeNull();
  });

  it('delete removes the key and is idempotent', async () => {
    const key = `docs/${randomUUID()}.txt`;
    await adapter.put(key, new TextEncoder().encode('temporary'));

    await adapter.delete(key);
    expect(await adapter.get(key)).toBeNull();

    // Deleting again (or deleting a never-written key) must not throw.
    await adapter.delete(key);
    await adapter.delete(`never-written/${randomUUID()}.txt`);
  });

  it('deletePrefix removes only the matching subtree', async () => {
    const scope = `scope-${randomUUID()}`;
    const other = `other-${randomUUID()}`;
    await adapter.put(`${scope}/a.txt`, new TextEncoder().encode('a'));
    await adapter.put(`${scope}/nested/b.txt`, new TextEncoder().encode('b'));
    await adapter.put(`${other}/c.txt`, new TextEncoder().encode('c'));

    await adapter.deletePrefix(scope);

    expect(await adapter.get(`${scope}/a.txt`)).toBeNull();
    expect(await adapter.get(`${scope}/nested/b.txt`)).toBeNull();
    const survivor = await adapter.get(`${other}/c.txt`);
    if (!survivor) throw new Error('expected surviving object');
    expect(new TextDecoder().decode(await bodyToBytes(survivor.body))).toBe('c');
  });

  it('rejects path-traversal keys', async () => {
    const data = new TextEncoder().encode('evil');
    await expect(adapter.put('../evil.txt', data)).rejects.toThrow();
    await expect(adapter.put(`ok/${randomUUID()}/../../evil.txt`, data)).rejects.toThrow();
    await expect(adapter.get('..')).rejects.toThrow();
  });
});
