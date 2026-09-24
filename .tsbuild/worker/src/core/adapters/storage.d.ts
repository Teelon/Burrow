export interface StorageObject {
    body: ReadableStream | ArrayBuffer | Uint8Array;
    contentType?: string;
    contentLength?: number;
    etag?: string;
    lastModified?: Date;
}
export interface IStorageAdapter {
    put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void>;
    get(key: string): Promise<StorageObject | null>;
    delete(key: string): Promise<void>;
    deletePrefix(prefix: string): Promise<void>;
}
