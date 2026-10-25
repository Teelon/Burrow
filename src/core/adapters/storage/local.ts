import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import type { IStorageAdapter, StorageObject } from './types';
import { validateStorageKey, validateStoragePrefix } from './validation';

function inferContentType(key: string): string | undefined {
  const dotIndex = key.lastIndexOf('.');
  if (dotIndex === -1) return undefined;
  const ext = key.slice(dotIndex + 1).toLowerCase();
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    bin: 'application/octet-stream',
  };
  return mimeMap[ext];
}

export class LocalStorageAdapter implements IStorageAdapter {
  private contentTypes = new Map<string, string>();

  constructor(private root: string) {}

  private resolveKey(key: string): { fullPath: string; normalized: string } {
    const normalized = validateStorageKey(key);
    const fullPath = resolve(this.root, normalized);
    const rel = relative(resolve(this.root), fullPath);
    if (!rel || rel.startsWith('..') || rel === '..' || rel.split(sep).includes('..')) {
      throw new Error(`Invalid storage key (traversal): ${key}`);
    }
    return { fullPath, normalized };
  }

  async put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void> {
    const { fullPath, normalized } = this.resolveKey(key);
    if (contentType) {
      this.contentTypes.set(normalized, contentType);
    } else {
      this.contentTypes.delete(normalized);
    }
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data instanceof Uint8Array ? data : new Uint8Array(data));
  }

  async get(key: string): Promise<StorageObject | null> {
    const { fullPath, normalized } = this.resolveKey(key);
    let st;
    try {
      st = await stat(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw err;
    }
    let data: Buffer;
    try {
      data = await readFile(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw err;
    }
    const contentType = this.contentTypes.get(normalized) ?? inferContentType(normalized);
    return {
      body: new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)),
      contentLength: st.size,
      contentType,
      lastModified: st.mtime,
    };
  }

  async delete(key: string): Promise<void> {
    const { fullPath, normalized } = this.resolveKey(key);
    this.contentTypes.delete(normalized);
    try {
      await unlink(fullPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw err;
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const normalized = validateStoragePrefix(prefix);
    const files = await this.walk(this.root);
    const rootResolved = resolve(this.root);
    const matched = files.filter((rel) => rel.split('\\').join('/').startsWith(normalized));
    for (const rel of matched) {
      try {
        await unlink(join(rootResolved, rel));
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue;
        throw err;
      }
    }
    for (const k of Array.from(this.contentTypes.keys())) {
      if (k.startsWith(normalized)) {
        this.contentTypes.delete(k);
      }
    }
    await this.pruneEmptyDirs(rootResolved);
  }

  private async walk(dir: string, base = ''): Promise<string[]> {
    let entries;
    try {
      entries = await readdir(join(dir, base), { withFileTypes: true });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw err;
    }
    const out: string[] = [];
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        out.push(...(await this.walk(dir, rel)));
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
    return out;
  }

  private async pruneEmptyDirs(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = join(dir, entry.name);
        await this.pruneEmptyDirs(sub);
      }
    }
    try {
      const remaining = await readdir(dir);
      if (remaining.length === 0 && resolve(dir) !== resolve(this.root)) {
        await rm(dir, { recursive: false });
      }
    } catch {
      // ignore races
    }
  }
}
