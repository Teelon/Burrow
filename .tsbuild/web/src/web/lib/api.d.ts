/** Typed Hono RPC client. Same origin, so no CORS and no base URL games. */
export declare const api: {
    api: {
        health: import("hono/client").ClientRequest<string, "/api/health", {
            $get: {
                input: {};
                output: {
                    ok: true;
                    now: number;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
} & {
    api: {
        auth: {
            "sign-up": {
                email: import("hono/client").ClientRequest<string, "/api/auth/sign-up/email", {
                    $post: {
                        input: {};
                        output: {};
                        outputFormat: string;
                        status: import("hono/utils/http-status").StatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        auth: {
            "*": import("hono/client").ClientRequest<string, "/api/auth/*", {
                $all: {
                    input: {};
                    output: {};
                    outputFormat: string;
                    status: import("hono/utils/http-status").StatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        me: import("hono/client").ClientRequest<string, "/api/me", {
            $get: {
                input: {};
                output: {
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
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
} & {
    api: {
        members: import("hono/client").ClientRequest<string, "/api/members", {
            $get: {
                input: {};
                output: {
                    userId: string;
                    name: string;
                    email: string;
                    image: string | null;
                    role: "owner" | "editor" | "viewer";
                    joinedAt: number;
                }[];
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
} & {
    api: {
        members: {
            ":userId": import("hono/client").ClientRequest<string, "/api/members/:userId", {
                $patch: {
                    input: {
                        json: {
                            role: "owner" | "editor" | "viewer";
                        };
                    } & {
                        param: {
                            userId: string;
                        };
                    };
                    output: {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                    outputFormat: "json";
                    status: 400;
                } | {
                    input: {
                        json: {
                            role: "owner" | "editor" | "viewer";
                        };
                    } & {
                        param: {
                            userId: string;
                        };
                    };
                    output: {
                        ok: true;
                        userId: string;
                        role: "owner" | "editor" | "viewer";
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
                $delete: {
                    input: {
                        param: {
                            userId: string;
                        };
                    };
                    output: {
                        ok: true;
                        removedUserId: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        invites: import("hono/client").ClientRequest<string, "/api/invites", {
            $post: {
                input: {
                    json: {
                        email: string;
                        role: "editor" | "viewer";
                    };
                };
                output: {
                    error: {
                        code: string;
                        message: string;
                    };
                };
                outputFormat: "json";
                status: 400;
            } | {
                input: {
                    json: {
                        email: string;
                        role: "editor" | "viewer";
                    };
                };
                output: {
                    id: string;
                    email: string;
                    role: "editor" | "viewer";
                    token: string;
                    expiresAt: number;
                    url: string;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
            $get: {
                input: {};
                output: {
                    id: string;
                    email: string;
                    role: "editor" | "viewer";
                    expiresAt: number;
                    createdAt: number;
                }[];
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
} & {
    api: {
        invites: {
            ":id": import("hono/client").ClientRequest<string, "/api/invites/:id", {
                $delete: {
                    input: {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        ok: true;
                        id: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        invites: {
            accept: import("hono/client").ClientRequest<string, "/api/invites/accept", {
                $post: {
                    input: {
                        json: {
                            token: string;
                        };
                    };
                    output: {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                    outputFormat: "json";
                    status: 400;
                } | {
                    input: {
                        json: {
                            token: string;
                        };
                    };
                    output: {
                        ok: true;
                        workspaceId: string;
                        role: "editor" | "viewer";
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        projects: import("hono/client").ClientRequest<string, "/api/projects", {
            $get: {
                input: {};
                output: {
                    id: string;
                    workspaceId: string;
                    name: string;
                    icon: string | null;
                    color: string | null;
                    position: string;
                    archivedAt: number | null;
                    createdAt: number;
                    updatedAt: number;
                }[];
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
            $post: {
                input: {
                    json: {
                        name: string;
                        icon?: string | null | undefined;
                        color?: string | null | undefined;
                    };
                };
                output: {
                    error: {
                        code: string;
                        message: string;
                    };
                };
                outputFormat: "json";
                status: 400;
            } | {
                input: {
                    json: {
                        name: string;
                        icon?: string | null | undefined;
                        color?: string | null | undefined;
                    };
                };
                output: {
                    id: string;
                    position: string;
                };
                outputFormat: "json";
                status: 201;
            };
        }>;
    };
} & {
    api: {
        projects: {
            ":id": import("hono/client").ClientRequest<string, "/api/projects/:id", {
                $patch: {
                    input: {
                        json: {
                            name?: string | undefined;
                            icon?: string | null | undefined;
                            color?: string | null | undefined;
                            archived?: boolean | undefined;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                    outputFormat: "json";
                    status: 400;
                } | {
                    input: {
                        json: {
                            name?: string | undefined;
                            icon?: string | null | undefined;
                            color?: string | null | undefined;
                            archived?: boolean | undefined;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        ok: true;
                        projectId: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
                $delete: {
                    input: {
                        query: {
                            confirm: string;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                    outputFormat: "json";
                    status: 400;
                } | {
                    input: {
                        query: {
                            confirm: string;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        ok: true;
                        deletedProjectId: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        projects: {
            ":id": {
                move: import("hono/client").ClientRequest<string, "/api/projects/:id/move", {
                    $post: {
                        input: {
                            json: {
                                afterId?: string | null | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                afterId?: string | null | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            ok: true;
                            projectId: string;
                            position: string;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        projects: {
            ":pid": {
                notepads: import("hono/client").ClientRequest<string, "/api/projects/:pid/notepads", {
                    $get: {
                        input: {
                            param: {
                                pid: string;
                            };
                        };
                        output: {
                            id: string;
                            parentId: string | null;
                            title: string;
                            icon: string | null;
                            position: string;
                            isFavorite: boolean;
                        }[];
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                    $post: {
                        input: {
                            json: {
                                parentId?: string | null | undefined;
                                title?: string | undefined;
                            };
                        } & {
                            param: {
                                pid: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                parentId?: string | null | undefined;
                                title?: string | undefined;
                            };
                        } & {
                            param: {
                                pid: string;
                            };
                        };
                        output: {
                            id: string;
                            position: string;
                            version: number;
                        };
                        outputFormat: "json";
                        status: 201;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": import("hono/client").ClientRequest<string, "/api/notepads/:id", {
                $get: {
                    input: {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        tags: {
                            id: string;
                            name: string;
                            color: string | null;
                        }[];
                        backlinks: {
                            id: string;
                            title: string;
                            icon: string | null;
                        }[];
                        lock: {
                            userId: string;
                            name: string;
                            expiresAt: number;
                        } | null;
                        id: string;
                        workspaceId: string;
                        projectId: string;
                        parentId: string | null;
                        kind: "notepad" | "card";
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
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
                $patch: {
                    input: {
                        json: {
                            title?: string | undefined;
                            icon?: string | null | undefined;
                            coverKey?: string | null | undefined;
                            isFavorite?: boolean | undefined;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        error: {
                            code: string;
                            message: string;
                        };
                    };
                    outputFormat: "json";
                    status: 400;
                } | {
                    input: {
                        json: {
                            title?: string | undefined;
                            icon?: string | null | undefined;
                            coverKey?: string | null | undefined;
                            isFavorite?: boolean | undefined;
                        };
                    } & {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        ok: true;
                        notepadId: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
                $delete: {
                    input: {
                        param: {
                            id: string;
                        };
                    };
                    output: {
                        ok: true;
                        deletedId: string;
                    };
                    outputFormat: "json";
                    status: import("hono/utils/http-status").ContentfulStatusCode;
                };
            }>;
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                content: import("hono/client").ClientRequest<string, "/api/notepads/:id/content", {
                    $put: {
                        input: {
                            json: {
                                content: string;
                                baseVersion: number;
                                clientId?: string | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                content: string;
                                baseVersion: number;
                                clientId?: string | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            version: number;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    } | {
                        input: {
                            json: {
                                content: string;
                                baseVersion: number;
                                clientId?: string | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: any;
                        };
                        outputFormat: "json";
                        status: 409;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                move: import("hono/client").ClientRequest<string, "/api/notepads/:id/move", {
                    $post: {
                        input: {
                            json: {
                                parentId?: string | null | undefined;
                                afterId?: string | null | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                parentId?: string | null | undefined;
                                afterId?: string | null | undefined;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            parentId: string | null;
                            position: string;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                restore: import("hono/client").ClientRequest<string, "/api/notepads/:id/restore", {
                    $post: {
                        input: {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            ok: true;
                            restoredId: string;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                permanent: import("hono/client").ClientRequest<string, "/api/notepads/:id/permanent", {
                    $delete: {
                        input: {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            ok: true;
                            permanentlyDeletedId: string;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        projects: {
            ":pid": {
                trash: import("hono/client").ClientRequest<string, "/api/projects/:pid/trash", {
                    $get: {
                        input: {
                            param: {
                                pid: string;
                            };
                        };
                        output: {
                            notepads: {
                                id: string;
                                kind: "notepad" | "card";
                                title: string;
                                icon: string | null;
                                deletedAt: number | null;
                            }[];
                            boards: {
                                id: string;
                                name: string;
                                icon: string | null;
                                deletedAt: number | null;
                            }[];
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        projects: {
            ":pid": {
                recent: import("hono/client").ClientRequest<string, "/api/projects/:pid/recent", {
                    $get: {
                        input: {
                            param: {
                                pid: string;
                            };
                        };
                        output: {
                            id: string;
                            title: string;
                            icon: string | null;
                            updatedAt: number;
                        }[];
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                lock: import("hono/client").ClientRequest<string, "/api/notepads/:id/lock", {
                    $post: {
                        input: {
                            json: {
                                clientId: string;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                clientId: string;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            expiresAt: number;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    } | {
                        input: {
                            json: {
                                clientId: string;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: any;
                        };
                        outputFormat: "json";
                        status: 409;
                    };
                    $delete: {
                        input: {
                            json: {
                                clientId: string;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                clientId: string;
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            ok: true;
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        notepads: {
            ":id": {
                tags: import("hono/client").ClientRequest<string, "/api/notepads/:id/tags", {
                    $put: {
                        input: {
                            json: {
                                tagIds: string[];
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            error: {
                                code: string;
                                message: string;
                            };
                        };
                        outputFormat: "json";
                        status: 400;
                    } | {
                        input: {
                            json: {
                                tagIds: string[];
                            };
                        } & {
                            param: {
                                id: string;
                            };
                        };
                        output: {
                            ok: true;
                            notepadId: string;
                            tagIds: string[];
                        };
                        outputFormat: "json";
                        status: import("hono/utils/http-status").ContentfulStatusCode;
                    };
                }>;
            };
        };
    };
} & {
    api: {
        uploads: import("hono/client").ClientRequest<string, "/api/uploads", {
            $post: {
                input: {};
                output: {
                    key: string;
                    url: string;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
} & {
    api: {
        files: {
            ":key": import("hono/client").ClientRequest<string, "/api/files/:key", {
                $get: {
                    input: {
                        param: {
                            key: string;
                        };
                    };
                    output: {};
                    outputFormat: string;
                    status: import("hono/utils/http-status").StatusCode;
                };
            }>;
        };
    };
};
