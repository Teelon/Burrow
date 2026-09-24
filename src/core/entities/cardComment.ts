/**
 * CardComment entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export interface CardComment {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentInput {
  cardId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentResult {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  image: string | null;
  mentionedUserIds: string[];
}
