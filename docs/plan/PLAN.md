# Burrow: Build Plan for the Coding Agent

> *Dig in. Nest your notes.*

A lightweight Notion-style workspace with **project separation**, **Kanban boards**, and **notepads** for taking and organising notes, plus a **slash-command menu (`/`)** and **mentions (`@`)** everywhere you type. It runs entirely on Cloudflare (Workers + D1).

---

## 0. Agent operating rules

1. Work through the phases in order. Do not start a phase until the previous phase's acceptance criteria pass.
2. Commit after every task using Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`).
3. If a requirement is ambiguous, choose the simpler option, record it in `DECISIONS.md` (one line: decision, reason), and keep going. Only stop if you are truly blocked.
4. Do not add dependencies beyond those listed in this plan without recording why in `DECISIONS.md`.
5. Never hardcode secrets. Use `.dev.vars` locally and `wrangler secret put` in production. Commit a `.dev.vars.example`.
6. Every phase must leave the app runnable with `pnpm dev` and deployable with `pnpm deploy`.
7. Every API route validates input with zod and checks workspace membership and role (see section 7).
8. Keep the codebase small. Prefer deleting code over adding abstractions.
9. **Terminology is fixed.** The user-facing and code term is **notepad** (never "page"). Use `notepad` in table names, routes, types, component names, copy and tests.
10. **This plan fixes product behavior, data integrity, security and acceptance criteria. It does not fix internal implementation details.** File names, object shapes, component boundaries and exact route shapes may change when reality demands it, provided behavior, security, data integrity and the acceptance criteria stay intact. Record meaningful deviations in `DECISIONS.md`; do not contort the implementation to match an illustrative shape.
11. **Security and validation are built in every phase, not at the end.** Each route ships with zod validation, session + role + workspace checks, body-size limits, the standard error format and negative-case tests. A phase is not done without them.
12. **Services own invariants.** Routes are thin; all writes to notepads, cards, boards and projects go through `src/worker/services/` (section 6.1).
13. **Migrations are backward-compatible (expand, then contract).** A migration must work with the code currently in production, because `pnpm deploy` migrates before it uploads code. Add columns and tables first; ship the code that uses them; remove old columns in a later release. Never rename or drop something in the same release that stops using it.
14. **Deployment is by Wrangler CLI from the user's machine only.** Do not add GitHub Actions or any CI/CD deploy pipeline (see section 5).

---

## 1. Product summary

| Concept | Meaning |
|---|---|
| **Workspace** | Top-level container. One or more members with roles (owner, editor, viewer). |
| **Project** | A separated area of work. Notepads, boards, tags and search are all scoped to one project. |
| **Notepad** | A rich-text note (block editor). Notepads nest in a tree, can be favorited, tagged, trashed and searched. |
| **Board** | A Kanban board inside a project, made of columns. |
| **Card** | A task on a board. Each card has its own body, which is a notepad of kind `card`, so it can hold detailed notes, checklists and images. |
| **Slash menu (`/`)** | Command menu in every editor and in the card quick-add input. |
| **Mention (`@`)** | Inline reference to a person, notepad, card or date. Mentioned people get a notification. |
| **Tag (`#`)** | Coloured label scoped to a project. |

### In scope for v1
- Sign in, workspace bootstrap, **invite-based multi-user** (owner, editor, viewer)
- Create, rename, reorder, archive and delete projects; instant switching
- Nested notepads with a block editor, autosave, icons, covers, drag-reorder in the sidebar
- Soft edit locks on notepads to prevent concurrent-editing conflicts (not real-time collaboration)
- Multiple Kanban boards per project: columns, cards, drag-and-drop, priority, due date, assignees, tags
- **Slash menu** with power commands (`/notepad`, `/task`, `/due`, `/assign`, ...) in notepads, card bodies and the card quick-add input
- **`@` mentions** of people, notepads, cards and dates; **`#` tags**; backlinks; in-app notifications
- Organization: tags, favorites, trash with restore, full-text search, command palette (Cmd/Ctrl+K), recent notepads
- Responsive layout, light/dark theme

