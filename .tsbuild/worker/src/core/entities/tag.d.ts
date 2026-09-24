/**
 * Tag entity and input types
 * Pure TypeScript — zero runtime dependencies
 */
export interface Tag {
    id: string;
    projectId: string;
    name: string;
    color: string | null;
    createdAt: Date;
}
export interface CreateTagInput {
    id: string;
    projectId: string;
    name: string;
    color?: string | null;
    createdAt: Date;
}
export interface UpdateTagInput {
    name?: string;
    color?: string | null;
}
