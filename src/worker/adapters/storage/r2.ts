import type { R2Bucket } from '@cloudflare/workers-types';
import type { IStorageAdapter, StorageObject } from './types';

export class R2StorageAdapter implements IStorageAdapter {
  constructor(private bucket: R2Bucket) {}

  async put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void> {
    await this.bucket.put(key, data, contentType ? { httpMetadata: { contentType } } : undefined);
  }

  async get(key: string): Promise<StorageObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType,
      contentLength: object.size,
      etag: object.etag,
      lastModified: object.uploaded,
    };
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }

  async deletePrefix(prefix: string): Promise<void> {
    let cursor: string | undefined;
    do {
      const listed = await this.bucket.list({ prefix, cursor });
      const keys = listed.objects.map((o) => o.key);
      if (keys.length > 0) {
        await this.bucket.delete(keys);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }
}
