import type { R2Bucket } from '@cloudflare/workers-types';
import type { IStorageAdapter } from './types';
export declare function createStorageFromEnv(env: {
    FILES?: R2Bucket | null;
} & {
    LOCAL_STORAGE_PATH?: string;
}): IStorageAdapter;
