-- Hand-written migration: FTS5 virtual table (Drizzle does not manage virtual tables).
-- Excluded from drizzle-kit via tablesFilter in drizzle.config.ts.
-- All inserts/deletes against this table use Drizzle's raw sql helper.
CREATE VIRTUAL TABLE notepads_fts USING fts5(
  notepad_id UNINDEXED,
  project_id UNINDEXED,
  title,
  body
);
