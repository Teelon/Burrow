/**
 * Run every invariant query (I1–I10) from scripts/check-invariants.sql and
 * fail with the offending rows if any invariant is violated.
 *
 * Comment lines are stripped BEFORE splitting on ';' because comments may
 * themselves contain semicolons.
 */
export declare function expectInvariantsHold(db: D1Database): Promise<void>;
