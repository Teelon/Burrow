import { describe, expect, it } from 'vitest'

import { chunkByParamBudget, chunkInList } from '../../src/worker/lib/chunk'

describe('chunkByParamBudget', () => {
  it('returns a single chunk when under the budget', () => {
    expect(chunkByParamBudget([1, 2, 3], 1, 0, 4)).toEqual([[1, 2, 3]])
  })

  it('returns a single chunk exactly at the budget', () => {
    expect(chunkByParamBudget([1, 2, 3], 1, 0, 3)).toEqual([[1, 2, 3]])
  })

  it('splits when one over the budget', () => {
    expect(chunkByParamBudget([1, 2, 3, 4], 1, 0, 3)).toEqual([[1, 2, 3], [4]])
  })

  it('returns no chunks for an empty list', () => {
    expect(chunkByParamBudget([], 10, 0)).toEqual([])
  })

  it('accounts for the base parameter count', () => {
    // maxParams 4 with base 1 => 3 items per chunk.
    expect(chunkByParamBudget([1, 2, 3, 4, 5, 6, 7], 1, 1, 4)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7],
    ])
  })

  it('packs one item per chunk when only one fits per statement', () => {
    // max 3, 2 params per item => 1 item per chunk.
    expect(chunkByParamBudget([1, 2], 2, 0, 3)).toEqual([[1], [2]])
  })

  it('throws when a single item cannot fit the budget', () => {
    // max 3 but each item needs 4 params.
    expect(() => chunkByParamBudget([1, 2], 4, 0, 3)).toThrow()
  })
})

describe('chunkInList', () => {
  it('chunks values within the D1 100-parameter limit', () => {
    const values = Array.from({ length: 250 }, (_, i) => `v${i}`)
    const chunks = chunkInList(values, 1) // 1 base param (workspace filter)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks) {
      expect(c.length + 1).toBeLessThanOrEqual(100)
    }
    expect(chunks.flat()).toEqual(values)
  })

  it('keeps a small list in one chunk', () => {
    expect(chunkInList(['a', 'b'], 1)).toEqual([['a', 'b']])
  })
})
