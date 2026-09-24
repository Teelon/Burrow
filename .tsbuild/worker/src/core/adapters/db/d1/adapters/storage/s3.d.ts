import type { IStorageAdapter, StorageObject } from './types';
export interface S3StorageOptions {
    endpoint: string;
    region: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle?: boolean;
}
export declare class S3StorageAdapter implements IStorageAdapter {
    private client;
    private bucket;
    constructor(options: S3StorageOptions);
    put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void>;
    get(key: string): Promise<StorageObject | null>;
    delete(key: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
    private isNotFound;
}
