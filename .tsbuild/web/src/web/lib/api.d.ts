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
};
