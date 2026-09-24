import type { R2Bucket } from '@cloudflare/workers-types'
import { LocalStorageAdapter } from './local'
import { R2StorageAdapter } from './r2'
import { S3StorageAdapter } from './s3'
import type { IStorageAdapter } from './types'

export function createStorageFromEnv(
  env: { FILES?: R2Bucket | null } & { LOCAL_STORAGE_PATH?: string },
): IStorageAdapter {
  if (env.FILES) {
    return new R2StorageAdapter(env.FILES)
  }
  const e = env as Record<string, unknown>
  if (e.S3_ENDPOINT && e.S3_BUCKET) {
    return new S3StorageAdapter({
      endpoint: e.S3_ENDPOINT as string,
      region: (e.S3_REGION as string) || process.env.S3_REGION || 'us-east-1',
      bucket: e.S3_BUCKET as string,
      accessKey: ((e.S3_ACCESS_KEY as string) ?? process.env.S3_ACCESS_KEY ?? '') as string,
      secretKey: ((e.S3_SECRET_KEY as string) ?? process.env.S3_SECRET_KEY ?? '') as string,
      forcePathStyle:
        (e.S3_FORCE_PATH_STYLE as string) === 'true' ||
        process.env.S3_FORCE_PATH_STYLE === 'true',
    })
  }
  const root =
    env.LOCAL_STORAGE_PATH ?? process.env.LOCAL_STORAGE_PATH ?? './data/uploads'
  return new LocalStorageAdapter(root)
}
