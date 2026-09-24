import type { Env } from '../env';
export declare const boardsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/projects/:pid/boards": {
        $get: {
            input: {
                param: {
                    pid: string;
                };
            };
            output: {
                id: string;
                workspaceId: string;
                projectId: string;
                name: string;
                icon: string | null;
                position: string;
                deletedAt: number | null;
                createdAt: number;
                updatedAt: number;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/projects/:pid/boards": {
        $post: {
            input: {
                json: {
                    name: string;
                    icon?: string | null | undefined;
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
                    name: string;
                    icon?: string | null | undefined;
                };
            } & {
                param: {
                    pid: string;
                };
            };
            output: {
                id: string;
                position: string;
            };
            outputFormat: "json";
            status: 201;
        };
    };
} & {
    "/api/boards/:id": {
        $get: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                columns: {
                    cards: any[];
                    id: string;
                    boardId: string;
                    name: string;
                    color: string | null;
                    position: string;
                    wipLimit: number | null;
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
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/boards/:id": {
        $patch: {
            input: {
                json: {
                    name?: string | undefined;
                    icon?: string | null | undefined;
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
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                ok: true;
                boardId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/boards/:id": {
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
    "/api/boards/:id/restore": {
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
    "/api/boards/:id/permanent": {
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
}, "/", "/api/boards/:id/permanent">;
