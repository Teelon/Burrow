import { zValidator as honoZValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodSchema } from 'zod'

/**
 * Standard typed Zod validator that returns consistent error shapes:
 * { error: { code: 'validation_error', message: string } } with HTTP 400.
 */
export function zValidator<
  Target extends keyof ValidationTargets,
  Schema extends ZodSchema,
>(target: Target, schema: Schema) {
  return honoZValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      const path = issue?.path.join('.') || 'input'
      const message = issue ? `${path}: ${issue.message}` : 'Validation error'
      return c.json({ error: { code: 'validation_error', message } }, 400)
    }
  })
}
