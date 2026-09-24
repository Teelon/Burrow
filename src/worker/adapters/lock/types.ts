export interface LockAcquireResult {
  acquired: boolean
  holderUserId?: string
  holderName?: string
  expiresAt?: number
}

export interface ILockAdapter {
  acquire(
    resourceId: string,
    userId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<LockAcquireResult>
  heartbeat(
    resourceId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<boolean>
  release(resourceId: string, clientId: string): Promise<void>
}
