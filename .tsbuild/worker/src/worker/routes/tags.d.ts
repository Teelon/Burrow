import { z } from 'zod';
import type { Env } from '../env';
export declare const tagsRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/projects/:pid/tags": {
        $get: {
            input: {
                param: {
                    pid: string;
                };
            };
            output: {
                id: string;
                projectId: string;
                name: string;
                color: string | null;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/projects/:pid/tags": {
        $post: {
            input: {
                json: {
                    name: string;
                    color?: string | undefined;
                };
            } & {
                param: {
                    pid: string;
                };
            };
            output: z.ZodSafeParseError<{
                name: string;
                color?: string | undefined;
            }>;
            outputFormat: "json";
            status: 400;
        } | {
            input: {
                json: {
                    name: string;
                    color?: string | undefined;
                };
            } & {
                param: {
                    pid: string;
                };
            };
            output: {
                id: string;
                projectId: string;
                name: string;
                color: string | null;
            };
            outputFormat: "json";
            status: 200;
        } | {
            input: {
                json: {
                    name: string;
                    color?: string | undefined;
                };
            } & {
                param: {
                    pid: string;
                };
            };
            output: {
                id: string;
                projectId: string;
                name: string;
                color: string | null;
            };
            outputFormat: "json";
            status: 201;
        };
    };
} & {
    "/api/tags/:id": {
        $patch: {
            input: {
                json: {
                    name?: string | undefined;
                    color?: string | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: z.ZodSafeParseError<{
                name?: string | undefined;
                color?: string | undefined;
            }>;
            outputFormat: "json";
            status: 400;
        } | {
            input: {
                json: {
                    name?: string | undefined;
                    color?: string | undefined;
                };
            } & {
                param: {
                    id: string;
                };
            };
            output: {
                id: string;
                projectId: string;
                name: string;
                color: string | null;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
} & {
    "/api/tags/:id": {
        $delete: {
            input: {
                param: {
                    id: string;
                };
            };
            output: {
                ok: true;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/tags/:id">;
