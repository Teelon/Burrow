import type { AppType } from './types-app';
/**
 * Type-only export for Hono RPC clients.
 * This avoids type inference issues with the Worker entrypoint's default export.
 */
export type { AppType };
