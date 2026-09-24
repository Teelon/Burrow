# Burrow

> *Dig in. Nest your notes.*

A lightweight Notion-style workspace with **project separation**, **Kanban boards**, and **notepads** for taking and organising notes, plus a **slash-command menu (`/`)** and **mentions (`@`)** everywhere you type. Built to run entirely on Cloudflare Workers, Cloudflare D1 (SQLite), Cloudflare R2, and React SPA.

---

## Features

- **Project Separation**: Workspaces contain separate projects with instant switching, scoped notepads, boards, tags, and full-text search.
- **Nested Notepads**: Block-based rich text editor powered by BlockNote, with emoji icons, covers, drag-and-drop tree reordering, and single-flight autosave with optimistic concurrency.
- **Soft Edit Locks**: 60-second rolling locks with heartbeats on focus to prevent concurrent edit collisions, displaying read-only banners when occupied.
- **Kanban Boards**: Drag-and-drop columns and cards, priority tags, assignees, natural language due dates (`chrono-node`), and card bodies that are notepads.
- **Unified `/` Slash Menu**: Keyboard-driven slash menu available across notepads, card notes, and the Kanban smart quick-add input.
- **Mentions (`@`) & Tags (`#`)**: Inline mention chips for workspace members, notepads, cards, and natural dates, with automatic in-app notifications and backlinks indexing.
- **Smart Quick-Add**: Add cards with structured chips (`/notepad`, `/due`, `/priority`, `@assignee`, `#tag`) created atomically in single batch transactions.
- **Organization & Search**: FTS5 full-text search with highlight snippets, Command Palette (`Cmd/Ctrl+K`), Tag filtering, and a Trash view with subtree restore and permanent delete.

---

## Getting Started

### Prerequisites

- Node.js 20+
- `pnpm`
- Cloudflare Wrangler CLI logged into your account (`pnpm wrangler login`)

### Setup & Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Run local migrations:**
   ```bash
   pnpm db:migrate:local
   ```

3. **Seed demo data (two users, projects, boards, cards):**
   ```bash
   pnpm seed:local
   ```

4. **Start local dev server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Vite dev server with local Worker and local D1 (Miniflare) |
| `pnpm build` | Production build of the React SPA to `dist/web` |
| `pnpm check` | Full local CI replacement: runs typecheck (`tsc -b`), linting (`eslint`), and API tests (`vitest`) |
| `pnpm check:data` | Verifies that all 10 database invariants hold (`scripts/check-invariants.sql`) against local D1, or `--remote` for production |
| `pnpm seed:local` | Seeds demo workspace, projects, nested notepads, tags, and Kanban boards with cards |
| `pnpm setup` | First-time provision and deployment (`--dry-run` available) |
| `pnpm deploy` | Production release: checks, builds, captures D1 Time Travel bookmark, applies remote migrations, and deploys |
| `pnpm logs` | Streams live Worker logs via `wrangler tail` |

---

## Data Safety & Backups

> [!IMPORTANT]
> **D1 Time Travel Backup Note**: Cloudflare D1's SQL dump export (`wrangler d1 export`) does not support databases containing SQLite FTS5 virtual tables (`notepads_fts`). Burrow relies on Cloudflare D1 **Time Travel** for continuous point-in-time recovery.

- **Rollback Procedure**:
  Every execution of `pnpm deploy` records the active D1 Time Travel bookmark in `.deploy-log`. To roll back a release:
  1. Redeploy the previous Git release with `pnpm deploy`.
  2. Restore the remote D1 database to the recorded bookmark:
     ```bash
     wrangler d1 time-travel restore burrow --bookmark=<BOOKMARK_FROM_DEPLOY_LOG>
     ```

---

## Security Model

- Session middleware automatically extracts user identity, workspace ID, and role (`owner`, `editor`, `viewer`).
- All queries strictly enforce `workspace_id` isolation.
- Mutating endpoints require `editor` or `owner` roles; viewers receive 403 on all mutating operations.
- Invite tokens are stored only as SHA-256 hashes and expire after 7 days.
- Content size is strictly validated and capped (1.5 MB limit per notepad), and D1 bound parameters are chunked under the 100-parameter threshold.
