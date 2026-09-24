# Architectural Decisions

- **One workspace per user (v1)**: A user belongs to exactly one workspace in v1 to keep authorization models boring, scoped, and leak-free.
- **Resource provisioning path**: Wrangler auto-provisioning verified on Wrangler 4.137+ with manual fallback in setup script for reliability.
- **Raw SQL for FTS5**: SQLite FTS5 virtual tables (`notepads_fts`) are managed through raw SQL in migrations and Drizzle `sql` literals, excluded from `drizzle-kit` via `tablesFilter`.
- **Soft edit locks**: 60-second rolling TTL with 30-second client heartbeats on editor focus; atomic claim upsert gated on expiration or same caller identity.
- **D1 Parameter chunking**: Universal parameter budget chunker (`src/worker/lib/chunk.ts`) enforces max 100 bound parameters per query statement across all batch and `IN (...)` queries.
- **Card title storage**: Card title is stored directly in `notepads.title` (Invariant I1 & schema design), synchronized to FTS on every card update.
- **Card notepad deletion on permanent delete of board**: Since `cards.notepad_id` references `notepads(id) ON DELETE CASCADE` but not vice versa, `permanentDeleteBoard` explicitly collects and deletes all card `notepads` and their `notepads_fts` rows to preserve Invariant I1 & I7.
- **Suggest endpoint scoping**: `/api/suggest` queries are strictly scoped by `workspace_id` (and `project_id` where applicable) returning at most 8 items to ensure sub-50ms keystroke responses without N+1 query overhead.
- **FTS snippet search**: `/api/search` uses FTS5 `snippet()` with automatic best-matching column selection (`col_idx = -1`) and sanitized prefix matching (`word*`) across title and body.
- **Editor code splitting**: BlockNote editor and custom block schemas are code-split into a separate chunk via `React.lazy` across both `NotepadView` and `CardPanel`, keeping the initial application bundle at 174 KB gzipped.
- **Client lock release and blur flushing**: The client flushes any debounced autosave state immediately before sending the lock release request on blur or unmount.
