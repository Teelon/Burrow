import type { IStorageAdapter } from '../adapters/storage';
import type { ISearchAdapter } from '../adapters/search';
import type { ILockAdapter } from '../adapters/lock';
/**
 * Minimal auth provider interface for the core app factory.
 * Implementations (e.g. BetterAuth) live in the platform layer.
 */
export interface AuthProvider {
    /** Resolve session from request headers. Returns userId, or null. */
    getSession(headers: Headers): Promise<{
        userId: string;
    } | null>;
    /** Hono handler for auth endpoints (sign-in, sign-up, etc.). */
    handler(req: Request): Promise<Response>;
}
/**
 * Repository container — all repository interfaces the services depend on.
 * The platform layer provides implementations (D1, Postgres, etc.).
 */
export interface RepositoryContainer {
    workspaces: IWorkspaceRepository;
    projects: IProjectRepository;
    boards: IBoardRepository;
    cards: ICardRepository;
    notepads: INotepadRepository;
    tags: ITagRepository;
    notifications: INotificationRepository;
    members: IMemberRepository;
    invites: IInviteRepository;
}
/**
 * Full infrastructure bundle passed to `createCoreApp`.
 * The platform entrypoint (Worker, Node, etc.) assembles this.
 */
export interface Infrastructure {
    repositories: RepositoryContainer;
    storage: IStorageAdapter;
    search: ISearchAdapter;
    locks: ILockAdapter;
    auth: AuthProvider;
    bootstrapToken: string;
}
export interface IWorkspaceRepository {
    findById(id: string): Promise<Workspace | null>;
    create(data: CreateWorkspaceData): Promise<Workspace>;
    count(): Promise<number>;
}
export interface IProjectRepository {
    listByWorkspace(workspaceId: string): Promise<Project[]>;
    findById(id: string): Promise<Project | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Project | null>;
    create(data: CreateProjectData): Promise<Project>;
    update(id: string, data: UpdateProjectData): Promise<void>;
    updatePosition(id: string, position: string): Promise<void>;
    delete(id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
}
export interface IBoardRepository {
    listByProject(projectId: string): Promise<Board[]>;
    findById(id: string): Promise<Board | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Board | null>;
    create(data: CreateBoardData): Promise<Board>;
    update(id: string, data: UpdateBoardData): Promise<void>;
    softDelete(id: string, deletedAt: number): Promise<void>;
    restore(id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
    listDeletedByProject(projectId: string): Promise<Board[]>;
    listColumns(boardId: string): Promise<BoardColumn[]>;
    findColumnById(id: string): Promise<BoardColumn | null>;
    findColumnByIdAndWorkspace(columnId: string, workspaceId: string): Promise<BoardColumn | null>;
    createColumn(data: CreateColumnData): Promise<BoardColumn>;
    updateColumn(id: string, data: UpdateColumnData): Promise<void>;
    moveColumn(id: string, position: string): Promise<void>;
    deleteColumn(id: string): Promise<void>;
    getBoardWithDetails(boardId: string, workspaceId: string): Promise<BoardWithDetails | null>;
}
export interface ICardRepository {
    findById(id: string): Promise<Card | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Card | null>;
    create(data: CreateCardData): Promise<Card>;
    update(id: string, data: UpdateCardData): Promise<void>;
    move(id: string, columnId: string, position: string): Promise<void>;
    softDelete(id: string, deletedAt: number): Promise<void>;
    restore(id: string): Promise<void>;
    hardDelete(id: string): Promise<void>;
    listSubtasks(cardId: string): Promise<CardSubtask[]>;
    createSubtask(data: CreateSubtaskData): Promise<CardSubtask>;
    updateSubtask(id: string, data: UpdateSubtaskData): Promise<void>;
    deleteSubtask(id: string): Promise<void>;
    listAssignees(cardId: string): Promise<CardAssignee[]>;
    setAssignees(cardId: string, userIds: string[]): Promise<void>;
    validateAssignees(workspaceId: string, userIds: string[]): Promise<{
        userId: string;
    }[]>;
    listTagIds(notepadId: string): Promise<string[]>;
    setTagIds(notepadId: string, tagIds: string[]): Promise<void>;
    listComments(cardId: string): Promise<Comment[]>;
    createComment(data: CreateCommentData): Promise<Comment>;
    getComment(id: string, cardId: string): Promise<Comment | null>;
    deleteComment(id: string): Promise<void>;
    listByColumn(columnId: string): Promise<Card[]>;
    getMyTasks(workspaceId: string, userId: string, filters: MyTasksFilters): Promise<MyTaskItem[]>;
    getCardsSummary(workspaceId: string, cardIds: string[]): Promise<CardSummary[]>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        title: string;
        boardName: string;
        priority: CardPriority | null;
    }[]>;
}
export interface INotepadRepository {
    listByProject(projectId: string): Promise<Notepad[]>;
    findById(id: string): Promise<Notepad | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Notepad | null>;
    create(data: CreateNotepadData): Promise<Notepad>;
    update(id: string, data: UpdateNotepadData): Promise<void>;
    move(id: string, parentId: string | null, position: string): Promise<void>;
    softDelete(id: string, deletedAt: number): Promise<void>;
    restore(id: string, deleteTimestamp: number): Promise<RestoredNotepad[]>;
    hardDelete(id: string): Promise<HardDeletedNotepad[]>;
    listDeletedByProject(projectId: string): Promise<Notepad[]>;
    getContent(id: string): Promise<NotepadContent | null>;
    saveContent(id: string, content: string, expectedVersion: number): Promise<number>;
    getChildren(parentIds: string[]): Promise<{
        id: string;
        parentId: string | null;
    }[]>;
    getParent(id: string): Promise<{
        id: string;
        parentId: string | null;
    } | null>;
    isValidLink(link: {
        targetType: string;
        targetId: string;
    }): Promise<boolean>;
    listTagIds(notepadId: string): Promise<string[]>;
    setTagIds(notepadId: string, tagIds: string[]): Promise<void>;
    getLock(notepadId: string): Promise<EditLock | null>;
    deleteFts(notepadId: string): Promise<void>;
    insertFts(notepadId: string, title: string, body: string): Promise<void>;
    insertFtsConditional(notepadId: string, title: string, body: string, version: number, content: string): Promise<void>;
    listLinks(sourceId: string): Promise<StoredLink[]>;
    replaceLinks(sourceId: string, added: StoredLink[], removed: StoredLink[], version: number, content: string): Promise<void>;
    insertMentions(args: MentionNotificationArgs): Promise<void>;
    getLastChildPosition(parentId: string): Promise<string | null>;
    getLastRootPosition(projectId: string): Promise<string | null>;
    getLastRootNotepadPosition(projectId: string): Promise<string>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        title: string;
        icon: string | null;
    }[]>;
}
export interface ITagRepository {
    listByProject(projectId: string): Promise<Tag[]>;
    findById(id: string): Promise<Tag | null>;
    findByIdAndWorkspace(id: string, workspaceId: string): Promise<Tag | null>;
    create(data: CreateTagData): Promise<Tag>;
    update(id: string, data: UpdateTagData): Promise<void>;
    delete(id: string): Promise<void>;
    findByName(projectId: string, name: string): Promise<Tag | null>;
    validateByProject(projectId: string, tagIds: string[]): Promise<{
        id: string;
    }[]>;
    findByPattern(projectId: string, pattern: string, limit: number): Promise<{
        id: string;
        name: string;
        color: string | null;
    }[]>;
}
export interface INotificationRepository {
    listByUser(userId: string, workspaceId: string, unreadOnly: boolean): Promise<Notification[]>;
    markRead(userId: string, notificationIds: string[]): Promise<void>;
    markAllRead(userId: string): Promise<void>;
    createMentions(args: {
        workspaceId: string;
        notepadId: string;
        cardId: string | null;
        actorId: string;
        userIds: string[];
        now: number;
    }): Promise<void>;
}
export interface IMemberRepository {
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
    deleteSessions(userId: string): Promise<void>;
    listOwners(workspaceId: string): Promise<Member[]>;
}
export interface IInviteRepository {
    listPending(workspaceId: string): Promise<Invite[]>;
    findByTokenHash(tokenHash: string): Promise<Invite | null>;
    create(data: CreateInviteData): Promise<Invite>;
    accept(id: string): Promise<void>;
    delete(id: string, workspaceId: string): Promise<void>;
}
export interface Workspace {
    id: string;
    name: string;
    createdBy: string;
    createdAt: number;
}
export interface CreateWorkspaceData {
    id: string;
    name: string;
    createdBy: string;
    createdAt: number;
}
export interface Project {
    id: string;
    workspaceId: string;
    name: string;
    icon: string | null;
    color: string | null;
    position: string;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
}
export interface CreateProjectData {
    id: string;
    workspaceId: string;
    name: string;
    icon: string | null;
    color: string | null;
    position: string;
    createdAt: number;
    updatedAt: number;
}
export interface UpdateProjectData {
    name?: string;
    icon?: string | null;
    color?: string | null;
    archivedAt?: number | null;
    updatedAt: number;
}
export interface Board {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number;
}
export interface CreateBoardData {
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    createdAt: number;
    updatedAt: number;
}
export interface UpdateBoardData {
    name?: string;
    icon?: string | null;
    updatedAt: number;
}
export interface BoardColumn {
    id: string;
    boardId: string;
    name: string;
    color: string | null;
    position: string;
    wipLimit: number | null;
}
export interface BoardWithDetails extends Board {
    columns: Array<BoardColumn & {
        cards: Array<{
            id: string;
            columnId: string;
            notepadId: string;
            title: string;
            position: string;
            priority: CardPriority | null;
            dueDate: number | null;
            createdAt: number;
            assignees: Array<{
                userId: string;
                name: string;
                image?: string | null;
            }>;
            tags: Array<{
                id: string;
                name: string;
                color?: string | null;
            }>;
            totalSubtasks: number;
            completedSubtasks: number;
        }>;
    }>;
}
export interface CreateColumnData {
    id: string;
    boardId: string;
    name: string;
    color: string | null;
    position: string;
    wipLimit: number | null;
}
export interface UpdateColumnData {
    name?: string;
    color?: string | null;
    wipLimit?: number | null;
}
export interface Card {
    id: string;
    boardId: string;
    columnId: string;
    notepadId: string;
    position: string;
    priority: CardPriority | null;
    dueDate: number | null;
    createdAt: number;
    projectId: string;
}
export interface CreateCardData {
    id: string;
    boardId: string;
    columnId: string;
    notepadId: string;
    position: string;
    priority: CardPriority | null;
    dueDate: number | null;
    createdAt: number;
}
export interface UpdateCardData {
    columnId?: string;
    position?: string;
    priority?: CardPriority | null;
    dueDate?: number | null;
}
export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';
export interface Notepad {
    id: string;
    workspaceId: string;
    projectId: string;
    parentId: string | null;
    kind: 'notepad' | 'card';
    title: string;
    icon: string | null;
    coverKey: string | null;
    content: string;
    version: number;
    position: string;
    isFavorite: boolean;
    deletedAt: number | null;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
}
export interface CreateNotepadData {
    id: string;
    workspaceId: string;
    projectId: string;
    parentId: string | null;
    kind: 'notepad' | 'card';
    title: string;
    content: string;
    version: number;
    position: string;
    isFavorite: boolean;
    createdBy: string;
    createdAt: number;
    updatedAt: number;
}
export interface UpdateNotepadData {
    title?: string;
    icon?: string | null;
    coverKey?: string | null;
    isFavorite?: boolean;
    updatedAt: number;
}
export interface NotepadContent {
    id: string;
    workspaceId: string;
    title: string;
    content: string;
    version: number;
}
export interface RestoredNotepad {
    id: string;
    parentId: string | null;
    title: string;
    content: string;
    projectId: string;
}
export interface HardDeletedNotepad {
    id: string;
    coverKey: string | null;
}
export interface Tag {
    id: string;
    projectId: string;
    name: string;
    color: string | null;
}
export interface CreateTagData {
    id: string;
    projectId: string;
    name: string;
    color: string | null;
}
export interface UpdateTagData {
    name?: string;
    color?: string | null;
}
export interface Notification {
    id: string;
    workspaceId: string;
    userId: string;
    type: 'mention' | 'assigned';
    actorId: string;
    actorName: string | null;
    notepadId: string | null;
    cardId: string | null;
    readAt: number | null;
    createdAt: number;
}
export interface Member {
    workspaceId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: number;
    name?: string;
    email?: string;
    image?: string | null;
}
export interface CreateMemberData {
    workspaceId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    joinedAt: number;
}
export interface Invite {
    id: string;
    workspaceId: string;
    email: string;
    role: 'editor' | 'viewer';
    tokenHash: string;
    invitedBy: string;
    expiresAt: number;
    acceptedAt: number | null;
    createdAt: number;
}
export interface CreateInviteData {
    id: string;
    workspaceId: string;
    email: string;
    role: 'editor' | 'viewer';
    tokenHash: string;
    invitedBy: string;
    expiresAt: number;
    createdAt: number;
}
export interface CardSubtask {
    id: string;
    cardId: string;
    title: string;
    completed: boolean;
    position: string;
    createdAt: number;
}
export interface CreateSubtaskData {
    id: string;
    cardId: string;
    title: string;
    completed: boolean;
    position: string;
    createdAt: number;
}
export interface UpdateSubtaskData {
    title?: string;
    completed?: boolean;
    position?: string;
}
export interface CardAssignee {
    cardId: string;
    userId: string;
    name: string;
    image: string | null;
}
export interface MyTasksFilters {
    status?: 'all' | 'open' | 'completed';
    projectId?: string;
}
export interface MyTaskItem {
    id: string;
    notepadId: string;
    boardId: string;
    columnId: string;
    projectId: string;
    title: string;
    dueDate: number | null;
    priority: CardPriority | null;
    isCompleted: boolean;
    createdAt: number;
    boardName: string;
    columnName: string;
    projectName: string;
    projectIcon: string | null;
    projectColor: string | null;
    tags: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
}
export interface CardSummary {
    id: string;
    notepadId: string;
    title: string;
    boardId: string;
    boardName: string;
    columnId: string;
    columnName: string;
    priority: CardPriority | null;
    dueDate: number | null;
    assignees: Array<{
        userId: string;
        name: string;
        image: string | null;
    }>;
}
export interface Comment {
    id: string;
    cardId: string;
    userId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    name: string;
    image: string | null;
}
export interface CreateCommentData {
    id: string;
    cardId: string;
    userId: string;
    content: string;
    createdAt: number;
    updatedAt: number;
}
export interface StoredLink {
    targetType: 'user' | 'notepad' | 'card' | 'board';
    targetId: string;
}
export interface EditLock {
    notepadId: string;
    userId: string;
    clientId: string;
    expiresAt: number;
}
export interface MentionNotificationArgs {
    workspaceId: string;
    notepadId: string;
    actorId: string;
    addedUserIds: string[];
    version: number;
    content: string;
    now: number;
}
export interface LinkTargetType {
    user: 'user';
    notepad: 'notepad';
    card: 'card';
    board: 'board';
}
