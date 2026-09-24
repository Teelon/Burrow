export interface LockAcquireResult {
    acquired: boolean;
    holderUserId?: string;
    holderName?: string;
    expiresAt?: number;
}
export interface LockAcquireOptions {
    takeover?: boolean;
}
export interface ILockAdapter {
    acquire(resourceId: string, userId: string, clientId: string, ttlMs: number, options?: LockAcquireOptions): Promise<LockAcquireResult>;
    heartbeat(resourceId: string, clientId: string, ttlMs: number): Promise<boolean>;
    release(resourceId: string, clientId: string, options?: {
        userId: string;
    }): Promise<void>;
}
