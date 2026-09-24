import { hc } from 'hono/client'
import type { AppType } from '../../worker/types-app'

/** Typed Hono RPC client. Same origin, so no CORS and no base URL games. */
export const api = hc<AppType>('/')
