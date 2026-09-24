import type { IMemberRepository, Member, CreateMemberData } from '../../../../infrastructure/types';
import type { PostgresDb } from '../index';
export declare class PostgresMemberRepository implements IMemberRepository {
    private db;
    constructor(db: PostgresDb);
    listByWorkspace(workspaceId: string): Promise<Member[]>;
    findByUserId(workspaceId: string, userId: string): Promise<Member | null>;
    findByUserIdGlobal(userId: string): Promise<Member | null>;
    findByUserIds(workspaceId: string, userIds: string[]): Promise<{
        userId: string;
    }[]>;
    findByPattern(workspaceId: string, pattern: string, limit: number): Promise<{
        userId: string;
        name: string;
        email: string;
        image: string | null;
    }[]>;
    updateRole(workspaceId: string, userId: string, role: 'owner' | 'editor' | 'viewer'): Promise<void>;
    remove(workspaceId: string, userId: string): Promise<void>;
    create(data: CreateMemberData): Promise<Member>;
    deleteSessions(_userId: string): Promise<void>;
    listOwners(workspaceId: string): Promise<Member[]>;
}
