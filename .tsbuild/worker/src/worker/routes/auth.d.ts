import type { Env } from '../env';
export declare const authRoutes: import("hono/hono-base").HonoBase<Env, {
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
}, "/", "/api/me">;
