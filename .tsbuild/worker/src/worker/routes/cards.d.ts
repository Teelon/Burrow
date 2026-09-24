import type { Env } from '../env';
export declare const cardsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/cards/summary": {
        $get: {
            input: {};
            output: {
                id: string;
                notepadId: string;
                title: string;
                boardId: string;
                boardName: string;
                columnId: string;
                columnName: string;
                priority: "low" | "medium" | "high" | "urgent" | null;
                dueDate: number | null;
                assignees: {
                    userId: string;
                    name: string;
                    image: string | null;
                }[];
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/columns/:id/cards": {
        $post: {
            input: {
                json: {
                    title: string;
                    priority?: "low" | "medium" | "high" | "urgent" | null | undefined;
                    dueDate?: number | null | undefined;
                    assigneeIds?: string[] | undefined;
                    tagIds?: string[] | undefined;
                    notepad?: {
                        mode: "new";
                    } | {
                        mode: "existing";
                        id: string;
                    } | undefined;
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
                    title: string;
                    priority?: "low" | "medium" | "high" | "urgent" | null | undefined;
                    dueDate?: number | null | undefined;
                    assigneeIds?: string[] | undefined;
                    tagIds?: string[] | undefined;
                    notepad?: {
                        mode: "new";
                    } | {
                        mode: "existing";
                        id: string;
                    } | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                cardId: string;
                notepadId: string;
                linkedNotepadId: string | null;
            };
            outputFormat: "json";
            status: 201;
        };
    };
} & {
    "/api/cards/:id": {
        $get: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
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
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id": {
        $patch: {
            input: {
                json: {
                    title?: string | undefined;
                    priority?: "low" | "medium" | "high" | "urgent" | null | undefined;
                    dueDate?: number | null | undefined;
                    assigneeIds?: string[] | undefined;
                    tagIds?: string[] | undefined;
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
                    priority?: "low" | "medium" | "high" | "urgent" | null | undefined;
                    dueDate?: number | null | undefined;
                    assigneeIds?: string[] | undefined;
                    tagIds?: string[] | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                ok: boolean;
                cardId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id/move": {
        $post: {
            input: {
                json: {
                    columnId: string;
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
                    columnId: string;
                    afterId?: string | null | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                columnId: string;
                position: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id": {
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
    "/api/cards/:id/restore": {
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
    "/api/cards/:id/permanent": {
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
}, "/", "/api/cards/:id/permanent">;
