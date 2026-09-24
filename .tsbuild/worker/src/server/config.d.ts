import { z } from 'zod';
declare const configSchema: z.ZodObject<{
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    SQLITE_PATH: z.ZodDefault<z.ZodString>;
    LOCAL_STORAGE_PATH: z.ZodDefault<z.ZodString>;
    BETTER_AUTH_SECRET: z.ZodDefault<z.ZodString>;
    BETTER_AUTH_URL: z.ZodDefault<z.ZodString>;
    BOOTSTRAP_TOKEN: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ServerConfig = z.infer<typeof configSchema>;
/** Load + validate the Node server env. Throws a zod error on bad input. */
export declare function loadConfig(env?: NodeJS.ProcessEnv): ServerConfig;
export {};
