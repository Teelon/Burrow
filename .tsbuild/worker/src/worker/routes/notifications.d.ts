import type { Env } from '../env';
export declare const notificationsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/notifications": {
        $get: {
            input: {};
            output: {
                id: string;
                type: "mention" | "assigned";
                actor: {
                    id: string;
                    name: string;
                    image: string | null;
                };
                notepadId: string | null;
                cardId: string | null;
                targetTitle: string | undefined;
                readAt: number | null;
                createdAt: number;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/notifications/read": {
        $post: {
            input: {
                json: {
                    ids?: string[] | undefined;
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
                    ids?: string[] | undefined;
                };
            };
            output: {
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/notifications/read">;
