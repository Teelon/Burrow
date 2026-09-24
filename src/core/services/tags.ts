import { nanoid } from 'nanoid';
import type { ITagRepository, Tag, CreateTagData } from '../infrastructure/types';
import { notFound } from './errors';

export class TagService {
  constructor(private readonly repos: { tags: ITagRepository }) {}

  async listTags(projectId: string): Promise<Tag[]> {
    return this.repos.tags.listByProject(projectId);
  }

  async createTag(
    _workspaceId: string,
    projectId: string,
    name: string,
    color?: string | null,
  ): Promise<Tag> {
    // Verify project belongs to workspace (caller should validate)
    // For now we assume it's valid

    // Check if tag already exists for this project
    const existing = await this.repos.tags.findByName(projectId, name);
    if (existing) {
      return existing;
    }

    const id = nanoid();
    const newTag: CreateTagData = {
      id,
      projectId,
      name: name.trim(),
      color: color ?? null,
    };

    await this.repos.tags.create(newTag);
    return newTag;
  }

  async updateTag(
    _workspaceId: string,
    tagId: string,
    updates: { name?: string; color?: string | null },
  ): Promise<Tag> {
    const tag = await this.repos.tags.findByIdAndWorkspace(tagId, _workspaceId);
    if (!tag) throw notFound('not_found', 'Tag not found');

    await this.repos.tags.update(tagId, {
      name: updates.name ? updates.name.trim() : undefined,
      color: updates.color !== undefined ? updates.color : undefined,
    });

    const updated = await this.repos.tags.findById(tagId);
    if (!updated) throw notFound('not_found', 'Tag not found after update');
    return updated;
  }

  async deleteTag(_workspaceId: string, tagId: string): Promise<void> {
    const tag = await this.repos.tags.findByIdAndWorkspace(tagId, _workspaceId);
    if (!tag) throw notFound('not_found', 'Tag not found');

    await this.repos.tags.delete(tagId);
  }
}
