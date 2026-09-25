# Burrow

> _Dig in. Nest your notes._

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1_(SQLite)-F38020?logo=sqlite&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![BlockNote](https://img.shields.io/badge/Editor-BlockNote-7C3AED)](https://www.blocknotejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
- Cloudflare Wrangler CLI logged into your account (`pnpm exec wrangler login`)

### Setup & Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Configure local environment variables:**
   Copy the example environment file to create your git-ignored `.dev.vars` (or `.env`):
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   For local development, sensible defaults are already pre-filled. Note that:
   - `BETTER_AUTH_SECRET`: Can remain any 32+ character dummy string locally (e.g. `dev-secret-change-me-32-bytes-minimum!!`).
   - `BETTER_AUTH_URL`: Must match your local web origin (`http://localhost:5173`).
   - `BOOTSTRAP_TOKEN`: Used to claim the initial owner account (defaults to `dev-bootstrap-token`).
   - `D1_DATABASE_ID` and `CLOUDFLARE_ACCOUNT_ID`: Not needed for local dev (Miniflare handles SQLite locally).

3. **Run local migrations:**
   ```bash
   pnpm db:migrate:local
   ```

4. **Start local dev server:**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:5173](http://localhost:5173) and sign up as the initial owner account using the `BOOTSTRAP_TOKEN` defined in your `.dev.vars`.

> [!NOTE]
> The database starts completely clean (0 users, 0 workspaces). If you want demo mock data for testing, you can run `pnpm seed:local`. To wipe test data and return to a clean state at any time, run `pnpm run reset --local`.

---

## Deployment & Cloudflare Setup

Burrow deploys entirely on Cloudflare Workers, Cloudflare D1 (SQLite), and Cloudflare R2 using the Wrangler CLI.

> [!NOTE]
> **Use `pnpm run` for scripts**: `setup` and `deploy` are reserved built-in commands in the `pnpm` CLI (`pnpm setup` installs PATH binaries and `pnpm deploy` deploys monorepo workspaces). To run the project's scripts, always invoke them as **`pnpm run setup`** and **`pnpm run deploy`**.

### 1. Cloudflare Login & `workers.dev` Subdomain Setup

Before deploying to Cloudflare Workers for the first time, your Cloudflare account must have a registered `*.workers.dev` subdomain:

1. **Log in to Cloudflare Wrangler**:
   ```bash
   pnpm exec wrangler login
   ```
2. **Register your `workers.dev` subdomain**:
   - Navigate to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - Go to **Compute** > **Workers & Pages**.
   - On the right-hand panel under **Account details**, locate **Subdomain** (or click **Create application** > **Create Worker** to trigger the subdomain setup prompt).
   - Enter your preferred subdomain (e.g., `yourname.workers.dev`) and click **Save**.

### 2. First-Time Provisioning (`pnpm run setup`)

To automatically provision the remote D1 database, R2 bucket, upload secrets, run remote migrations, and deploy the worker:

```bash
pnpm run setup
```

> [!IMPORTANT]
> **Clean Setup Requirement**: Ensure `D1_DATABASE_ID` is blank (`D1_DATABASE_ID=`) in your `.dev.vars` or `.env` file before running setup. If an old ID remains (e.g. after a teardown), `pnpm run setup` will abort to prevent binding to non-existent databases.

Flags available:
- `--dry-run`: Print commands without running them.
- `--domain <domain>`: Deploy to a custom domain already configured on Cloudflare DNS.
- `--name <worker-name>`: Deploy under a custom Worker name.

Upon completion, `pnpm run setup` will output your deployed URL, your provisioned `D1_DATABASE_ID`, and a one-time `BOOTSTRAP_TOKEN`:
```text
======================================================
Setup complete!
  Production URL: https://burrow.<your-subdomain>.workers.dev
  D1_DATABASE_ID: <database-uuid>
  BOOTSTRAP_TOKEN: <one-time-token>
======================================================
```
Copy `D1_DATABASE_ID` and `BOOTSTRAP_TOKEN` into your `.env` or `.dev.vars` file for future deployments, then open your deployed URL to register your initial Owner account.

### 3. Subsequent Deployments (`pnpm run deploy`)

For all future releases and updates, run:

```bash
pnpm run deploy
```

This release pipeline automatically:
1. Executes the verification gate (`typecheck`, `check-basalt`, `eslint`, and all unit/API test suites).
2. Builds the production SPA bundle (`vite build`).
3. Captures a Cloudflare D1 Time Travel snapshot bookmark to `.deploy-log/rollbacks.log` as a safe rollback point.
4. Applies any pending remote D1 migrations (`migrations/`).
5. Deploys updated code and assets with `wrangler deploy`.
6. Executes a live `/api/health` smoke test.

### 4. Rollback Procedure

> [!IMPORTANT]
> **D1 Time Travel Backup Note**: Cloudflare D1's SQL dump export (`wrangler d1 export`) does not support databases containing SQLite FTS5 virtual tables (`notepads_fts`). Burrow relies on Cloudflare D1 **Time Travel** for continuous point-in-time recovery.

Every execution of `pnpm run deploy` records the active D1 Time Travel bookmark in `.deploy-log/rollbacks.log`. If a deployment introduces a regression:

1. Redeploy the previous Git release with `pnpm run deploy`.
2. Restore the remote D1 database to the recorded bookmark:
   ```bash
   wrangler d1 time-travel restore <db-name> --bookmark=<BOOKMARK_FROM_DEPLOY_LOG>
   ```
   *(Replace `<db-name>` with your database name, defaulting to `burrow` or whatever `--name` was configured).*

---

## Scripts

| Script                | Purpose                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`            | Vite dev server with local Worker and local D1 (Miniflare)                                                                    |
| `pnpm build`          | Production build of the React SPA to `dist/web`                                                                               |
| `pnpm check`          | Full local CI replacement: typecheck (`tsc -b`), Basalt CSS design guard, linting (`eslint`), and API tests (`vitest`)          |
| `pnpm check:data`     | Verifies that all 10 database invariants hold (`scripts/check-invariants.sql`) against local D1, or `--remote` for production |
| `pnpm run reset`      | Resets database back to clean initial default state: requires `--local` (no prompt) or `--remote` (requires confirmation)    |
| `pnpm run teardown`   | Permanently tears down all Burrow resources on Cloudflare (Worker, D1, R2) with confirmation prompt                          |
| `pnpm seed:local`     | (Optional developer demo only) Seeds local D1 database with sample workspace, projects, and Kanban cards                     |
| `pnpm run setup`      | First-time provision and deployment (`--dry-run` available)                                                                   |
| `pnpm run deploy`     | Production release: checks, builds, captures D1 Time Travel bookmark, applies remote migrations, and deploys                  |
| `pnpm logs`           | Streams live Worker logs via `wrangler tail`                                                                                  |

> **Basalt Design Guard (`check-basalt`)**: A fast repository linter (`scripts/check-basalt.mjs`) included in `pnpm check` that enforces design system integrity by prohibiting raw arbitrary Tailwind utility values and ensuring only curated Basalt semantic tokens are used.

---

## Security Model

- Session middleware automatically extracts user identity, workspace ID, and role (`owner`, `editor`, `viewer`).
- All queries strictly enforce `workspace_id` isolation.
- Mutating endpoints require `editor` or `owner` roles; viewers receive 403 on all mutating operations.
- Invite tokens are stored only as SHA-256 hashes and expire after 7 days.
- Content size is strictly validated and capped (1.5 MB limit per notepad), and D1 bound parameters are chunked under the 100-parameter threshold.
