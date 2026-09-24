import { z } from 'zod'

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8788),
  SQLITE_PATH: z.string().min(1).default('./data/burrow.db'),
  LOCAL_STORAGE_PATH: z.string().min(1).default('./data/uploads'),
  BETTER_AUTH_SECRET: z.string().min(1).default('local-dev-secret-change-me'),
  BETTER_AUTH_URL: z.string().min(1).default('http://localhost:8788'),
  BOOTSTRAP_TOKEN: z.string().default(''),
  DATABASE_URL: z.string().optional(),
})

export type ServerConfig = z.infer<typeof configSchema>

/** Load + validate the Node server env. Throws a zod error on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return configSchema.parse({
    PORT: env.PORT,
    SQLITE_PATH: env.SQLITE_PATH,
    LOCAL_STORAGE_PATH: env.LOCAL_STORAGE_PATH,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BOOTSTRAP_TOKEN: env.BOOTSTRAP_TOKEN,
    DATABASE_URL: env.DATABASE_URL,
  })
}