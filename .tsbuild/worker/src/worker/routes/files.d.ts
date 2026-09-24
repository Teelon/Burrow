import type { Env } from '../env';
export declare const filesRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/uploads": {
        $post: {
            input: {};
            output: {
                key: string;
                url: string;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/files/:key": {
        $get: {
            input: {
                param: {
                    key: string;
                };
            };
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
        };
    };
}, "/", "/api/files/:key">;
