import type { Env } from './env';
/**
 * NOTE (Hono RPC): route registration returns a NEW type; a plain
 * `const app = new Hono(); app.get(...)` would export a schema-less app type
 * and the typed client (`hc`) would collapse to `unknown`. Always chain.
 */
export declare const app: import("hono/hono-base").HonoBase<Env, {
    "/api/health": {
        $get: {
            input: {};
            output: {
                ok: true;
                now: number;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} | import("hono/types").MergeSchemaPath<{
    "/api/auth/sign-up/email": {
        $post: {
            input: {};
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
        };
    };
} & {
    "/api/auth/*": {
        $all: {
            input: {};
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
        };
    };
} & {
    "/api/me": {
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
    };
}, "/"> | import("hono/types").MergeSchemaPath<{
    "/api/members": {
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
    };
} & {
    "/api/members/:userId": {
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
    };
} & {
    "/api/members/:userId": {
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
    };
}, "/"> | import("hono/types").MergeSchemaPath<{
    "/api/invites": {
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
    };
} & {
    "/api/invites": {
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
    };
} & {
    "/api/invites/:id": {
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
    };
} & {
    "/api/invites/accept": {
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
    };
}, "/">, "/", "/api/health">;
export type AppType = typeof app;
export default app;
