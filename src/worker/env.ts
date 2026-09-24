export interface Env {
  Bindings: {
    DB: D1Database;
    FILES: R2Bucket;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    BOOTSTRAP_TOKEN: string;
  };
  Variables: {
    userId: string;
    workspaceId: string;
    role: 'owner' | 'editor' | 'viewer';
  };
}
