/** Typed Hono RPC client. Same origin, so no CORS and no base URL games. */
export declare const api: {
    api: {
        health: import("hono/client").ClientRequest<string, "/api/health", {
            $get: {
                input: {};
                output: {
                    ok: true;
                    now: number;
                };
                outputFormat: "json";
                status: import("hono/utils/http-status").ContentfulStatusCode;
            };
        }>;
    };
};
