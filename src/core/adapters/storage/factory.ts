import type { R2Bucket } from '@cloudflare/workers-types';
import { LocalStorageAdapter } from './local';
import { R2StorageAdapter } from './r2';
import { S3StorageAdapter } from './s3';
import type { IStorageAdapter, StorageObject } from './types';

export class UnconfiguredWorkerStorageAdapter implements IStorageAdapter {
  async put(_key: string, _data: ArrayBuffer | Uint8Array, _contentType?: string): Promise<void> {
    throw new Error('Storage not configured: FILES R2 binding is missing in Worker environment');
  }

  async get(_key: string): Promise<StorageObject | null> {
    throw new Error('Storage not configured: FILES R2 binding is missing in Worker environment');
  }

  async delete(_key: string): Promise<void> {
    throw new Error('Storage not configured: FILES R2 binding is missing in Worker environment');
  }

  async deletePrefix(_prefix: string): Promise<void> {
    throw new Error('Storage not configured: FILES R2 binding is missing in Worker environment');
  }
}

export interface StorageEnv {
  FILES?: R2Bucket | null;
  LOCAL_STORAGE_PATH?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY?: string;
  S3_SECRET_KEY?: string;
  S3_FORCE_PATH_STYLE?: string | boolean;
}

export function createStorageFromEnv(
  env: StorageEnv | ({ FILES?: R2Bucket | null } & { LOCAL_STORAGE_PATH?: string }),
): IStorageAdapter {
  if (env.FILES) {
    return new R2StorageAdapter(env.FILES);
  }
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const e = env as Record<string, unknown>;
  const s3Endpoint = (e.S3_ENDPOINT as string) || procEnv.S3_ENDPOINT;
  const s3Bucket = (e.S3_BUCKET as string) || procEnv.S3_BUCKET;
  if (s3Endpoint && s3Bucket) {
    return new S3StorageAdapter({
      endpoint: s3Endpoint,
      region: (e.S3_REGION as string) || procEnv.S3_REGION || 'us-east-1',
      bucket: s3Bucket,
      accessKey: ((e.S3_ACCESS_KEY as string) ?? procEnv.S3_ACCESS_KEY ?? '') as string,
      secretKey: ((e.S3_SECRET_KEY as string) ?? procEnv.S3_SECRET_KEY ?? '') as string,
      forcePathStyle:
        (e.S3_FORCE_PATH_STYLE as string) === 'true' || procEnv.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  const isNode = typeof process !== 'undefined' && Boolean(process.versions?.node);
  if (!isNode) {
    return new UnconfiguredWorkerStorageAdapter();
  }

  const root = (env.LOCAL_STORAGE_PATH as string) ?? procEnv.LOCAL_STORAGE_PATH ?? './data/uploads';
  return new LocalStorageAdapter(root);
}
