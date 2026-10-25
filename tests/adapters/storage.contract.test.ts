import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { R2StorageAdapter } from '../../src/core/adapters/storage/r2';
import type { StorageObject } from '../../src/core/adapters/storage/types';

async function bodyToBytes(body: StorageObject['body']): Promise<Uint8Array> {
  if (body instanceof Uint8Array) return body;
  if (body instanceof ArrayBuffer) return new Uint8Array(body);
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
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

describe('R2StorageAdapter contract', () => {
  let adapter: R2StorageAdapter;

  beforeEach(() => {
    adapter = new R2StorageAdapter(env.FILES);
  });

  it('round-trips bytes via put/get', async () => {
    const key = `contract/${crypto.randomUUID()}.txt`;
    const data = new TextEncoder().encode('burrow storage contract content');
    await adapter.put(key, data, 'text/plain');

    const obj = await adapter.get(key);
    expect(obj).not.toBeNull();
    if (!obj) throw new Error('expected stored object');

    const received = await bodyToBytes(obj.body);
    expect(new TextDecoder().decode(received)).toBe('burrow storage contract content');
    expect(obj.contentLength).toBe(data.byteLength);
    expect(obj.contentType).toBe('text/plain');
    expect(obj.lastModified).toBeInstanceOf(Date);
  });

  it('round-trips an ArrayBuffer payload', async () => {
    const key = `contract/${crypto.randomUUID()}.bin`;
    const buf = new ArrayBuffer(5);
    new Uint8Array(buf).set([10, 20, 30, 40, 50]);
    await adapter.put(key, buf, 'application/octet-stream');

    const obj = await adapter.get(key);
    expect(obj).not.toBeNull();
    if (!obj) throw new Error('expected stored object');

    const bytes = await bodyToBytes(obj.body);
    expect(Array.from(bytes)).toEqual([10, 20, 30, 40, 50]);
    expect(obj.contentType).toBe('application/octet-stream');
  });

  it('preserves contentType metadata', async () => {
    const key = `contract/images/${crypto.randomUUID()}.png`;
    const data = new Uint8Array([137, 80, 78, 71]);
    await adapter.put(key, data, 'image/png');

    const obj = await adapter.get(key);
    expect(obj).not.toBeNull();
    expect(obj?.contentType).toBe('image/png');
  });

  it('returns null for non-existent key', async () => {
    const key = `contract/missing-${crypto.randomUUID()}`;
    const obj = await adapter.get(key);
    expect(obj).toBeNull();
  });

  it('delete removes the key and is idempotent', async () => {
    const key = `contract/${crypto.randomUUID()}.txt`;
    await adapter.put(key, new TextEncoder().encode('temporary'));

    await adapter.delete(key);
    expect(await adapter.get(key)).toBeNull();

    // Repeated delete must succeed idempotently
    await adapter.delete(key);
    await adapter.delete(`contract/never-existed-${crypto.randomUUID()}`);
  });

  it('deletePrefix removes only the matching prefix subtree', async () => {
    const prefixA = `contract/scope-${crypto.randomUUID()}`;
    const prefixB = `contract/other-${crypto.randomUUID()}`;

    await adapter.put(`${prefixA}/doc1.txt`, new TextEncoder().encode('doc 1'));
    await adapter.put(`${prefixA}/nested/doc2.txt`, new TextEncoder().encode('doc 2'));
    await adapter.put(`${prefixB}/survivor.txt`, new TextEncoder().encode('survivor'));

    await adapter.deletePrefix(prefixA);

    expect(await adapter.get(`${prefixA}/doc1.txt`)).toBeNull();
    expect(await adapter.get(`${prefixA}/nested/doc2.txt`)).toBeNull();

    const survivor = await adapter.get(`${prefixB}/survivor.txt`);
    expect(survivor).not.toBeNull();
    if (!survivor) throw new Error('expected survivor');
    const survivorBytes = await bodyToBytes(survivor.body);
    expect(new TextDecoder().decode(survivorBytes)).toBe('survivor');
  });

  it('rejects path-traversal and invalid keys', async () => {
    const data = new TextEncoder().encode('evil');
    await expect(adapter.put('../evil.txt', data)).rejects.toThrow();
    await expect(adapter.put('contract/../../evil.txt', data)).rejects.toThrow();
    await expect(adapter.put('/absolute/path.txt', data)).rejects.toThrow();
    await expect(adapter.put('C:/windows/path.txt', data)).rejects.toThrow();
    await expect(adapter.put('null\0byte.txt', data)).rejects.toThrow();
    await expect(adapter.put('', data)).rejects.toThrow();

    await expect(adapter.get('../evil.txt')).rejects.toThrow();
    await expect(adapter.delete('../evil.txt')).rejects.toThrow();
  });

  it('rejects invalid storage prefixes', async () => {
    await expect(adapter.deletePrefix('')).rejects.toThrow();
    await expect(adapter.deletePrefix('   ')).rejects.toThrow();
    await expect(adapter.deletePrefix('..')).rejects.toThrow();
    await expect(adapter.deletePrefix('scope/../evil')).rejects.toThrow();
    await expect(adapter.deletePrefix('/root')).rejects.toThrow();
    await expect(adapter.deletePrefix('.')).rejects.toThrow();
    await expect(adapter.deletePrefix('./')).rejects.toThrow();
    await expect(adapter.deletePrefix('prefix\0bad')).rejects.toThrow();
  });
});
