import { nanoid } from 'nanoid';
import type {
  ICardRepository,
  INotepadRepository,
  ITagRepository,
  IBoardRepository,
  CardPriority,
  MyTasksFilters,
  MyTaskItem,
  CardSummary,
  CardSubtask,
  CreateSubtaskData,
  UpdateSubtaskData,
  UpdateCardData,
  CardWithDetails,
  INotificationRepository,
} from '../infrastructure/types';
import { notFound, badRequest } from './errors';
import { positionAfterLast, positionBetween } from './utils/ordering';
import { extractPlainText } from '../shared/extract';

export interface CreateCardInput {
  workspaceId: string;
  actorId: string;
  boardId: string;
  columnId: string;
  title: string;
  priority?: CardPriority | null;
  dueDate?: number | null;
  assigneeIds?: string[];
  tagIds?: string[];
  notepad?: { mode: 'new' } | { mode: 'existing'; id: string };
}

export interface CreatedCard {
  cardId: string;
  notepadId: string;
  linkedNotepadId: string | null;
}

export interface CardPlan {
  workspaceId: string;
  projectId: string;
  boardId: string;
  columnId: string;
  actorId: string;
  cardId: string;
  notepadId: string;
  title: string;
  content: string;
  plainText: string;
  priority: CardPriority | null;
  dueDate: number | null;
  assigneeIds: string[];
  tagIds: string[];
  cardPosition: string;
  linkedNotepad: { id: string; position: string; title: string } | null;
  now: number;
}

export class CardService {
  constructor(
    private readonly repos: {
      cards: ICardRepository;
      notepads: INotepadRepository;
      tags: ITagRepository;
      boards: IBoardRepository;
      notifications: INotificationRepository;
      boardColumns?: { findById: (id: string) => Promise<any> };
    },
  ) {}

  async createCard(input: CreateCardInput): Promise<CreatedCard> {
    const board = await this.repos.boards.findById(input.boardId);
    if (!board || board.workspaceId !== input.workspaceId || board.deletedAt !== null) {
      throw notFound('not_found', 'Board not found');
    }
    const column = await this.repos.boards.findColumnById(input.columnId);
    if (!column || column.boardId !== board.id) {
      throw notFound('not_found', 'Column not found');
    }

    const assigneeIds = [...new Set(input.assigneeIds ?? [])];
    if (assigneeIds.length > 0) {
      const members = await this.validateAssignees(input.workspaceId, assigneeIds);
      if (members.length !== assigneeIds.length) {
        throw badRequest('invalid_assignees', 'Assignees must be workspace members');
      }
    }

    const tagIds = [...new Set(input.tagIds ?? [])];
    if (tagIds.length > 0) {
      const tags = await this.validateTags(board.projectId, tagIds);
      if (tags.length !== tagIds.length) {
        throw badRequest('invalid_tags', 'Tags must belong to this project');
      }
    }

    let linkedNotepad: CardPlan['linkedNotepad'] = null;
    let content = '[]';
    if (input.notepad?.mode === 'existing') {
      const linked = await this.repos.notepads.findById(input.notepad.id);
      if (
        !linked ||
        linked.projectId !== board.projectId ||
        linked.workspaceId !== input.workspaceId ||
        linked.kind !== 'notepad' ||
        linked.deletedAt !== null
      ) {
        throw notFound('not_found', 'Notepad not found');
      }
      linkedNotepad = { id: linked.id, position: linked.position, title: linked.title };
      content = linkBlockBody(linked.id);
    } else if (input.notepad?.mode === 'new') {
      linkedNotepad = {
        id: nanoid(),
        position: await this.repos.notepads.getLastRootNotepadPosition(board.projectId),
        title: input.title.trim() || 'Untitled',
      };
      content = linkBlockBody(linkedNotepad.id);
    }

    const title = input.title.trim() || 'Untitled';
    const plan: CardPlan = {
      workspaceId: input.workspaceId,
      projectId: board.projectId,
      boardId: board.id,
      columnId: column.id,
      actorId: input.actorId,
      cardId: nanoid(),
      notepadId: nanoid(),
      title,
      content,
      plainText: extractPlainText(content),
      priority: input.priority ?? null,
      dueDate: input.dueDate ?? null,
      assigneeIds,
      tagIds,
      cardPosition: await this.lastCardPosition(column.id),
      linkedNotepad,
      now: Date.now(),
    };

    // Execute creation statements atomically (repository should handle batching)
    await this.executeCardCreation(plan);

    return {
      cardId: plan.cardId,
      notepadId: plan.notepadId,
      linkedNotepadId: linkedNotepad?.id ?? null,
    };
  }