### Out of scope for v1 (see section 14)
Real-time collaboration, comments, public sharing, database/table views, offline mode, native mobile apps, email notifications, per-project permissions.

---

## 2. Stack

| Layer | Choice |
|---|---|
| Runtime and API | Cloudflare Workers, **Hono**, TypeScript (strict) |
| Database | **Cloudflare D1** (SQLite), **Drizzle ORM**, migrations via `wrangler d1 migrations` |
| Frontend | **React + Vite**, **TanStack Router**, **TanStack Query**, served from the same Worker via Workers Static Assets |
| UI | Tailwind CSS + shadcn/ui, `lucide-react` icons, `cmdk` for the command palette and quick-add menu |
| Drag and drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Editor | **BlockNote** (`@blocknote/core`, `@blocknote/react`, `@blocknote/shadcn`) with custom blocks, custom inline content and custom suggestion menus |
| Natural dates | `chrono-node` (for `/due tomorrow`, `@friday`) |
| Ordering | `fractional-indexing` |
| IDs | `nanoid` as text primary keys |
| Auth | **Better Auth** with the Drizzle/D1 adapter |
| Files | **R2** (images, covers) |
| Validation | `zod` + `@hono/zod-validator`; share types with the client via Hono RPC (`hc`) |
| Tests | Vitest + `@cloudflare/vitest-pool-workers` (API), Playwright (e2e) |
| Tooling | pnpm, ESLint, Prettier, Wrangler CLI (deploys run from your machine; no CI/CD pipeline) |

---

## 3. Architecture

```
Browser (React SPA)
   |  fetch (same origin)
   v
Cloudflare Worker  (Hono)
   |-- /api/*     -> routes -> Drizzle -> D1
   |-- /api/files -> R2
   `-- everything else -> static assets (SPA fallback to index.html)
