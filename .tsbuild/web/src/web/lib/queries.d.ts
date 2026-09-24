export declare function useHealth(): import("@tanstack/react-query").UseQueryResult<{
    ok: true;
    now: number;
}, Error>;
export declare function useMe(): import("@tanstack/react-query").UseQueryResult<{
    user: {
        id: string;
        name: string;
        email: string;
        image: string | null;
    } | undefined;
    workspace: {
        id: string;
        name: string;
    } | undefined;
    role: "owner" | "editor" | "viewer";
    lastProjectId: string | null;
} | null, Error>;
export declare function useProjects(): import("@tanstack/react-query").UseQueryResult<{
    id: string;
    workspaceId: string;
    name: string;
    icon: string | null;
    color: string | null;
    position: string;
    archivedAt: number | null;
    createdAt: number;
    updatedAt: number;
}[], Error>;
export declare function useCreateProject(): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    position: string;
}, Error, {
    name: string;
    icon?: string | null;
    color?: string | null;
}, unknown>;
export declare function useUpdateProject(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    projectId: string;
}, Error, {
    id: string;
    name?: string;
    icon?: string | null;
    color?: string | null;
    archived?: boolean;
}, unknown>;
export declare function useDeleteProject(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    deletedProjectId: string;
}, Error, {
    id: string;
    confirmName: string;
}, unknown>;
export declare function useMembers(): import("@tanstack/react-query").UseQueryResult<{
    userId: string;
    name: string;
    email: string;
    image: string | null;
    role: "owner" | "editor" | "viewer";
    joinedAt: number;
}[], Error>;
export declare function useInvites(): import("@tanstack/react-query").UseQueryResult<{
    id: string;
    email: string;
    role: "editor" | "viewer";
    expiresAt: number;
    createdAt: number;
}[], Error>;
export declare function useCreateInvite(): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    email: string;
    role: "editor" | "viewer";
    token: string;
    expiresAt: number;
    url: string;
}, Error, {
    email: string;
    role: "editor" | "viewer";
}, unknown>;
export declare function useRevokeInvite(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    id: string;
}, Error, string, unknown>;
export declare function useInviteInfo(token: string | undefined): import("@tanstack/react-query").UseQueryResult<{
    valid: boolean;
    token: string;
    email: string;
    role: "editor" | "viewer";
    workspaceName: string;
    expiresAt: number;
}, Error>;
export declare function useBoards(projectId: string | undefined): import("@tanstack/react-query").UseQueryResult<{
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number;
}[], Error>;
export declare function useBoard(boardId: string | undefined): import("@tanstack/react-query").UseQueryResult<{
    columns: {
        cards: any[];
        id: string;
        boardId: string;
        name: string;
        color: string | null;
        position: string;
    }[];
    id: string;
    workspaceId: string;
    projectId: string;
    name: string;
    icon: string | null;
    position: string;
    deletedAt: number | null;
    createdAt: number;
    updatedAt: number;
} | null, Error>;
export declare function useCreateBoard(): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    position: string;
}, Error, {
    projectId: string;
    name: string;
    icon?: string | null;
}, unknown>;
export declare function useUpdateBoard(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    boardId: string;
}, Error, {
    boardId: string;
    name?: string;
    icon?: string | null;
}, unknown>;
export declare function useDeleteBoard(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    deletedId: string;
}, Error, string, unknown>;
export declare function useCreateColumn(): import("@tanstack/react-query").UseMutationResult<{
    id: string;
    position: string;
}, Error, {
    boardId: string;
    name: string;
    color?: string | null;
}, unknown>;
export declare function useUpdateColumn(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    columnId: string;
}, Error, {
    boardId: string;
    columnId: string;
    name?: string;
    color?: string | null;
}, unknown>;
export declare function useDeleteColumn(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    deletedId: string;
}, Error, {
    boardId: string;
    columnId: string;
    moveTo?: string | null;
}, unknown>;
export declare function useMoveColumn(): import("@tanstack/react-query").UseMutationResult<{
    position: string;
}, Error, {
    boardId: string;
    columnId: string;
    afterId?: string | null;
}, unknown>;
export declare function useCreateCard(): import("@tanstack/react-query").UseMutationResult<{
    cardId: string;
    notepadId: string;
    linkedNotepadId: string | null;
}, Error, {
    boardId: string;
    columnId: string;
    title: string;
    priority?: "low" | "medium" | "high" | "urgent" | null;
    dueDate?: number | null;
    assigneeIds?: string[];
    tagIds?: string[];
    notepad?: {
        mode: "new";
    } | {
        mode: "existing";
        id: string;
    };
}, unknown>;
export declare function useCard(cardId: string | undefined): import("@tanstack/react-query").UseQueryResult<{
    boardName: string;
    columnName: string;
    assignees: {
        userId: string;
        name: string;
        image: string | null;
    }[];
    tags: {
        id: string;
        name: string;
        color: string | null;
    }[];
    lock: {
        userId: string;
        clientId: string;
        name: string;
        expiresAt: number;
    } | null;
    id: string;
    boardId: string;
    columnId: string;
    notepadId: string;
    position: string;
    priority: "low" | "medium" | "high" | "urgent" | null;
    dueDate: number | null;
    createdAt: number;
    title: string;
    content: string;
    version: number;
    projectId: string;
    workspaceId: string;
} | null, Error>;
export declare function useUpdateCard(): import("@tanstack/react-query").UseMutationResult<{
    ok: boolean;
    cardId: string;
}, Error, {
    cardId: string;
    boardId?: string;
    title?: string;
    priority?: "low" | "medium" | "high" | "urgent" | null;
    dueDate?: number | null;
    assigneeIds?: string[];
    tagIds?: string[];
}, unknown>;
export declare function useMoveCard(): import("@tanstack/react-query").UseMutationResult<{
    columnId: string;
    position: string;
}, Error, {
    cardId: string;
    boardId: string;
    columnId: string;
    afterId?: string | null;
}, {
    prevBoard: any;
}>;
export declare function useDeleteCard(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
    deletedId: string;
}, Error, {
    cardId: string;
    boardId: string;
}, unknown>;
export declare function useNotifications(unreadOnly?: boolean): import("@tanstack/react-query").UseQueryResult<{
    id: string;
    type: "mention" | "assigned";
    actor: {
        id: string;
        name: string;
        image: string | null;
    };
    notepadId: string | null;
    cardId: string | null;
    targetTitle: string | undefined;
    readAt: number | null;
    createdAt: number;
}[], Error>;
export declare function useMarkNotificationsRead(): import("@tanstack/react-query").UseMutationResult<{
    ok: true;
}, Error, string[] | undefined, unknown>;
export interface TrashedNotepad {
    id: string;
    kind: 'notepad' | 'card';
    title: string;
    icon?: string | null;
    deletedAt: number;
}
export interface TrashedBoard {
    id: string;
    name: string;
    icon?: string | null;
    deletedAt: number;
}
export declare function useTrash(projectId?: string): import("@tanstack/react-query").UseQueryResult<{
    notepads: TrashedNotepad[];
    boards: TrashedBoard[];
}, Error>;
export declare function useRestoreNotepad(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    notepadId: string;
    projectId: string;
}, unknown>;
export declare function usePermanentDeleteNotepad(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    notepadId: string;
    projectId: string;
}, unknown>;
export declare function useRestoreBoard(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    boardId: string;
    projectId: string;
}, unknown>;
export declare function usePermanentDeleteBoard(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    boardId: string;
    projectId: string;
}, unknown>;
export declare function useRecentNotepads(projectId?: string): import("@tanstack/react-query").UseQueryResult<{
    id: string;
    title: string;
    icon?: string | null;
    updatedAt: number;
}[], Error>;
export interface TagItem {
    id: string;
    projectId: string;
    name: string;
    color?: string | null;
}
export declare function useProjectTags(projectId?: string): import("@tanstack/react-query").UseQueryResult<TagItem[], Error>;
export declare function useCreateTag(): import("@tanstack/react-query").UseMutationResult<TagItem, Error, {
    projectId: string;
    name: string;
    color?: string | null;
}, unknown>;
export declare function useDeleteTag(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    tagId: string;
    projectId: string;
}, unknown>;
export interface SearchItem {
    id: string;
    title: string;
    icon?: string | null;
    kind: 'notepad' | 'card';
    projectId: string;
    projectName: string;
    snippet: string;
}
export declare function useSearch(query: string, projectId?: string, scope?: 'project' | 'all'): import("@tanstack/react-query").UseQueryResult<SearchItem[], Error>;
