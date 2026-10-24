# Burrow

> _Dig in. Nest your notes._

[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](<https://img.shields.io/badge/Cloudflare-D1_(SQLite)-F38020?logo=sqlite&logoColor=white>)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![BlockNote](https://img.shields.io/badge/Editor-BlockNote-7C3AED)](https://www.blocknotejs.org/)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)

A lightweight Notion-style workspace with **project separation**, **Kanban boards**, and **notepads** for taking and organising notes, plus a **slash-command menu (`/`)** and **mentions (`@`)** everywhere you type.

Built with **Hono** as the core web framework. Currently optimized to run serverless on Cloudflare Workers, Cloudflare D1 (SQLite), Cloudflare R2, and React SPA, with an adapter-driven foundation already laid for standalone Node.js and PostgreSQL self-hosting.

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
- **Adapter-Driven Architecture**: Decoupled core business logic from platform runtimes. Pluggable adapters handle storage (R2/S3/local disk), search (SQLite FTS5/PostgreSQL tsvector), locks, and transactional email.

---

## Architecture & Portability

Burrow follows an adapter-driven (hexagonal) architecture where core business logic interacts strictly through unified interfaces:

- **Cloudflare (Current Primary Target):** Production builds run natively on Cloudflare Workers, D1 (distributed SQLite), R2 (object storage), and Worker static assets for SPA delivery.
- **Node.js & PostgreSQL (Groundwork Laid):** Concrete adapter implementations for PostgreSQL (`src/core/adapters/db/postgres/`) and filesystem/S3 storage already exist. The app factory (`createCoreApp`) compiles identically for Node (`src/server/index.ts`), paving the way for containerized Docker deployments.
- **Pluggable Transactional Email:** Email sending is completely abstract (`IEmailProvider` in `src/core/adapters/email.ts`). It is wired for **Resend** by default (with a zero-config local console fallback), but swapping to Postmark, Amazon SES, SendGrid, or custom SMTP only requires writing a single adapter file—zero core app or route changes needed.

---

## Getting Started

### Prerequisites

- Node.js 20+
- `pnpm`
- Cloudflare Wrangler CLI logged into your account (`pnpm exec wrangler login`)

### Local Development (One-Command Setup)

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Start local dev server:**
   ```bash
   pnpm dev
   ```
   `pnpm dev` is a complete one-command local setup:
   - Automatically applies all pending local D1 migrations (`migrations/`).
   - Injects sensible local development defaults in memory without writing to `.env` or `.dev.vars`.
   - Prints your active local URLs and `BOOTSTRAP_TOKEN` directly to the console:
     ```text
     ======================================================
     Burrow Local Development
       Web App (Vite):     http://localhost:3005
       Worker API:         http://127.0.0.1:8787
       BOOTSTRAP_TOKEN:    dev-bootstrap-token
       Email Delivery:     Console log fallback
     ======================================================
     ```
   - Open [http://localhost:3005](http://localhost:3005) and sign up as the initial owner account using the `BOOTSTRAP_TOKEN` printed in your terminal.

> [!NOTE]
> The database starts completely clean (0 users, 0 workspaces). If you want demo mock data for testing, run `pnpm seed`. To wipe test data and return to a clean state at any time, run `pnpm run reset`. (Both target your local Miniflare database by default).

---

## Deployment & Cloudflare Setup

Burrow deploys entirely on Cloudflare Workers, Cloudflare D1 (SQLite), and Cloudflare R2 using the Wrangler CLI. All scripts auto-discover remote resources and output generated credentials directly to the console—no `.env` or `.dev.vars` files are written or required.

> [!NOTE]
> **Use `pnpm run` for scripts**: `setup` and `deploy` are reserved built-in commands in the `pnpm` CLI (`pnpm setup` installs PATH binaries and `pnpm deploy` deploys monorepo workspaces). To run the project's scripts, always invoke them as **`pnpm run setup`** and **`pnpm run deploy`**.

### 1. Cloudflare Login & `workers.dev` Subdomain Setup

Before deploying to Cloudflare Workers for the first time, your Cloudflare account must have a registered `*.workers.dev` subdomain:

1. **Log in to Cloudflare Wrangler** (or let `pnpm run setup` prompt you automatically):
   ```bash
   pnpm exec wrangler login
   ```
2. **Register your `workers.dev` subdomain**:
   - Navigate to the [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - Go to **Compute** > **Workers & Pages**.
   - On the right-hand panel under **Account details**, locate **Subdomain** (or click **Create application** > **Create Worker** to trigger the subdomain setup prompt).
   - Enter your preferred subdomain (e.g., `yourname.workers.dev`) and click **Save**.

### 2. One-Command Provisioning & Deployment (`pnpm run setup -r`)

To automatically provision or discover your remote Cloudflare D1 database and R2 bucket, apply remote migrations, build, deploy the Worker, upload secrets, and run a live health check in a single command:

```bash
pnpm run setup -r
```

Flags available:

- `-r`, `--remote`: Target remote Cloudflare production (required to provision remote infrastructure).
- `--dry-run`: Print every command without executing it.
- `--domain <domain>`: Deploy to a custom domain already configured on Cloudflare DNS.
- `--name <worker-name>`: Deploy under a custom Worker name.

Upon completion, `pnpm run setup` outputs all URLs, resource IDs, and generated secrets directly to the console (nothing is written to `.env` or `.dev.vars`):

```text
======================================================
Setup complete! (All values output to console only)
  Production URL:     https://burrow.<your-subdomain>.workers.dev
  D1 Database:        burrow (<database-uuid>)
  R2 Bucket:          burrow-files
  BETTER_AUTH_URL:    https://burrow.<your-subdomain>.workers.dev
  BETTER_AUTH_SECRET: <generated-secret>
  BOOTSTRAP_TOKEN:    <one-time-token>
======================================================
```

Open the Production URL and register your initial Owner account using the `BOOTSTRAP_TOKEN` printed in the console.

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

### 4. Transactional Email Setup (Resend & Pluggable Providers)

Burrow features a provider-agnostic email adapter architecture (`src/core/adapters/email.ts`). While wired for **Resend** by default (with native `fetch` and zero SDK bloat), swapping or adding new providers (such as Postmark, Amazon SES, SendGrid, or custom SMTP) only requires implementing `IEmailProvider` and registering it in the factory—no route handlers or business logic ever touch provider-specific code:

- **Zero-config fallback:** If `RESEND_API_KEY` is not set, invites log to the terminal console (`[email:console]`) and remain instantly shareable via the 1-click **Copy Link** button in the UI.
- **Production delivery:** Emails are sent asynchronously via Resend with responsive HTML buttons, copyable link fallbacks, and plain-text multipart alternatives.

To enable live email delivery on your production deployment:

1. **Upload your Resend API key to Cloudflare Secrets:**
   Obtain an API key from [resend.com/api-keys](https://resend.com/api-keys) (starts with `re_`), then run:

   ```bash
   pnpm exec wrangler secret put RESEND_API_KEY
   ```

   Paste your API key when prompted:

   ```text
   ✔ Enter a secret value: re_123456789_abcdefghijklmnopqrstuvwxyz
   ✨ Success! Created secret RESEND_API_KEY
   ```

2. **Configure your verified sender address:**
   Run:

   ```bash
   pnpm exec wrangler secret put EMAIL_FROM
   ```

   Paste your sender address when prompted:

   ```text
   ✔ Enter a secret value: Burrow <notify@yourverifieddomain.com>
   ✨ Success! Created secret EMAIL_FROM
   ```

3. **Verify domain DNS:** Ensure your sending domain has active SPF and DKIM records verified at [resend.com/domains](https://resend.com/domains). _(For initial testing before domain verification, you can set `EMAIL_FROM=Burrow <onboarding@resend.dev>`, which delivers to your Resend account email)._

### 5. Rollback Procedure

> [!IMPORTANT]
> **D1 Time Travel Backup Note**: Cloudflare D1's SQL dump export (`wrangler d1 export`) does not support databases containing SQLite FTS5 virtual tables (`notepads_fts`). Burrow relies on Cloudflare D1 **Time Travel** for continuous point-in-time recovery.

Every execution of `pnpm run deploy` records the active D1 Time Travel bookmark in `.deploy-log/rollbacks.log`. If a deployment introduces a regression:

1. Redeploy the previous Git release with `pnpm run deploy`.
2. Restore the remote D1 database to the recorded bookmark:
   ```bash
   wrangler d1 time-travel restore <db-name> --bookmark=<BOOKMARK_FROM_DEPLOY_LOG>
   ```
   _(Replace `<db-name>` with your database name, defaulting to `burrow` or whatever `--name` was configured)._

### 6. Troubleshooting & Common Deployment Errors

#### `Authentication error [code: 10000]` on D1 API endpoints

- **Symptom:** When running `pnpm run deploy` or remote migrations, Wrangler outputs:
  ```
  X [ERROR] A request to the Cloudflare API (/accounts/.../d1/database/burrow) failed.
    Authentication error [code: 10000]
  ```
- **Cause:** Cloudflare D1 requires a 36-character database UUID for remote API calls. If the database has not been created yet or Wrangler is not logged into the owning Cloudflare account, auto-discovery cannot resolve the UUID.
- **Solution:**
  1. Run `pnpm run setup` to automatically provision or discover the D1 database and generate the git-ignored `wrangler.local.jsonc` binding.
  2. Or verify your database list with `pnpm exec wrangler d1 list`.

#### Expired Wrangler OAuth Token

- **Symptom:** API requests return authentication or authorization errors even with correct IDs.
- **Solution:** Refresh your OAuth session by running:
  ```bash
  pnpm exec wrangler login
  ```
  and verify the active account with `pnpm exec wrangler whoami`.

---

## Scripts & Environment Targeting

All environment-aware scripts follow a **safe-by-default (local)** convention:

- **Default (no flag)**: Targets **local** Miniflare SQLite / localhost. Safe to run at any time.
- **`-r` or `--remote`**: Targets **remote** Cloudflare production.

Every command prints a prominent startup banner confirming its target:

```text
======================================================
ACTION: RESET DATABASE
TARGET: 💻 LOCAL (Miniflare SQLite)
======================================================
```

| Script              | Local Default (`pnpm run <cmd>`)                                      | Remote Production (`-r` or `--remote`)                              |
| :------------------ | :-------------------------------------------------------------------- | :------------------------------------------------------------------ |
| `pnpm dev`          | Starts Vite (`:3005`) and Worker (`:8787`) with auto D1 migrations    | _(Local only)_                                                      |
| `pnpm run setup`    | Installs deps, migrates local D1, prints dev URLs & token             | Provisions remote D1/R2, deploys Worker, uploads secrets            |
| `pnpm run deploy`   | —                                                                     | Checks, builds, records D1 Time Travel snapshot, migrates & deploys |
| `pnpm run reset`    | Wipes local D1 database without prompt                                | Prompts `"RESET-PRODUCTION"`, then wipes remote D1                  |
| `pnpm run teardown` | Cleans `.wrangler` local state and build artifacts                    | Prompts `"TEARDOWN"`, then deletes Worker, D1, and R2               |
| `pnpm check:data`   | Verifies the 10 data invariants against local D1                      | Verifies the 10 data invariants against remote Cloudflare D1        |
| `pnpm seed`         | Seeds local D1 database with demo workspace & cards                   | _(Local only to protect production)_                                |
| `pnpm check`        | Full local CI gate: `tsc -b`, Basalt design guard, ESLint, and Vitest | —                                                                   |
| `pnpm test`         | Runs all Vitest test suites (supports `pnpm test <path>`)             | —                                                                   |
| `pnpm build`        | Production Vite bundle to `dist/web`                                  | —                                                                   |
| `pnpm logs`         | Streams live Worker logs via `wrangler tail`                          | _(Remote only)_                                                     |
| `pnpm format`       | Formats all code with Prettier                                        | —                                                                   |

> **Basalt Design Guard (`check-basalt`)**: A fast repository linter (`scripts/check-basalt.mjs`) included in `pnpm check` that enforces design system integrity by prohibiting raw arbitrary Tailwind utility values and ensuring only curated Basalt semantic tokens are used.

---

## Security Model

- Session middleware automatically extracts user identity, workspace ID, and role (`owner`, `editor`, `viewer`).
- All queries strictly enforce `workspace_id` isolation.
- Mutating endpoints require `editor` or `owner` roles; viewers receive 403 on all mutating operations.
- Invite tokens are stored only as SHA-256 hashes and expire after 7 days.
- Content size is strictly validated and capped (1.5 MB limit per notepad), and D1 bound parameters are chunked under the 100-parameter threshold.

---

## License & Commercial Use

Burrow is open-source software licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)**.

- **Open-Source & Self-Hosting**: You are free to inspect, modify, and self-host Burrow for personal, non-profit, or internal organizational use under the terms of the AGPL-3.0.
- **Network Copyleft Requirement**: In accordance with Section 13 of the AGPL-3.0, if you modify Burrow and run it as a network service or SaaS, you must make the complete source code of your modified version available to all network users under the AGPL-3.0.
- **Commercial Cloud / SaaS**: A hosted cloud service is provided by the project authors. If you require a commercial license without AGPL-3.0 copyleft obligations, please contact the maintainers.
- **Third-Party Libraries**: Core editor capabilities are powered by [BlockNote](https://www.blocknotejs.org/), licensed under the Mozilla Public License 2.0 (MPL-2.0).

---

## License & Commercial Use

Burrow is open-source software licensed under the **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)**.

- **Open-Source & Self-Hosting**: You are free to inspect, modify, and self-host Burrow for personal, non-profit, or internal organizational use under the terms of the AGPL-3.0.
- **Network Copyleft Requirement**: In accordance with Section 13 of the AGPL-3.0, if you modify Burrow and run it as a network service or SaaS, you must make the complete source code of your modified version available to all network users under the AGPL-3.0.
- **Commercial Cloud / SaaS**: A hosted cloud service is provided by the project authors. If you require a commercial license without AGPL-3.0 copyleft obligations, please contact the maintainers.
- **Third-Party Libraries**: Core editor capabilities are powered by [BlockNote](https://www.blocknotejs.org/), licensed under the Mozilla Public License 2.0 (MPL-2.0).
