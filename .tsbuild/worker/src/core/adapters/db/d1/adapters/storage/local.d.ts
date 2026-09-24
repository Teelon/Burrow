import type { IStorageAdapter, StorageObject } from './types';
export declare class LocalStorageAdapter implements IStorageAdapter {
    private root;
    constructor(root: string);
    private resolveKey;
    put(key: string, data: ArrayBuffer | Uint8Array, _contentType?: string): Promise<void>;
    get(key: string): Promise<StorageObject | null>;
    delete(key: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
    private walk;
    private pruneEmptyDirs;
}
