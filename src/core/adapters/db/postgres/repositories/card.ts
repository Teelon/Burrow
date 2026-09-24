import type {
  ICardRepository,
  Card,
  CreateCardData,
  UpdateCardData,
  CardSubtask,
  CreateSubtaskData,
  UpdateSubtaskData,
  CardAssignee,
  Comment,
  CreateCommentData,
  MyTasksFilters,
  MyTaskItem,
  CardSummary,
  CardPriority,
  CardWithDetails,
} from '../../../../infrastructure/types';
import { eq, and, inArray, asc, sql } from 'drizzle-orm';
import type { PostgresDb } from '../index';
import {
  cards,
  cardSubtasks,
  cardAssignees,
  cardComments,
  boardColumns,
  boards,
  notepads,
  projects,
  members,
  tags,
  notepadTags,
  user,
  editLocks,
} from '../schema';

export class PostgresCardRepository implements ICardRepository {
  constructor(private db: PostgresDb) {}

  async findById(id: string): Promise<Card | null> {
    const result = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        notepadId: cards.notepadId,
        position: cards.position,
        priority: cards.priority,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
        projectId: projects.id,
      })
      .from(cards)
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(eq(cards.id, id))
      .limit(1);
    return result[0] ?? null;
  }

  async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Card | null> {
    const result = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        notepadId: cards.notepadId,
        position: cards.position,
        priority: cards.priority,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
        projectId: projects.id,
        workspaceId: projects.workspaceId,
        title: notepads.title,
        content: notepads.content,
        version: notepads.version,
      })
      .from(cards)
      .innerJoin(notepads, eq(cards.notepadId, notepads.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(and(eq(cards.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);
    return result[0] ?? null;
  }

  async getCardWithDetails(id: string, workspaceId: string): Promise<CardWithDetails | null> {
    const [card] = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        notepadId: cards.notepadId,
        position: cards.position,
        priority: cards.priority,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
        projectId: projects.id,
        workspaceId: projects.workspaceId,
        title: notepads.title,
        content: notepads.content,
        version: notepads.version,
      })
      .from(cards)
      .innerJoin(notepads, eq(cards.notepadId, notepads.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(and(eq(cards.id, id), eq(projects.workspaceId, workspaceId)))
      .limit(1);

    if (!card) return null;

    const [board] = await this.db
      .select({ name: boards.name })
      .from(boards)
      .where(eq(boards.id, card.boardId))
      .limit(1);

    const [column] = await this.db
      .select({ name: boardColumns.name })
      .from(boardColumns)
      .where(eq(boardColumns.id, card.columnId))
      .limit(1);

    const assignees = await this.db
      .select({
        userId: cardAssignees.userId,
        name: user.name,
        image: user.image,
      })
      .from(cardAssignees)
      .innerJoin(user, eq(user.id, cardAssignees.userId))
      .where(eq(cardAssignees.cardId, id));

    const cardTags = await this.db
      .select({
        id: tags.id,
        name: tags.name,
        color: tags.color,
      })
      .from(notepadTags)
      .innerJoin(tags, eq(tags.id, notepadTags.tagId))
      .where(eq(notepadTags.notepadId, card.notepadId));

    const subtasks = await this.db
      .select()
      .from(cardSubtasks)
      .where(eq(cardSubtasks.cardId, id))
      .orderBy(asc(cardSubtasks.position));

    const now = Date.now();
    const [lockRow] = await this.db
      .select()
      .from(editLocks)
      .where(eq(editLocks.notepadId, card.notepadId))
      .limit(1);

    let lock: { userId: string; clientId: string; name: string; expiresAt: number } | null = null;
    if (lockRow && lockRow.expiresAt > now) {
      const [holder] = await this.db
        .select({ name: user.name })
        .from(user)
        .where(eq(user.id, lockRow.userId))
        .limit(1);
      lock = {
        userId: lockRow.userId,
        clientId: lockRow.clientId,
        name: holder?.name || 'Someone',
        expiresAt: lockRow.expiresAt,
      };
    }

    return {
      ...card,
      dueDate: card.dueDate ?? null,
      boardName: board?.name ?? 'Board',
      columnName: column?.name ?? 'Column',
      assignees,
      tags: cardTags,
      subtasks: subtasks.map((s) => ({
        id: s.id,
        cardId: s.cardId,
        title: s.title,
        completed: s.completed,
        position: s.position,
        createdAt: s.createdAt,
      })),
      lock,
    };
  }

  async create(data: CreateCardData): Promise<Card> {
    const result = await this.db.insert(cards).values(data).returning();
    const created = result[0];
    if (!created) throw new Error('Failed to create card');
    // Need to get projectId
    const cardWithProject = await this.findById(created.id);
    if (!cardWithProject) throw new Error('Failed to retrieve created card');
    return cardWithProject;
  }

  async update(id: string, data: UpdateCardData): Promise<void> {
    await this.db.update(cards).set(data).where(eq(cards.id, id));
  }

  async move(id: string, columnId: string, position: string): Promise<void> {
    await this.db.update(cards).set({ columnId, position }).where(eq(cards.id, id));
  }

  async softDelete(id: string, _deletedAt: number): Promise<void> {
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  async restore(_id: string): Promise<void> {
    // Cards don't have soft delete
  }

  async hardDelete(id: string): Promise<void> {
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  // Subtasks
  async listSubtasks(cardId: string): Promise<CardSubtask[]> {
    return this.db
      .select()
      .from(cardSubtasks)
      .where(eq(cardSubtasks.cardId, cardId))
      .orderBy(cardSubtasks.position);
  }

  async createSubtask(data: CreateSubtaskData): Promise<CardSubtask> {
    const result = await this.db.insert(cardSubtasks).values(data).returning();
    if (!result[0]) throw new Error('Failed to create subtask');
    return result[0];
  }

  async updateSubtask(id: string, data: UpdateSubtaskData): Promise<void> {
    await this.db.update(cardSubtasks).set(data).where(eq(cardSubtasks.id, id));
  }

  async deleteSubtask(id: string): Promise<void> {
    await this.db.delete(cardSubtasks).where(eq(cardSubtasks.id, id));
  }

  // Assignees
  async listAssignees(cardId: string): Promise<CardAssignee[]> {
    return this.db
      .select({
        cardId: cardAssignees.cardId,
        userId: cardAssignees.userId,
        name: user.name,
        image: user.image,
      })
      .from(cardAssignees)
      .innerJoin(user, eq(cardAssignees.userId, user.id))
      .where(eq(cardAssignees.cardId, cardId));
  }

  async setAssignees(cardId: string, userIds: string[]): Promise<void> {
    await this.db.delete(cardAssignees).where(eq(cardAssignees.cardId, cardId));
    if (userIds.length > 0) {
      await this.db.insert(cardAssignees).values(userIds.map((userId) => ({ cardId, userId })));
    }
  }

  async validateAssignees(workspaceId: string, userIds: string[]): Promise<{ userId: string }[]> {
    const result = await this.db
      .select({ userId: members.userId })
      .from(members)
      .where(and(eq(members.workspaceId, workspaceId), inArray(members.userId, userIds)));
    return result;
  }

  // Tags (delegated to notepad tags since cards are notepads with kind='card')
  async listTagIds(notepadId: string): Promise<string[]> {
    const result = await this.db
      .select({ tagId: notepadTags.tagId })
      .from(notepadTags)
      .where(eq(notepadTags.notepadId, notepadId));
    return result.map((r) => r.tagId);
  }

  async setTagIds(notepadId: string, tagIds: string[]): Promise<void> {
    await this.db.delete(notepadTags).where(eq(notepadTags.notepadId, notepadId));
    if (tagIds.length > 0) {
      await this.db.insert(notepadTags).values(tagIds.map((tagId) => ({ notepadId, tagId })));
    }
  }

  // Comments
  async listComments(cardId: string): Promise<Comment[]> {
    return this.db
      .select({
        id: cardComments.id,
        cardId: cardComments.cardId,
        userId: cardComments.userId,
        content: cardComments.content,
        createdAt: cardComments.createdAt,
        updatedAt: cardComments.updatedAt,
        name: user.name,
        image: user.image,
      })
      .from(cardComments)
      .innerJoin(user, eq(cardComments.userId, user.id))
      .where(eq(cardComments.cardId, cardId))
      .orderBy(asc(cardComments.createdAt));
  }

  async createComment(data: CreateCommentData): Promise<Comment> {
    const result = await this.db.insert(cardComments).values(data).returning();
    const created = result[0];
    if (!created) throw new Error('Failed to create comment');
    const [comment] = await this.db
      .select({
        id: cardComments.id,
        cardId: cardComments.cardId,
        userId: cardComments.userId,
        content: cardComments.content,
        createdAt: cardComments.createdAt,
        updatedAt: cardComments.updatedAt,
        name: user.name,
        image: user.image,
      })
      .from(cardComments)
      .innerJoin(user, eq(cardComments.userId, user.id))
      .where(eq(cardComments.id, created.id))
      .limit(1);
    if (!comment) throw new Error('Failed to retrieve created comment');
    return comment;
  }

  async getComment(id: string, cardId: string): Promise<Comment | null> {
    const result = await this.db
      .select({
        id: cardComments.id,
        cardId: cardComments.cardId,
        userId: cardComments.userId,
        content: cardComments.content,
        createdAt: cardComments.createdAt,
        updatedAt: cardComments.updatedAt,
        name: user.name,
        image: user.image,
      })
      .from(cardComments)
      .innerJoin(user, eq(cardComments.userId, user.id))
      .where(and(eq(cardComments.id, id), eq(cardComments.cardId, cardId)))
      .limit(1);
    return result[0] ?? null;
  }

  async deleteComment(id: string): Promise<void> {
    await this.db.delete(cardComments).where(eq(cardComments.id, id));
  }

  // Queries
  async listByColumn(columnId: string): Promise<Card[]> {
    const result = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        columnId: cards.columnId,
        notepadId: cards.notepadId,
        position: cards.position,
        priority: cards.priority,
        dueDate: cards.dueDate,
        createdAt: cards.createdAt,
        projectId: projects.id,
      })
      .from(cards)
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .where(eq(cards.columnId, columnId))
      .orderBy(cards.position);
    return result;
  }

  async getMyTasks(
    workspaceId: string,
    userId: string,
    filters: MyTasksFilters,
  ): Promise<MyTaskItem[]> {
    const whereConditions = [
      eq(cardAssignees.userId, userId),
      eq(projects.workspaceId, workspaceId),
    ];
    if (filters.projectId) {
      whereConditions.push(eq(projects.id, filters.projectId));
    }

    const result = await this.db
      .select({
        id: cards.id,
        notepadId: cards.notepadId,
        boardId: cards.boardId,
        columnId: cards.columnId,
        projectId: projects.id,
        title: notepads.title,
        dueDate: cards.dueDate,
        priority: cards.priority,
        isCompleted: sql<boolean>`false`.as('is_completed'),
        createdAt: notepads.createdAt,
        boardName: boards.name,
        columnName: boardColumns.name,
        projectName: projects.name,
        projectIcon: projects.icon,
        projectColor: projects.color,
        tags: sql<{ id: string; name: string; color: string | null }[]>`jsonb_agg(
          jsonb_build_object('id', ${tags.id}, 'name', ${tags.name}, 'color', ${tags.color})
        )`.as('tags'),
      })
      .from(cards)
      .innerJoin(notepads, eq(cards.notepadId, notepads.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(boardColumns, eq(cards.columnId, boardColumns.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .innerJoin(cardAssignees, eq(cards.id, cardAssignees.cardId))
      .leftJoin(notepadTags, eq(notepads.id, notepadTags.notepadId))
      .leftJoin(tags, eq(notepadTags.tagId, tags.id))
      .where(and(...whereConditions))
      .groupBy(
        cards.id,
        cards.notepadId,
        cards.boardId,
        cards.columnId,
        projects.id,
        notepads.title,
        cards.dueDate,
        cards.priority,
        notepads.createdAt,
        boards.name,
        boardColumns.name,
        projects.name,
        projects.icon,
        projects.color,
      );

    return result.map((r) => ({
      ...r,
      tags: r.tags.filter((t: { id: string | null }) => t.id !== null),
    }));
  }

  async getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]> {
    if (cardIds.length === 0) return [];
    const result = await this.db
      .select({
        id: cards.id,
        notepadId: cards.notepadId,
        title: notepads.title,
        boardId: cards.boardId,
        boardName: boards.name,
        columnId: cards.columnId,
        columnName: boardColumns.name,
        priority: cards.priority,
        dueDate: cards.dueDate,
        assignees: sql<{ userId: string; name: string; image: string | null }[]>`jsonb_agg(
          jsonb_build_object('userId', ${cardAssignees.userId}, 'name', ${user.name}, 'image', ${user.image})
        )`.as('assignees'),
      })
      .from(cards)
      .innerJoin(notepads, eq(cards.notepadId, notepads.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(boardColumns, eq(cards.columnId, boardColumns.id))
      .innerJoin(projects, eq(boards.projectId, projects.id))
      .leftJoin(cardAssignees, eq(cards.id, cardAssignees.cardId))
      .leftJoin(user, eq(cardAssignees.userId, user.id))
      .where(and(inArray(cards.id, cardIds), eq(projects.workspaceId, workspaceId)))
      .groupBy(
        cards.id,
        cards.notepadId,
        notepads.title,
        cards.boardId,
        boards.name,
        cards.columnId,
        boardColumns.name,
        cards.priority,
        cards.dueDate,
      );

    return result.map((r) => ({
      ...r,
      assignees: r.assignees.filter((a: { userId: string | null }) => a.userId !== null),
    })) as CardSummary[];
  }

  // Search/suggest
  async findByPattern(
    projectId: string,
    pattern: string,
    limit: number,
  ): Promise<{ id: string; title: string; boardName: string; priority: CardPriority | null }[]> {
    return this.db
      .select({
        id: cards.id,
        title: notepads.title,
        boardName: boards.name,
        priority: cards.priority,
      })
      .from(cards)
      .innerJoin(notepads, eq(cards.notepadId, notepads.id))
      .innerJoin(boards, eq(cards.boardId, boards.id))
      .innerJoin(boardColumns, eq(cards.columnId, boardColumns.id))
      .where(and(eq(boards.projectId, projectId), sql`${notepads.title} ILIKE ${`%${pattern}%`}`))
      .limit(limit);
  }
}
