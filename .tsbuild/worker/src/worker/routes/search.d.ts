import { z } from 'zod';
import type { Env } from '../env';
import type { SearchHit } from '../adapters/search/types';
export type SearchResult = SearchHit;
export declare const searchRoutes: import("hono/hono-base").HonoBase<Env, {
    "/api/search": {
        $get: {
            input: {
                query: {
                    q?: string | undefined;
                    projectId?: string | undefined;
                    scope?: "all" | "project" | undefined;
                };
            };
            output: z.ZodSafeParseError<{
                q: string;
                scope: "all" | "project";
                projectId?: string | undefined;
            }>;
            outputFormat: "json";
            status: 400;
        } | {
            input: {
                query: {
                    q?: string | undefined;
                    projectId?: string | undefined;
                    scope?: "all" | "project" | undefined;
                };
            };
            output: {
                id: string;
                title: string;
                icon?: string | null | undefined;
                kind: "notepad" | "card";
                projectId: string;
                projectName: string;
                snippet: string;
            }[];
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/api/search">;
