/**
 * D1 hard limit: at most 100 bound parameters per statement.
 * Any bulk write (link sync, tags, assignees, large IN (...) lists) must be
 * chunked BEFORE it goes into a db.batch() array. Routes and services must use
 * this helper instead of hand-rolling chunking.
 */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * Split `items` into chunks so each chunk's statement stays within the bound
 * parameter budget: `paramsPerItem * chunk.length + fixedParams <= maxParams`.
 *
 * @param items          rows (or values) to chunk
 * @param paramsPerItem  bound parameters each item contributes
 * @param fixedParams    parameters the statement uses regardless of item count
 *                       (e.g. a source id + a conditional fragment)
 * @throws if a single item cannot fit the budget
 */
export function chunkByParamBudget<T>(
  items: readonly T[],
  paramsPerItem: number,
  fixedParams = 0,
  maxParams: number = D1_MAX_BOUND_PARAMS,
): T[][] {
  if (!Number.isInteger(paramsPerItem) || paramsPerItem < 1) {
    throw new Error(`paramsPerItem must be a positive integer, got ${paramsPerItem}`);
  }
  if (fixedParams < 0) {
    throw new Error(`fixedParams must be >= 0, got ${fixedParams}`);
  }
  const available = maxParams - fixedParams;
  if (available < paramsPerItem) {
    throw new Error(
      `each item needs ${paramsPerItem} bound parameters but only ${available} are available ` +
        `(max ${maxParams}, fixed ${fixedParams})`,
    );
  }
  const perChunk = Math.floor(available / paramsPerItem);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += perChunk) {
    chunks.push(items.slice(i, i + perChunk) as T[]);
  }
  return chunks;
}

/** Chunk a large IN (...) list; `fixedParams` covers the statement's other parameters. */
export function chunkInList<T>(values: readonly T[], fixedParams = 0): T[][] {
  return chunkByParamBudget(values, 1, fixedParams);
}
