import { expect } from 'vitest'

import invariantSql from '../../scripts/check-invariants.sql?raw'

/**
 * Run every invariant query (I1–I10) from scripts/check-invariants.sql and
 * fail with the offending rows if any invariant is violated.
 *
 * Comment lines are stripped BEFORE splitting on ';' because comments may
 * themselves contain semicolons.
 */
export async function expectInvariantsHold(db: D1Database): Promise<void> {
  const statements = invariantSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  expect(statements.length).toBeGreaterThanOrEqual(10)

  const results = await db.batch<Record<string, unknown>>(
    statements.map((s) => db.prepare(s)),
  )

  for (const [i, result] of results.entries()) {
    const offending = result.results ?? []
    if (offending.length > 0) {
      throw new Error(
        `Invariant violated (query ${i + 1}): ${JSON.stringify(offending, null, 2)}`,
      )
    }
  }
}
