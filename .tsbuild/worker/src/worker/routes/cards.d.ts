import type { Env } from '../env';
export declare const cardsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/my-tasks": {
        $get: {
            input: {
                query: {
                    status?: "completed" | "all" | "open" | undefined;
                    projectId?: string | undefined;
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
                    status?: "completed" | "all" | "open" | undefined;
                    projectId?: string | undefined;
                };
            };
            output: {
                id: string;
                notepadId: string;
                boardId: string;
                columnId: string;
                projectId: string;
                title: string;
                dueDate: number | null;
                priority: import("../services/cards").CardPriority | null;
                isCompleted: boolean;
                createdAt: number;
                boardName: string;
                columnName: string;
                projectName: string;
                projectIcon: string | null;
                projectColor: string | null;
                tags: {
                    id: string;
                    name: string;
                    color: string | null;
                }[];
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
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
                subtasks: {
                    id: string;
                    cardId: string;
                    title: string;
                    completed: boolean;
                    position: string;
                    createdAt: number;
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
} & {
    "/api/cards/:id/subtasks": {
        $post: {
            input: {
                json: {
                    title: string;
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
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                id: string;
                cardId: string;
                title: string;
                completed: boolean;
                position: string;
                createdAt: number;
            };
            outputFormat: "json";
            status: 201;
        };
    };
} & {
    "/api/cards/:id/subtasks/:subtaskId": {
        $patch: {
            input: {
                json: {
                    title?: string | undefined;
                    completed?: boolean | undefined;
                    afterId?: string | null | undefined;
                };
            } & {
                param: {
                    id: string;
                } & {
                    subtaskId: string;
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
                    completed?: boolean | undefined;
                    afterId?: string | null | undefined;
                };
            } & {
                param: {
                    id: string;
                } & {
                    subtaskId: string;
                };
            };
            output: {
                ok: boolean;
                subtaskId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id/subtasks/:subtaskId": {
        $delete: {
            input: {
                param: {
                    id: string;
                } & {
                    subtaskId: string;
                };
            };
            output: {
                ok: boolean;
                subtaskId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id/comments": {
        $get: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                id: string;
                cardId: string;
                userId: string;
                content: string;
                createdAt: number;
                updatedAt: number;
                name: string;
                image: string | null;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/cards/:id/comments": {
        $post: {
            input: {
                json: {
                    content: string;
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
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                id: string;
                cardId: string;
                userId: string;
                content: string;
                createdAt: number;
                updatedAt: number;
                name: string;
                image: string | null;
                mentionedUserIds: string[];
            };
            outputFormat: "json";
            status: 201;
        };
    };
} & {
    "/api/cards/:id/comments/:commentId": {
        $delete: {
            input: {
                param: {
                    id: string;
                } & {
                    commentId: string;
                };
            };
            output: {
                ok: boolean;
                commentId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/cards/:id/comments/:commentId">;
