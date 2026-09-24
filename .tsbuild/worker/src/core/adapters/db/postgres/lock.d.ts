import type { ILockAdapter, LockAcquireResult, LockAcquireOptions } from '../../../adapters/lock';
import type { PostgresDb } from './index';
export declare class PostgresLockAdapter implements ILockAdapter {
    private db;
    constructor(db: PostgresDb);
    acquire(resourceId: string, userId: string, clientId: string, ttlMs: number, options?: LockAcquireOptions): Promise<LockAcquireResult>;
    heartbeat(resourceId: string, clientId: string, ttlMs: number): Promise<boolean>;
    release(resourceId: string, clientId: string, options?: {
        userId: string;
    }): Promise<void>;
    private getUserName;
}
