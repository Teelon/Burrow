export interface Env {
  Bindings: {
    DB: D1Database;
    FILES: R2Bucket;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BOOTSTRAP_TOKEN: string;
    LOCAL_STORAGE_PATH?: string;
    S3_ENDPOINT?: string;
    S3_REGION?: string;
    S3_BUCKET?: string;
    S3_ACCESS_KEY?: string;
    S3_SECRET_KEY?: string;
    S3_FORCE_PATH_STYLE?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
  };
  Variables: {
    userId: string;
    workspaceId: string;
    role: 'owner' | 'editor' | 'viewer';
  };
}
