import type { ITagRepository, Tag } from '../infrastructure/types';
export declare class TagService {
    private readonly repos;
    constructor(repos: {
        tags: ITagRepository;
    });
    listTags(projectId: string): Promise<Tag[]>;
    createTag(_workspaceId: string, projectId: string, name: string, color?: string | null): Promise<Tag>;
    updateTag(_workspaceId: string, tagId: string, updates: {
        name?: string;
        color?: string | null;
    }): Promise<Tag>;
    deleteTag(_workspaceId: string, tagId: string): Promise<void>;
}
