import type { DB } from '../../db/client';
import type { ILockAdapter, LockAcquireResult } from './types';
export interface LockAcquireOptions {
    takeover?: boolean;
}
export interface LockReleaseOptions {
    userId?: string;
}
export declare class SqlLockAdapter implements ILockAdapter {
    private readonly db;
    private readonly resolveHolderName?;
    constructor(db: DB, resolveHolderName?: ((userId: string) => Promise<string | null>) | undefined);
    acquire(resourceId: string, userId: string, clientId: string, ttlMs: number, opts?: LockAcquireOptions): Promise<LockAcquireResult>;
    heartbeat(resourceId: string, clientId: string, ttlMs: number): Promise<boolean>;
    release(resourceId: string, clientId: string, opts?: LockReleaseOptions): Promise<void>;
}