```

Principles:
- **One deployable.** The Worker serves both the API and the built SPA, so there is no CORS and only one domain.
- **A notepad is one JSON document** (BlockNote's block array stored as text), not one row per block. Autosave is a single update.
- **References are derived from content.** Mentions and links live inside the JSON; on every save the server extracts them into the `notepad_links` table (for backlinks and notifications). Content is the source of truth, the table is an index.
- **Server owns ordering.** The client sends "place X after Y" and the server computes the fractional index.
- **Soft delete by default.** `deleted_at` on notepads and boards. Permanent delete only from Trash.
- **D1 has no interactive transactions.** Use `db.batch([...])` for multi-statement atomic writes.
- **Scoping is enforced in one place.** Session middleware resolves `userId`, `workspaceId` and `role`. Every query filters by `workspace_id` and, where relevant, `project_id`.
- **One workspace per user in v1.** A user belongs to exactly one workspace (record in `DECISIONS.md`).
- **Authorization stays boring.** Three helpers only: `requireSession()`, `requireRole(min)`, and workspace-scoped resource loaders. No policy engine or generic ability framework.
- **Services own data integrity.** All writes to notepads, cards, boards and projects go through service functions that maintain the invariants in section 6.1; a check script verifies them.
- **Soft edit locks.** To prevent a constant cascade of 409 conflict errors from the 800 ms autosave, implement a soft edit lock. When a user begins editing a notepad, the client claims a 60-second rolling lock via an API heartbeat. If a second user opens the notepad, their editor renders read-only with a banner stating "Alex is editing this notepad" until the lock expires or is explicitly released on blur. The lock is a UX layer on top of version gating, never a replacement for it: `baseVersion` checks stay mandatory, and a version 409 remains possible and handled (details in section 6, "Edit lock rules").
- **Raw SQL for FTS.** Drizzle ORM does not natively understand SQLite FTS5 virtual tables. Do not define `notepads_fts` as a Drizzle table. All FTS deletes and inserts inside a `db.batch()` are written with Drizzle's raw `sql` template literal. Exclude `notepads_fts` and its FTS5 shadow tables (`notepads_fts_data`, `_idx`, `_content`, `_docsize`, `_config`) from drizzle-kit via `tablesFilter` in `drizzle.config.ts` so generated migrations never touch them.
- **Parameter chunking.** Cloudflare D1 allows at most 100 bound parameters per query. Any bulk write (for example syncing `notepad_links`, or applying many tags) must be chunked in application logic so no single statement exceeds the limit before it is added to the `db.batch()` array. Use one shared helper (see Phase 3) that takes the columns per row and any fixed parameters in the statement, and never hand-roll chunking in a route. The same applies to large `IN (...)` lists. (Passing one JSON array parameter into `json_each(?)` is an acceptable alternative for a specific statement if it is simpler, recorded in `DECISIONS.md`.)

---

## 4. Repository layout

```
burrow/
  PLAN.md
  DECISIONS.md
  package.json
  wrangler.jsonc
  drizzle.config.ts
  migrations/                D1 SQL migrations (generated + hand-written FTS)
  src/
    shared/
      blocks.ts              Block/inline schema names + TypeScript types (mention, notepadLink, cardLink)
      extract.ts             Extract plain text, mentions and links from BlockNote JSON
      slash.ts               Slash command registry (id, label, aliases, contexts, action type)
    worker/
      index.ts               Hono app entry, mounts routes, static assets fallback
      auth.ts                Better Auth setup
      db/schema.ts           Drizzle schema (source of truth)
      db/client.ts
      services/              notepads.ts cards.ts boards.ts projects.ts members.ts (the only writers; section 6.1)
      lib/ordering.ts        fractional index helpers
      lib/search.ts          FTS index update + query
      lib/tree.ts            descendant lookup, cycle check, subtree soft delete
      lib/links.ts           sync notepad_links + create notifications on save
      middleware/session.ts  session, workspace, role guards
      routes/                projects notepads boards columns cards tags search suggest members invites notifications files
    web/
      main.tsx
      routes/                TanStack Router file routes
      editor/                BlockNote config: custom blocks, mention chip, slash menu, @ menu, # menu
      components/            Sidebar, NotepadTree, BoardView, CardPanel, QuickAddCard, CommandPalette, NotificationsBell, ...
      lib/api.ts             typed Hono client
      lib/queries.ts         TanStack Query hooks
  tests/
    api/                     Vitest worker-pool tests
    e2e/                     Playwright specs
  scripts/
    setup.mjs                First-time provision + deploy (section 5)
    deploy.mjs               Release: check, build, bookmark, migrate, deploy
    check-invariants.sql     One query per invariant in section 6.1