  /** The exact statements createCard runs. Exported for the atomicity spike. */
  async executeCardCreation(plan: CardPlan): Promise<void> {
    // This should be a single atomic batch in the repository
    // For now, we call individual methods - the repository impl should batch them

    if (plan.linkedNotepad) {
      await this.repos.notepads.create({
        id: plan.linkedNotepad.id,
        workspaceId: plan.workspaceId,
        projectId: plan.projectId,
        parentId: null,
        kind: 'notepad',
        title: plan.linkedNotepad.title,
        content: '[]',
        version: 1,
        position: plan.linkedNotepad.position,
        isFavorite: false,
        createdBy: plan.actorId,
        createdAt: plan.now,
        updatedAt: plan.now,
      });
      await this.repos.notepads.insertFts(plan.linkedNotepad.id, plan.linkedNotepad.title, '');
    }

    await this.repos.notepads.create({
      id: plan.notepadId,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
      parentId: null, // I2: card notepads are never in the tree
      kind: 'card',
      title: plan.title,
      content: plan.content,
      version: 1,
      position: 'a0',
      isFavorite: false,
      createdBy: plan.actorId,
      createdAt: plan.now,
      updatedAt: plan.now,
    });
    await this.repos.notepads.insertFts(plan.notepadId, plan.title, plan.plainText);

    await this.repos.cards.create({
      id: plan.cardId,
      boardId: plan.boardId,
      columnId: plan.columnId,
      notepadId: plan.notepadId,
      position: plan.cardPosition,
      priority: plan.priority,
      dueDate: plan.dueDate,
      createdAt: plan.now,
    });

    if (plan.assigneeIds.length > 0) {
      await this.repos.cards.setAssignees(plan.cardId, plan.assigneeIds);
    }

    if (plan.tagIds.length > 0) {
      await this.repos.cards.setTagIds(plan.notepadId, plan.tagIds);
    }

    if (plan.assigneeIds.length > 0 && plan.actorId) {
      const newlyAdded = plan.assigneeIds.filter((id) => id !== plan.actorId);
      if (newlyAdded.length > 0) {
        await this.repos.notifications.createAssignments({
          workspaceId: plan.workspaceId,
          notepadId: plan.notepadId,
          cardId: plan.cardId,
          actorId: plan.actorId,
          userIds: newlyAdded,
          now: plan.now,
        });
      }
    }
  }

  async getCard(workspaceId: string, cardId: string): Promise<CardWithDetails> {
    const card = await this.repos.cards.getCardWithDetails(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Card not found');
    return card;
  }

  async moveCard(
    workspaceId: string,
    cardId: string,
    columnId: string,
    afterId?: string | null,
  ): Promise<{ columnId: string; position: string }> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Card not found');

    const column = await this.repos.boards.findColumnById(columnId);
    if (!column || column.boardId !== card.boardId) {
      throw notFound('not_found', 'Destination column not found on this board');
    }

    // Get cards in destination column for positioning
    // This requires a repository method to list cards by column
    const columnCards = await this.repos.cards.listByColumn(columnId);
    const others = columnCards.filter((c) => c.id !== cardId);

    let newPosition: string;
    if (!afterId) {
      const next = others[0]?.position ?? null;
      newPosition = positionBetween(null, next);
    } else {
      const afterIndex = others.findIndex((c) => c.id === afterId);
      if (afterIndex === -1) throw badRequest('invalid_after_id', 'afterId not found in column');
      const prev = others[afterIndex]!.position;
      const next = others[afterIndex + 1]?.position ?? null;
      newPosition = positionBetween(prev, next);
    }

    await this.repos.cards.move(cardId, columnId, newPosition);
    return { columnId, position: newPosition };
  }

