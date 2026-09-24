import { mkdir, readdir, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { IStorageAdapter, StorageObject } from './types'

export class LocalStorageAdapter implements IStorageAdapter {
  constructor(private root: string) {}

  private resolveKey(key: string): string {
    if (!key || key.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(key)) {
      throw new Error(`Invalid storage key: ${key}`)
    }
    const normalized = key.split('\\').join('/')
    // Reject parent segments even when they resolve inside root: keys are
    // opaque identifiers (`${workspaceId}/${nanoid()}.${ext}`), never paths.
    if (normalized.split('/').includes('..')) {
      throw new Error(`Invalid storage key (traversal): ${key}`)
    }
    const fullPath = resolve(this.root, normalized)
    const rel = relative(resolve(this.root), fullPath)
    if (!rel || rel.startsWith('..') || rel === '..' || rel.split(sep).includes('..')) {
      throw new Error(`Invalid storage key (traversal): ${key}`)
    }
    return fullPath
  }

  async put(key: string, data: ArrayBuffer | Uint8Array, _contentType?: string): Promise<void> {
    const fullPath = this.resolveKey(key)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, data instanceof Uint8Array ? data : new Uint8Array(data))
  }

  async get(key: string): Promise<StorageObject | null> {
    const fullPath = this.resolveKey(key)
    let data: Buffer
    try {
      data = await readFile(fullPath)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null
      throw err
    }
    const st = await stat(fullPath)
    return {
      body: new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
      contentLength: st.size,
      lastModified: st.mtime,
    }
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.resolveKey(key)
    try {
      await unlink(fullPath)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return
      throw err
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const normalized = prefix.split('\\').join('/')
    if (!normalized || normalized.startsWith('/') || normalized.includes('..')) {
      throw new Error(`Invalid storage prefix: ${prefix}`)
    }
    const files = await this.walk(this.root)
    const rootResolved = resolve(this.root)
    // R2 semantics: every key starting with prefix matches (covers both
    // directory prefixes and partial-name prefixes).
    const matched = files.filter((rel) => rel.split('\\').join('/').startsWith(normalized))
    for (const rel of matched) {
      try {
        await unlink(join(rootResolved, rel))
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') continue
        throw err
      }
    }
    await this.pruneEmptyDirs(rootResolved)
  }

  private async walk(dir: string, base = ''): Promise<string[]> {
    let entries
    try {
      entries = await readdir(join(dir, base), { withFileTypes: true })
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return []
      throw err
    }
    const out: string[] = []
    for (const entry of entries) {
      const rel = base ? `${base}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        out.push(...(await this.walk(dir, rel)))
      } else if (entry.isFile()) {
        out.push(rel)
      }
    }
    return out
  }

  private async pruneEmptyDirs(dir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sub = join(dir, entry.name)
        await this.pruneEmptyDirs(sub)
      }
    }
    try {
      const remaining = await readdir(dir)
      if (remaining.length === 0 && resolve(dir) !== resolve(this.root)) {
        await rm(dir, { recursive: false })
      }
    } catch {
      // ignore races
    }
  }
}
