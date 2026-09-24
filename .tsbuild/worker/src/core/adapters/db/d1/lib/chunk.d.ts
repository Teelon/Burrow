/**
 * D1 hard limit: at most 100 bound parameters per statement.
 * Any bulk write (link sync, tags, assignees, large IN (...) lists) must be
 * chunked BEFORE it goes into a db.batch() array. Routes and services must use
 * this helper instead of hand-rolling chunking.
 */
export declare const D1_MAX_BOUND_PARAMS = 100;
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
export declare function chunkByParamBudget<T>(items: readonly T[], paramsPerItem: number, fixedParams?: number, maxParams?: number): T[][];
/** Chunk a large IN (...) list; `fixedParams` covers the statement's other parameters. */
export declare function chunkInList<T>(values: readonly T[], fixedParams?: number): T[][];
