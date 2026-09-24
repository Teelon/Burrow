import type { IInviteRepository, Invite, CreateInviteData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresInviteRepository implements IInviteRepository {
    private db;
    constructor(db: PostgresDb);
    listPending(workspaceId: string): Promise<Invite[]>;
    findByTokenHash(tokenHash: string): Promise<Invite | null>;
    create(data: CreateInviteData): Promise<Invite>;
    accept(id: string): Promise<void>;
    delete(id: string, workspaceId: string): Promise<void>;
}
