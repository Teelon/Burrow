import type { Env } from '../env';
export declare const columnsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/boards/:id/columns": {
        $post: {
            input: {
                json: {
                    name: string;
                    color?: string | null | undefined;
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
                    name: string;
                    color?: string | null | undefined;
                };
            } & {
                param: {
                    id: string;
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
    "/api/columns/:id": {
        $patch: {
            input: {
                json: {
                    name?: string | undefined;
                    color?: string | null | undefined;
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
                    color?: string | null | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                ok: true;
                columnId: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/columns/:id/move": {
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
                position: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/columns/:id": {
        $delete: {
            input: {
                query: {
                    moveTo?: string | undefined;
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
                    moveTo?: string | undefined;
                };
            } & {
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
}, "/", "/api/columns/:id">;
