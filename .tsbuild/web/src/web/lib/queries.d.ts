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
