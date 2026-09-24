import { zValidator as honoZValidator } from '@hono/zod-validator'

// Re-export the proper Hono zValidator which correctly types the context
export const zValidator = honoZValidator