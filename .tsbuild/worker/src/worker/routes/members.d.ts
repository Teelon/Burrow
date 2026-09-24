import type { Env } from '../env';
export declare const membersRoutes: import("hono/hono-base").HonoBase<Env, {
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
}, "/", "/api/members/:userId">;