  async updateCard(
    workspaceId: string,
    cardId: string,
    updates: {
      title?: string;
      priority?: CardPriority | null;
      dueDate?: number | null;
      assigneeIds?: string[];
      tagIds?: string[];
    },
    actorId?: string,
  ): Promise<{ ok: true; cardId: string }> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Card not found');

    const now = Date.now();

    // Assignees validation & update
    if (updates.assigneeIds !== undefined) {
      const cleanAssignees = [...new Set(updates.assigneeIds)];
      if (cleanAssignees.length > 0) {
        const members = await this.validateAssignees(workspaceId, cleanAssignees);
        if (members.length !== cleanAssignees.length) {
          throw badRequest('invalid_assignees', 'Assignees must be workspace members');
        }
      }

      // Detect newly added assignees for notifications (excluding actor)
      const existingAssignees = await this.repos.cards.listAssignees(cardId);
      const existingSet = new Set(existingAssignees.map((a) => a.userId));
      const newlyAdded = cleanAssignees.filter((uid) => !existingSet.has(uid) && uid !== actorId);

      await this.repos.cards.setAssignees(cardId, cleanAssignees);

      if (actorId && newlyAdded.length > 0) {
        await this.repos.notifications.createAssignments({
          workspaceId,
          notepadId: card.notepadId,
          cardId: card.id,
          actorId,
          userIds: newlyAdded,
          now,
        });
      }
    }

    // Tags validation & update
    if (updates.tagIds !== undefined) {
      const cleanTags = [...new Set(updates.tagIds)];
      if (cleanTags.length > 0) {
        const tags = await this.validateTags(card.projectId, cleanTags);
        if (tags.length !== cleanTags.length) {
          throw badRequest('invalid_tags', 'Tags must belong to this project');
        }
      }
      await this.repos.cards.setTagIds(card.notepadId, cleanTags);
    }

    // Priority and Due Date
    const cardUpdates: UpdateCardData = {};
    if (updates.priority !== undefined) cardUpdates.priority = updates.priority ?? null;
    if (updates.dueDate !== undefined) cardUpdates.dueDate = updates.dueDate ?? null;

    if (Object.keys(cardUpdates).length > 0) {
      await this.repos.cards.update(cardId, cardUpdates);
    }

    // Title update on notepad & FTS
    if (updates.title !== undefined) {
      const newTitle = updates.title.trim() || 'Untitled';
      const notepad = await this.repos.notepads.findById(card.notepadId);
      if (notepad) {
        await this.repos.notepads.update(card.notepadId, { title: newTitle, updatedAt: now });
        await this.repos.notepads.deleteFts(card.notepadId);
        await this.repos.notepads.insertFts(
          card.notepadId,
          newTitle,
          extractPlainText(notepad.content),
        );
      }
    }

