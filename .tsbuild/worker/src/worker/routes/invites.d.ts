import type { Env } from '../env';
export declare const invitesRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/invites": {
        $post: {
            input: {
                json: {
                    email: string;
                    role: "viewer" | "editor";
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
                    role: "viewer" | "editor";
                };
            };
            output: {
                id: string;
                email: string;
                role: "viewer" | "editor";
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
                role: "viewer" | "editor";
                expiresAt: number;
                createdAt: number;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/invites/info/:token": {
        $get: {
            input: {
                param: {
                    token: string;
                };
            };
            output: {
                valid: true;
                token: string;
                email: string;
                role: "viewer" | "editor";
                workspaceName: string;
                expiresAt: number;
            };
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
                role: "viewer" | "editor";
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/invites/accept">;