```

---

## 5. Configuration and one-command deployment

Deployment happens **from your own machine with the Wrangler CLI**. There is no GitHub Actions or other CI/CD pipeline. Two commands do everything: **`pnpm setup`** the first time, and **`pnpm deploy`** for every release after that.

### `wrangler.jsonc`

Bindings are declared **without resource IDs** so Wrangler can create them for you:

```jsonc
{
  "name": "burrow",
  "main": "src/worker/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist/web",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "burrow", "migrations_dir": "migrations" }
  ],
  "r2_buckets": [
    { "binding": "FILES", "bucket_name": "burrow-files" }
  ]
}
```

Wrangler 4.45 and later can auto-provision missing D1 databases and R2 buckets during `wrangler deploy`. **Verify this on the installed Wrangler version first.** If it works, use it. If it does not, the setup script must create the resources explicitly (`wrangler d1 create burrow` and `wrangler r2 bucket create burrow-files`, skipping either if it already exists, and looking up the D1 id with `wrangler d1 list --json`) and write the D1 `database_id` into `wrangler.jsonc`. Record which path was used in `DECISIONS.md`.

### Secrets

Set by the setup script, never committed:

| Secret | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Random 32 bytes. Generated once and never rotated by re-running setup (rotating logs everyone out). |
| `BETTER_AUTH_URL` | The deployed origin (workers.dev URL or custom domain). |
| `BOOTSTRAP_TOKEN` | One-time code required for the very first sign-up, so nobody else can claim the owner account in the gap between deploy and your first sign-up. |

Local values live in `.dev.vars` (git-ignored); commit `.dev.vars.example`.

### `pnpm setup` (first time, one command, idempotent)

1. **Preflight:** Node 20+; `pnpm install`; check `wrangler whoami`, and if not logged in run `wrangler login` (opens the browser). If the login has several Cloudflare accounts and `CLOUDFLARE_ACCOUNT_ID` is unset, list them and ask which to use.
2. Typecheck and build the SPA.
3. `wrangler deploy` (creates the Worker, plus D1 and R2 if auto-provisioning is used); capture the deployed URL from the output.
4. Apply migrations to the remote D1 database.
5. Generate secrets and upload them with `wrangler secret bulk`. Skip any that already exist (`wrangler secret list`).
6. Smoke test `GET <url>/api/health`.
7. Print the URL and the `BOOTSTRAP_TOKEN` (shown once), and tell the user to open the URL and create the owner account.

Flags: `--dry-run` (print every command without running it), `--domain notes.example.com` (adds a custom-domain route; the domain must be on Cloudflare DNS in the same account), `--name <worker-name>`.

### `pnpm deploy` (every release)

1. `pnpm check` (typecheck, lint, tests); abort on failure.
2. Build.
3. Record the current D1 **Time Travel bookmark** (`wrangler d1 time-travel info`) in `.deploy-log` as a rollback point.
4. Apply pending migrations to the remote database **before** uploading code. This is safe only because migrations are backward-compatible (agent rule 13).
5. `wrangler deploy`.
6. Smoke test `/api/health` and print the URL.

### Scripts

| Script | Purpose |
|---|---|
| `dev` | Vite dev server plus local Worker with local D1 (Miniflare) |
| `build` | Build the SPA to `dist/web` |
| `setup` | First-time provision and deploy (above) |
| `deploy` | Release (above) |
| `check` | Typecheck, lint and API tests (the local replacement for CI) |
| `check:data` | Run the invariant queries (section 6.1) against local D1, or `--remote` for production |
| `db:generate` | `drizzle-kit generate` |
| `db:migrate:local` / `db:migrate:remote` | Apply migrations to local / remote D1 |
| `seed:local` | Demo data |
| `test`, `e2e` | Vitest, Playwright |
| `logs` | `wrangler tail` |

---

## 6. Data model

Timestamps are integer Unix milliseconds. IDs are text. The Drizzle schema in `src/worker/db/schema.ts` is the source of truth. Better Auth tables (`user`, `session`, `account`, `verification`) are generated by its CLI and included in the first migration.

```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE,                 -- one workspace per user in v1
  role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
  token_hash TEXT NOT NULL UNIQUE,              -- store a hash, never the raw token
  invited_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  accepted_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  position TEXT NOT NULL,
  archived_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX projects_ws ON projects(workspace_id, position);

CREATE TABLE notepads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES notepads(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'notepad' CHECK (kind IN ('notepad','card')),
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT,
  cover_key TEXT,                      -- R2 object key
  content TEXT NOT NULL DEFAULT '[]',  -- BlockNote JSON
  version INTEGER NOT NULL DEFAULT 1,  -- optimistic concurrency
  position TEXT NOT NULL,
  is_favorite INTEGER NOT NULL DEFAULT 0,   -- per-workspace in v1
  deleted_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX notepads_tree ON notepads(project_id, parent_id, position) WHERE deleted_at IS NULL;
CREATE INDEX notepads_deleted ON notepads(project_id, deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  position TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE board_columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  position TEXT NOT NULL
);
CREATE INDEX columns_board ON board_columns(board_id, position);

CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
  notepad_id TEXT NOT NULL UNIQUE REFERENCES notepads(id) ON DELETE CASCADE,  -- notepads.kind = 'card'
  position TEXT NOT NULL,
  priority TEXT CHECK (priority IN ('low','medium','high','urgent')),
  due_date INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX cards_column ON cards(column_id, position);

CREATE TABLE card_assignees (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  PRIMARY KEY (card_id, user_id)
);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  UNIQUE (project_id, name)
);

