import type { Env } from '../env';
export declare const notepadsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/projects/:pid/notepads": {
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
    };
} & {
    "/api/projects/:pid/notepads": {
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
    };
} & {
    "/api/notepads/:id": {
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
                    clientId: string;
                    name: string;
                    expiresAt: number;
                    isMe: boolean;
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
    };
} & {
    "/api/notepads/:id": {
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
    };
} & {
    "/api/notepads/:id/content": {
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
    };
} & {
    "/api/notepads/:id/move": {
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
    };
} & {
    "/api/notepads/:id": {
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
    };
} & {
    "/api/notepads/:id/restore": {
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
    };
} & {
    "/api/notepads/:id/permanent": {
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
    };
} & {
    "/api/projects/:pid/trash": {
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
    };
} & {
    "/api/projects/:pid/recent": {
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
    };
} & {
    "/api/notepads/:id/lock": {
        $post: {
            input: {
                json: {
                    clientId: string;
                    takeover?: boolean | undefined;
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
                    takeover?: boolean | undefined;
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
                    takeover?: boolean | undefined;
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
    };
} & {
    "/api/notepads/:id/lock": {
        $delete: {
            input: {
                json: {
                    clientId: string;
                    takeover?: boolean | undefined;
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
                    takeover?: boolean | undefined;
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
    };
} & {
    "/api/notepads/:id/tags": {
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
    };
}, "/", "/api/notepads/:id/tags">;
