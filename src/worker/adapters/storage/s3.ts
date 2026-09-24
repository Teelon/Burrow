import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { IStorageAdapter, StorageObject } from './types'

export interface S3StorageOptions {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  forcePathStyle?: boolean
}

export class S3StorageAdapter implements IStorageAdapter {
  private client: S3Client
  private bucket: string

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: {
        accessKeyId: options.accessKey,
        secretAccessKey: options.secretKey,
      },
      forcePathStyle: options.forcePathStyle ?? false,
    })
  }

  async put(key: string, data: ArrayBuffer | Uint8Array, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data instanceof Uint8Array ? data : new Uint8Array(data),
        ...(contentType ? { ContentType: contentType } : {}),
      }),
    )
  }

  async get(key: string): Promise<StorageObject | null> {
    let response
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
    } catch (err: unknown) {
      if (this.isNotFound(err)) return null
      throw err
    }
    if (!response.Body) return null
    const bytes = await (response.Body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray()
    return {
      body: bytes,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      etag: response.ETag?.replace(/^"|"$/g, ''),
      lastModified: response.LastModified,
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }

  async deletePrefix(prefix: string): Promise<void> {
    let continuationToken: string | undefined
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      )
      const keys = (listed.Contents ?? [])
        .map((o) => o.Key)
        .filter((k): k is string => typeof k === 'string')
      if (keys.length > 0) {
        for (let i = 0; i < keys.length; i += 1000) {
          const chunk = keys.slice(i, i + 1000)
          await this.client.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: chunk.map((Key) => ({ Key })) },
            }),
          )
        }
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (continuationToken)
  }

  private isNotFound(err: unknown): boolean {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } }
    return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404
  }
}