CREATE TABLE notepad_tags (
  notepad_id TEXT NOT NULL REFERENCES notepads(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (notepad_id, tag_id)
);

-- Index of references found inside notepad content (backlinks, notification diffing)
CREATE TABLE notepad_links (
  source_id TEXT NOT NULL REFERENCES notepads(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('user','notepad','card','board')),
  target_id TEXT NOT NULL,
  PRIMARY KEY (source_id, target_type, target_id)
);
CREATE INDEX links_target ON notepad_links(target_type, target_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,                        -- recipient
  type TEXT NOT NULL CHECK (type IN ('mention','assigned')),
  actor_id TEXT NOT NULL,
  notepad_id TEXT REFERENCES notepads(id) ON DELETE CASCADE,
  card_id TEXT REFERENCES cards(id) ON DELETE CASCADE,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX notifications_user ON notifications(user_id, read_at, created_at);

CREATE TABLE edit_locks (
  notepad_id TEXT PRIMARY KEY REFERENCES notepads(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,          -- random per editor instance (tab), so one user's second tab counts as another editor
  expires_at INTEGER NOT NULL
);

-- Hand-written migration (Drizzle does not manage virtual tables):
CREATE VIRTUAL TABLE notepads_fts USING fts5(
  notepad_id UNINDEXED, project_id UNINDEXED, title, body
);
```

Rules:
- **Cards own a notepad.** Creating a card also creates a `notepads` row with `kind='card'` in the same `db.batch`. Card notepads never appear in the sidebar notepad tree; they open in a panel on the board and are reachable via search.
- **Card title lives in `notepads.title`.** There is no separate card title column.
- **Deleting a card** soft-deletes the card's notepad and the card together (they always share deleted state). Board queries join notepads with `deleted_at IS NULL`.
- **Soft-deleting a notepad** sets the same `deleted_at` timestamp on it and all descendants. **Restore** clears exactly the rows sharing that timestamp. If the restored notepad's parent is still deleted, restore re-attaches it at the project root.
- **Max nesting depth: 8.** Reject deeper moves and creates.
- **Cycle prevention:** moving a notepad under its own descendant is rejected.
- **Content size cap:** reject `content` larger than 1.5 MB (D1 rows are limited to about 2 MB).
- **Content save is one atomic, version-gated batch.** The notepad `UPDATE ... WHERE id = ? AND version = ?` and every dependent statement (FTS row, link sync, notifications) must take effect only if that update matched, for example by making the dependent statements conditional on the new version value existing. A stale save must change nothing anywhere, including FTS and notifications. Test this.
- **FTS maintenance:** on every content or title save, delete and re-insert the notepad's row in `notepads_fts` using plain text extracted from the block JSON, inside the same batch as the save. Exclude soft-deleted notepads from search. FTS must never be allowed to silently diverge from content.
- **Link sync on save (Phase 5C):** extract mentions and links from the new content, diff against `notepad_links` for that source, insert added rows and delete removed rows. For every **newly added** `user` mention (excluding the author), create a `mention` notification. Removing a mention never notifies. Re-saving without adding a mention never re-notifies.
- **Assigning a card (Phase 5C)** creates an `assigned` notification for each newly added assignee (excluding the actor).
- D1's SQL export does not support databases containing virtual tables. Rely on D1 Time Travel for backups and note this in the README.

### Edit lock rules

- **Rolling 60-second lock.** The client claims the lock when the editor gains focus (or on the first change if the focus event was missed) and refreshes it with a heartbeat every 30 seconds while the editor stays focused. Expiry is always computed and compared with **server time**, never the client's clock.
- **Atomic claim.** Claiming or refreshing is a single atomic statement (for example an upsert whose update branch only applies when the existing row is expired, or belongs to the same `user_id` and `client_id`), followed by a check that the row is now yours. Two users claiming at once must never both succeed. Test this.
- **Holder identity is user + client.** The same user in a second tab is treated as another editor and gets the read-only banner.
- **Response shape.** A successful claim returns `{ expiresAt }`. A refused claim returns `409` with `{ code: 'locked', holder: { userId, name }, expiresAt }` so the banner can name the holder. Version conflicts use a different code, `version_conflict`.
- **Saves respect live locks.** `PUT /api/notepads/:id/content` from anyone other than the current holder is refused with `409 locked` while another editor's lock is live, so a modified client cannot bypass the banner. If no live lock exists, a save is allowed (it does not implicitly claim), and the version gate remains the safety net.
- **Release.** `DELETE` releases only a lock held by the caller. The client **flushes any pending autosave first**, then releases on blur, route change or unmount; on tab close it uses a `keepalive` fetch. If a release is missed, the 60-second expiry frees the lock. Never block on release.
- **Read-only side.** When locked by someone else, the editor is read-only with a "Locked by [Name]" banner and re-checks lock status every 10 to 15 seconds (the lock state is returned by `GET /api/notepads/:id`). When it frees up the banner changes to "Now available" and the user chooses to start editing; never auto-claim.
- **Roles and scope.** Viewers never claim locks. Locks apply to all notepads, including card notepads. Expired rows are ignored and overwritten lazily on the next claim; no cron cleanup is needed. Permanent delete cascades locks.

### 6.1 Invariants and services

These must hold at all times. They are enforced by **service functions**, and a check script verifies them.

| # | Invariant |
|---|---|
| I1 | Every `cards.notepad_id` points to a notepad with `kind = 'card'`, and every `kind = 'card'` notepad has exactly one card. |
| I2 | A card notepad has `parent_id IS NULL` (it is never part of the notepad tree). |
| I3 | A card's board, its column's board, and its notepad all belong to the same project. |
| I4 | A notepad and its parent belong to the same project; every row's `workspace_id` matches its project's. |
| I5 | A card and its notepad always have the same soft-delete state (`deleted_at` equal). |
| I6 | A non-deleted notepad has no deleted ancestors, unless it was trashed on its own (its own `deleted_at` is set). |
| I7 | Every non-deleted notepad has exactly one `notepads_fts` row; no FTS row exists for a deleted or missing notepad. |
| I8 | `notepad_links.source_id` always references an existing notepad. Target existence is **not** required: targets of type user, notepad, card or board may be deleted or missing and must render gracefully. Link rows are only ever written for targets in the caller's workspace. |
| I9 | Every `notepad_tags` row (including tags on card notepads) references a tag whose `project_id` equals the notepad's `project_id`. |
| I10 | Every `card_assignees.user_id` is a current member of the card's workspace. Removing a member deletes that member's `card_assignees` rows in the same batch. |

---

## 7. API

All routes are under `/api`, return JSON, and require a session except `/api/auth/*` and invite acceptance. `workspaceId` and `role` come from the session, never from the request. Every resource lookup must confirm it belongs to the caller's workspace and return 404 (not 403) otherwise. **Mutating routes require role `editor` or `owner`**; member and invite management requires `owner`. Viewers are read-only.

---

## 8. The `/` slash menu

Typing `/` in any editor opens a searchable, keyboard-navigable menu (arrow keys, Enter, Esc; fuzzy match on label and aliases). Commands are defined once in `src/shared/slash.ts` as `{ id, label, aliases[], group, contexts[], run }`, and each surface filters by its context.

---

## 9. Frontend

Routes:
- `/login`
- `/invite/:token`
- `/` -> redirects to last project
- `/p/:projectId` -> project home (recent notepads, boards list)
- `/p/:projectId/notepads/:notepadId` -> notepad editor
- `/p/:projectId/boards/:boardId` -> Kanban board
- `/p/:projectId/trash`
- `/settings` -> profile, theme
- `/settings/members` -> members and invites (owner only)

---

## 10. Phases (0 through 8)

Refer to full specification in implementation plan for each phase's tasks and acceptance criteria.
