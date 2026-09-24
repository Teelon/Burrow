# Architectural Decisions

- **One workspace per user (v1)**: A user belongs to exactly one workspace in v1 to keep authorization models boring, scoped, and leak-free.
- **Resource provisioning path**: Wrangler auto-provisioning verified on Wrangler 4.137+ with manual fallback in setup script for reliability.
- **Raw SQL for FTS5**: SQLite FTS5 virtual tables (`notepads_fts`) are managed through raw SQL in migrations and Drizzle `sql` literals, excluded from `drizzle-kit` via `tablesFilter`.
- **Soft edit locks**: 60-second rolling TTL with 30-second client heartbeats on editor focus; atomic claim upsert gated on expiration or same caller identity.
- **D1 Parameter chunking**: Universal parameter budget chunker (`src/worker/lib/chunk.ts`) enforces max 100 bound parameters per query statement across all batch and `IN (...)` queries.
