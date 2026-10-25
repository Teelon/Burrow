import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3005),
  SQLITE_PATH: z.string().min(1).default('./data/burrow.db'),
  LOCAL_STORAGE_PATH: z.string().min(1).default('./data/uploads'),
  BETTER_AUTH_SECRET: z.string().min(1).default('dev-secret-change-me-32-bytes-minimum!!'),
  BETTER_AUTH_URL: z.string().min(1).default('http://localhost:3005'),
  BOOTSTRAP_TOKEN: z.string().default('dev-bootstrap-token'),
  DATABASE_URL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),
});

export type ServerConfig = z.infer<typeof configSchema>;

/** Load + validate the Node server env. Throws a zod error on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const isProd = env.NODE_ENV === 'production';
  if (isProd) {
    if (
      !env.BETTER_AUTH_SECRET ||
      env.BETTER_AUTH_SECRET === 'dev-secret-change-me-32-bytes-minimum!!' ||
      env.BETTER_AUTH_SECRET === 'local-dev-secret-change-me' ||
      env.BETTER_AUTH_SECRET.length < 32
    ) {
      throw new Error(
        'BETTER_AUTH_SECRET must be set to a secure string of at least 32 characters in production',
      );
    }
    if (
      !env.BOOTSTRAP_TOKEN ||
      env.BOOTSTRAP_TOKEN === 'dev-bootstrap-token' ||
      env.BOOTSTRAP_TOKEN.length < 16
    ) {
      throw new Error(
        'BOOTSTRAP_TOKEN must be set to a secure string of at least 16 characters in production',
      );
    }
  }

  return configSchema.parse({
    PORT: env.PORT,
    SQLITE_PATH: env.SQLITE_PATH,
    LOCAL_STORAGE_PATH: env.LOCAL_STORAGE_PATH,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    BOOTSTRAP_TOKEN: env.BOOTSTRAP_TOKEN,
    DATABASE_URL: env.DATABASE_URL,
    RESEND_API_KEY: env.RESEND_API_KEY,
    EMAIL_FROM: env.EMAIL_FROM,
    S3_ENDPOINT: env.S3_ENDPOINT,
    S3_REGION: env.S3_REGION,
    S3_BUCKET: env.S3_BUCKET,
    S3_ACCESS_KEY: env.S3_ACCESS_KEY,
    S3_SECRET_KEY: env.S3_SECRET_KEY,
    S3_FORCE_PATH_STYLE: env.S3_FORCE_PATH_STYLE,
  });
}
