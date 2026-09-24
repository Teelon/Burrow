import { nanoid } from 'nanoid'
import type { ICardRepository, INotepadRepository } from '../infrastructure/types'
import { notFound, badRequest, forbidden } from './errors'
import { chunkByParamBudget } from './utils/chunk'

/**
 * Comment bodies are plain text/markdown. Mentions use the markdown-link
 * shape produced by the composer: `@[Display Name](userId)`.
 */
const MENTION_RE = /@\[[^\]]*\]\(([A-Za-z0-9_-]+)\)/g

export function extractMentionedUserIds(content: string): string[] {
  const ids = new Set<string>()
  for (const match of content.matchAll(MENTION_RE)) {
    if (match[1]) ids.add(match[1])
  }
  return [...ids]
}

export interface CreateCommentResult {
  id: string
  cardId: string
  userId: string
  content: string
  createdAt: number
  updatedAt: number
  name: string
  image: string | null
  mentionedUserIds: string[]
}

export class CommentService {
  constructor(
    private readonly repos: {
      cards: ICardRepository
      notepads: INotepadRepository
      members: { findByUserIds: (workspaceId: string, userIds: string[]) => Promise<{ userId: string }[]> }
      notifications: { createMentions: (args: any) => Promise<void> }
    },
  ) {}

  async listComments(workspaceId: string, cardId: string) {
    await this.requireCardForWorkspace(workspaceId, cardId)

    return this.repos.cards.listComments(cardId)
  }

  async createComment(
    workspaceId: string,
    cardId: string,
    actorId: string,
    content: string,
  ): Promise<CreateCommentResult> {
    const card = await this.requireCardForWorkspace(workspaceId, cardId)
    const trimmed = content.trim()
    if (!trimmed) throw badRequest('invalid_content', 'Comment cannot be empty')

    const mentioned = extractMentionedUserIds(trimmed).filter((id) => id !== actorId)
    let mentionedUserIds: string[] = []
    if (mentioned.length > 0) {
      const valid = new Set<string>()
      for (const chunk of chunkByParamBudget(mentioned, 1, 1)) {
        const rows = await this.repos.members.findByUserIds(workspaceId, chunk)
        for (const r of rows) valid.add(r.userId)
      }
      // Mentions of non-members are dropped: no link rows, no notifications.
      mentionedUserIds = mentioned.filter((id) => valid.has(id))
    }

    const now = Date.now()
    const comment = await this.repos.cards.createComment({
      id: nanoid(),
      cardId,
      userId: actorId,
      content: trimmed,
      createdAt: now,
      updatedAt: now,
    })

    if (mentionedUserIds.length > 0) {
      // Dispatch mention notifications
      for (const chunk of chunkByParamBudget(mentionedUserIds, 9, 0)) {
        await this.repos.notifications.createMentions({
          workspaceId,
          notepadId: card.notepadId,
          cardId,
          actorId,
          userIds: chunk,
          now,
        })
      }
    }

    const author = await this.getUser(actorId)
    return {
      ...comment,
      name: author?.name || 'Someone',
      image: author?.image ?? null,
      mentionedUserIds,
    }
  }

  async deleteComment(
    workspaceId: string,
    cardId: string,
    commentId: string,
    actor: { userId: string; isOwner: boolean },
  ): Promise<{ ok: true; commentId: string }> {
    await this.requireCardForWorkspace(workspaceId, cardId)

    const comment = await this.repos.cards.getComment(commentId, cardId)
    if (!comment) throw notFound('not_found', 'Comment not found')
    if (comment.userId !== actor.userId && !actor.isOwner) {
      throw forbidden('forbidden', 'You can only delete your own comments')
    }

    await this.repos.cards.deleteComment(commentId)
    return { ok: true, commentId }
  }

  private async requireCardForWorkspace(workspaceId: string, cardId: string) {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId)
    if (!card) throw notFound('not_found', 'Card not found')
    return card
  }

  private async getUser(_userId: string): Promise<{ name: string; image: string | null } | null> {
    // This would need a user repository - for now return null
    return null
  }
}