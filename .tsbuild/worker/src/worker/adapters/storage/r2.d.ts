import type { R2Bucket } from '@cloudflare/workers-types';
import type { IStorageAdapter, StorageObject } from './types';
export declare class R2StorageAdapter implements IStorageAdapter {
    private bucket;
    constructor(bucket: R2Bucket);
    put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void>;
    get(key: string): Promise<StorageObject | null>;
    delete(key: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
}