    return { ok: true, cardId };
  }

  async deleteCard(workspaceId: string, cardId: string): Promise<{ ok: true; cardId: string }> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Card not found');

    const now = Date.now();
    // Invariant I5: Card and its notepad always have the same soft-delete state
    await this.repos.notepads.softDelete(card.notepadId, now);
    await this.repos.notepads.deleteFts(card.notepadId);

    return { ok: true, cardId };
  }

  async restoreCard(workspaceId: string, cardId: string): Promise<{ ok: true; cardId: string }> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Deleted card not found');

    const notepad = await this.repos.notepads.findById(card.notepadId);
    if (!notepad || notepad.deletedAt === null) {
      throw notFound('not_found', 'Deleted card not found');
    }

    const plainText = extractPlainText(notepad.content);

    await this.repos.notepads.restore(card.notepadId, notepad.deletedAt);
    await this.repos.notepads.insertFts(card.notepadId, notepad.title, plainText);

    return { ok: true, cardId };
  }

  async permanentDeleteCard(
    workspaceId: string,
    cardId: string,
  ): Promise<{ ok: true; cardId: string }> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Deleted card not found in trash');

    const notepad = await this.repos.notepads.findById(card.notepadId);
    if (!notepad || notepad.deletedAt === null) {
      throw notFound('not_found', 'Deleted card not found in trash');
    }

    await this.repos.notepads.hardDelete(card.notepadId);

    return { ok: true, cardId };
  }

  async getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]> {
    if (cardIds.length === 0) return [];
    const cappedIds = cardIds.slice(0, 50);
    return this.repos.cards.getCardsSummary(workspaceId, cappedIds);
  }

  async getMyTasks(
    workspaceId: string,
    userId: string,
    filters: MyTasksFilters,
  ): Promise<MyTaskItem[]> {
    return this.repos.cards.getMyTasks(workspaceId, userId, filters);
  }

  // ---------------------------------------------------------------------------
  // Subtasks
  // ---------------------------------------------------------------------------
  async listSubtasks(cardId: string): Promise<CardSubtask[]> {
    return this.repos.cards.listSubtasks(cardId);
  }

  async createSubtask(workspaceId: string, cardId: string, title: string): Promise<CardSubtask> {
    await this.requireCardForWorkspace(workspaceId, cardId);

    const [last] = await this.repos.cards
      .listSubtasks(cardId)
      .then((s) => [s[s.length - 1]])
      .catch(() => [null as any]);
    const row: CreateSubtaskData = {
      id: nanoid(),
      cardId,
      title: title.trim() || 'Untitled',
      completed: false,
      position: positionAfterLast(last?.position ?? null),
      createdAt: Date.now(),
    };
    await this.repos.cards.createSubtask(row);
    return row;
  }

  async updateSubtask(
    workspaceId: string,
    cardId: string,
    subtaskId: string,
    updates: { title?: string; completed?: boolean; afterId?: string | null },
  ): Promise<{ ok: true; subtaskId: string }> {
    await this.requireCardForWorkspace(workspaceId, cardId);

    const subtasks = await this.repos.cards.listSubtasks(cardId);
    const subtask = subtasks.find((s) => s.id === subtaskId);
    if (!subtask) throw notFound('not_found', 'Subtask not found');

    const patch: UpdateSubtaskData = {};
    if (updates.title !== undefined) patch.title = updates.title.trim() || 'Untitled';
    if (updates.completed !== undefined) patch.completed = updates.completed;

    if (updates.afterId !== undefined) {
      const others = subtasks.filter((s) => s.id !== subtaskId);
      let newPosition: string;
      if (!updates.afterId) {
        newPosition = positionBetween(null, others[0]?.position ?? null);
      } else {
        const idx = others.findIndex((s) => s.id === updates.afterId);
        if (idx === -1) throw badRequest('invalid_after_id', 'afterId not found in subtask list');
        newPosition = positionBetween(others[idx]!.position, others[idx + 1]?.position ?? null);
      }
      patch.position = newPosition;
    }

    if (Object.keys(patch).length > 0) {
      await this.repos.cards.updateSubtask(subtaskId, patch);
    }
    return { ok: true, subtaskId };
  }

  async deleteSubtask(
    workspaceId: string,
    cardId: string,
    subtaskId: string,
  ): Promise<{ ok: true; subtaskId: string }> {
    await this.requireCardForWorkspace(workspaceId, cardId);
    const subtasks = await this.repos.cards.listSubtasks(cardId);
    if (!subtasks.find((s) => s.id === subtaskId)) throw notFound('not_found', 'Subtask not found');

    await this.repos.cards.deleteSubtask(subtaskId);
    return { ok: true, subtaskId };
  }

  private async requireCardForWorkspace(workspaceId: string, cardId: string): Promise<void> {
    const card = await this.repos.cards.findByIdAndWorkspace(cardId, workspaceId);
    if (!card) throw notFound('not_found', 'Card not found');
  }

  private async validateAssignees(
    workspaceId: string,
    userIds: string[],
  ): Promise<{ userId: string }[]> {
    // This would use the member repository to validate
    // For now, we'll assume the repository has this method
    return this.repos.cards.validateAssignees(workspaceId, userIds);
  }

  private async validateTags(projectId: string, tagIds: string[]): Promise<{ id: string }[]> {
    return this.repos.tags.validateByProject(projectId, tagIds);
  }

  private async lastCardPosition(columnId: string): Promise<string> {
    const cards = await this.repos.cards.listByColumn(columnId);
    return positionAfterLast(cards[cards.length - 1]?.position ?? null);
  }
}

function linkBlockBody(notepadId: string): string {
  return JSON.stringify([
    { id: nanoid(), type: 'notepadLink', props: { notepadId }, content: [], children: [] },
  ]);
}
