import type { Env } from '../env';
export declare const invitesRoutes: import("hono/hono-base").HonoBase<Env, {
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
}, "/", "/api/invites/accept">;
