import type { Env } from '../env';
export declare const projectsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/projects": {
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
    };
} & {
    "/api/projects": {
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
    };
} & {
    "/api/projects/:id": {
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
    };
} & {
    "/api/projects/:id/move": {
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
    };
} & {
    "/api/projects/:id": {
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
    };
}, "/", "/api/projects/:id">;
