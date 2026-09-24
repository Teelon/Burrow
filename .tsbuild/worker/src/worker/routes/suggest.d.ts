import type { Env } from '../env';
export declare const suggestRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/suggest": {
        $get: {
            input: {
                query: {
                    type: "user" | "notepad" | "card" | "tag";
                    q?: string | undefined;
                    projectId?: string | undefined;
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
                    type: "user" | "notepad" | "card" | "tag";
                    q?: string | undefined;
                    projectId?: string | undefined;
                };
            };
            output: {
                id: string;
                label: string;
                description: string;
                image: string | null;
                kind: "user";
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {
                query: {
                    type: "user" | "notepad" | "card" | "tag";
                    q?: string | undefined;
                    projectId?: string | undefined;
                };
            };
            output: {
                id: string;
                label: string;
                icon: string | null;
                kind: "notepad";
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {
                query: {
                    type: "user" | "notepad" | "card" | "tag";
                    q?: string | undefined;
                    projectId?: string | undefined;
                };
            };
            output: {
                id: string;
                label: string;
                description: string;
                priority: "low" | "medium" | "high" | "urgent" | null;
                kind: "card";
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {
                query: {
                    type: "user" | "notepad" | "card" | "tag";
                    q?: string | undefined;
                    projectId?: string | undefined;
                };
            };
            output: {
                id: string;
                label: string;
                color: string | null;
                kind: "tag";
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/suggest">;
