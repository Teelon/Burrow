import type { DB } from '../client';
import * as t from '../schema';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  IBoardRepository,
  Board,
  BoardColumn,
  BoardWithDetails,
  CreateBoardData,
  UpdateBoardData,
  CreateColumnData,
  UpdateColumnData,
} from '../../../../infrastructure/types';

export function createBoardRepository(db: DB): IBoardRepository {
  return {
    async listByProject(projectId: string): Promise<Board[]> {
      const rows = await db
        .select()
        .from(t.boards)
        .where(and(eq(t.boards.projectId, projectId), isNull(t.boards.deletedAt)))
        .orderBy(asc(t.boards.position));
      return rows.map(mapBoard);
    },

    async findById(id: string): Promise<Board | null> {
      const [row] = await db.select().from(t.boards).where(eq(t.boards.id, id));
      return row ? mapBoard(row) : null;
    },

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Board | null> {
      const [row] = await db
        .select()
        .from(t.boards)
        .where(
          and(
            eq(t.boards.id, id),
            eq(t.boards.workspaceId, workspaceId),
            isNull(t.boards.deletedAt),
          ),
        );
      return row ? mapBoard(row) : null;
    },

    async create(data: CreateBoardData): Promise<Board> {
      await db.insert(t.boards).values(data);
      return {
        id: data.id,
        workspaceId: data.workspaceId,
        projectId: data.projectId,
        name: data.name,
        icon: data.icon ?? null,
        position: data.position,
        deletedAt: null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    },

    async update(id: string, data: UpdateBoardData): Promise<void> {
      await db.update(t.boards).set(data).where(eq(t.boards.id, id));
    },

    async softDelete(id: string, deletedAt: number): Promise<void> {
      await db.update(t.boards).set({ deletedAt, updatedAt: deletedAt }).where(eq(t.boards.id, id));
    },

    async restore(id: string): Promise<void> {
      await db
        .update(t.boards)
        .set({ deletedAt: null, updatedAt: Date.now() })
        .where(eq(t.boards.id, id));
    },

    async hardDelete(id: string): Promise<void> {
      await db.delete(t.boards).where(eq(t.boards.id, id));
    },

    // Columns
    async listColumns(boardId: string): Promise<BoardColumn[]> {
      const rows = await db
        .select()
        .from(t.boardColumns)
        .where(eq(t.boardColumns.boardId, boardId))
        .orderBy(asc(t.boardColumns.position));
      return rows.map(mapColumn);
    },

    async findColumnById(id: string): Promise<BoardColumn | null> {
      const [row] = await db.select().from(t.boardColumns).where(eq(t.boardColumns.id, id));
      return row ? mapColumn(row) : null;
    },

    async findColumnByIdAndWorkspace(
      columnId: string,
      workspaceId: string,
    ): Promise<BoardColumn | null> {
      const [row] = await db
        .select({ column: t.boardColumns })
        .from(t.boardColumns)
        .innerJoin(t.boards, eq(t.boards.id, t.boardColumns.boardId))
        .where(
          and(
            eq(t.boardColumns.id, columnId),
            eq(t.boards.workspaceId, workspaceId),
            isNull(t.boards.deletedAt),
          ),
        );
      return row ? mapColumn(row.column) : null;
    },

    async createColumn(data: CreateColumnData): Promise<BoardColumn> {
      await db.insert(t.boardColumns).values(data);
      return {
        id: data.id,
        boardId: data.boardId,
        name: data.name,
        color: data.color ?? null,
        position: data.position,
        wipLimit: data.wipLimit ?? null,
      };
    },

    async updateColumn(id: string, data: UpdateColumnData): Promise<void> {
      await db.update(t.boardColumns).set(data).where(eq(t.boardColumns.id, id));
    },

    async moveColumn(id: string, position: string): Promise<void> {
      await db.update(t.boardColumns).set({ position }).where(eq(t.boardColumns.id, id));
    },

    async deleteColumn(id: string): Promise<void> {
      await db.delete(t.boardColumns).where(eq(t.boardColumns.id, id));
    },

    async getBoardWithDetails(
      boardId: string,
      workspaceId: string,
    ): Promise<BoardWithDetails | null> {
      const [board] = await db
        .select()
        .from(t.boards)
        .where(
          and(
            eq(t.boards.id, boardId),
            eq(t.boards.workspaceId, workspaceId),
            isNull(t.boards.deletedAt),
          ),
        );

      if (!board) return null;

      const columns = await db
        .select()
        .from(t.boardColumns)
        .where(eq(t.boardColumns.boardId, boardId))
        .orderBy(asc(t.boardColumns.position));

      const cardsWithNotepads = await db
        .select({
          id: t.cards.id,
          boardId: t.cards.boardId,
          columnId: t.cards.columnId,
          notepadId: t.cards.notepadId,
          title: t.notepads.title,
          position: t.cards.position,
          priority: t.cards.priority,
          dueDate: t.cards.dueDate,
          createdAt: t.cards.createdAt,
        })
        .from(t.cards)
        .innerJoin(t.notepads, eq(t.notepads.id, t.cards.notepadId))
        .where(and(eq(t.cards.boardId, boardId), isNull(t.notepads.deletedAt)))
        .orderBy(asc(t.cards.position));

      const cardIds = cardsWithNotepads.map((c) => c.id);
      const assignees =
        cardIds.length > 0
          ? await db
              .select({
                cardId: t.cardAssignees.cardId,
                userId: t.cardAssignees.userId,
                name: t.user.name,
                image: t.user.image,
              })
              .from(t.cardAssignees)
              .innerJoin(t.user, eq(t.user.id, t.cardAssignees.userId))
              .where(inArray(t.cardAssignees.cardId, cardIds))
          : [];

      const assigneesByCard = new Map<
        string,
        Array<{ userId: string; name: string; image: string | null }>
      >();
      for (const a of assignees) {
        const list = assigneesByCard.get(a.cardId) || [];
        list.push({ userId: a.userId, name: a.name, image: a.image });
        assigneesByCard.set(a.cardId, list);
      }

      const notepadIds = cardsWithNotepads.map((c) => c.notepadId);
      const tags =
        notepadIds.length > 0
          ? await db
              .select({
                notepadId: t.notepadTags.notepadId,
                tagId: t.tags.id,
                name: t.tags.name,
                color: t.tags.color,
              })
              .from(t.notepadTags)
              .innerJoin(t.tags, eq(t.tags.id, t.notepadTags.tagId))
              .where(inArray(t.notepadTags.notepadId, notepadIds))
          : [];

      const tagsByNotepad = new Map<
        string,
        Array<{ id: string; name: string; color: string | null }>
      >();
      for (const tag of tags) {
        const list = tagsByNotepad.get(tag.notepadId) || [];
        list.push({ id: tag.tagId, name: tag.name, color: tag.color });
        tagsByNotepad.set(tag.notepadId, list);
      }

      const subtaskCounts =
        cardIds.length > 0
          ? await db
              .select({
                cardId: t.cardSubtasks.cardId,
                total: sql<number>`count(*)`,
                completed: sql<number>`coalesce(sum(case when ${t.cardSubtasks.completed} then 1 else 0 end), 0)`,
              })
              .from(t.cardSubtasks)
              .where(inArray(t.cardSubtasks.cardId, cardIds))
              .groupBy(t.cardSubtasks.cardId)
          : [];

      const subtasksByCard = new Map<string, { total: number; completed: number }>();
      for (const row of subtaskCounts) {
        subtasksByCard.set(row.cardId, {
          total: Number(row.total),
          completed: Number(row.completed),
        });
      }

      const cardsByColumn = new Map<string, any[]>();
      for (const card of cardsWithNotepads) {
        const cardAssignees = assigneesByCard.get(card.id) || [];
        const cardTags = tagsByNotepad.get(card.notepadId) || [];
        const subtaskProgress = subtasksByCard.get(card.id) || { total: 0, completed: 0 };
        const list = cardsByColumn.get(card.columnId) || [];
        list.push({
          id: card.id,
          columnId: card.columnId,
          notepadId: card.notepadId,
          title: card.title,
          position: card.position,
          priority: card.priority as any,
          dueDate: card.dueDate,
          createdAt: card.createdAt,
          assignees: cardAssignees,
          tags: cardTags,
          totalSubtasks: subtaskProgress.total,
          completedSubtasks: subtaskProgress.completed,
        });
        cardsByColumn.set(card.columnId, list);
      }

      return {
        ...mapBoard(board),
        columns: columns.map((col) => ({
          ...mapColumn(col),
          cards: cardsByColumn.get(col.id) || [],
        })),
      };
    },

    // Trash
    async listDeletedByProject(projectId: string): Promise<Board[]> {
      const rows = await db
        .select()
        .from(t.boards)
        .where(and(eq(t.boards.projectId, projectId), sql`${t.boards.deletedAt} IS NOT NULL`))
        .orderBy(desc(t.boards.deletedAt));
      return rows.map(mapBoard);
    },
  };
}

function mapBoard(row: typeof t.boards.$inferSelect): Board {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    projectId: row.projectId,
    name: row.name,
    icon: row.icon,
    position: row.position,
    deletedAt: row.deletedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapColumn(row: typeof t.boardColumns.$inferSelect): BoardColumn {
  return {
    id: row.id,
    boardId: row.boardId,
    name: row.name,
    color: row.color,
    position: row.position,
    wipLimit: row.wipLimit ?? null,
  };
}
