# Port the Burrow `scripts/` layer to a new project

Copy everything under this heading into your agent's prompt, inside the **new** project.

---

## Task

Port Burrow's `scripts/` orchestration layer and its `package.json` wiring into this
repository. The new project uses the **same stack**: Cloudflare Workers, D1, R2,
Vite + React, pnpm, Node 20+.

Reference implementation to copy from: `D:\Burrow` (Windows, pnpm, scripts written in
plain `.mjs` with no build step). Read the real files before writing anything — do not
work from this summary alone.

## Scope

**In scope — create these files:**

| File                           | Purpose                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/lib.mjs`              | Shared helpers: `root`, `bin`, `run`, `step`, `smoke`, `loadEnv`, `getWranglerConfigArgs`, `parseFirstJson`, `argValue`, `hasFlag` |
| `scripts/check.mjs`            | `pnpm check` gate: typecheck → design guard → lint → tests                                                                         |
| `scripts/dev.mjs`              | Dual dev server (wrangler + vite) with clean shutdown                                                                              |
| `scripts/setup.mjs`            | Idempotent first-time provision + deploy                                                                                           |
| `scripts/deploy.mjs`           | Release: check → build → time-travel bookmark → migrate → deploy → smoke                                                           |
| `scripts/migrate-remote.mjs`   | Remote D1 migrations with friendly errors                                                                                          |
| `scripts/reset.mjs`            | Wipe D1 back to clean state (`--local` / `--remote` / `--force`)                                                                   |
| `scripts/clean.mjs`            | Deprecation shim → `reset.mjs --local`                                                                                             |
| `scripts/teardown.mjs`         | Delete Worker + D1 + R2 (`--force`)                                                                                                |
| `scripts/seed.mjs`             | Load `scripts/seed.sql` into local D1, then verify invariants                                                                      |
| `scripts/check-data.mjs`       | Run `scripts/check-invariants.sql` against D1, fail on any row                                                                     |
| `scripts/check-basalt.mjs`     | Design-system regex guard over the web source                                                                                      |
| `scripts/seed.sql`             | Demo data (new project only — see Step 5)                                                                                          |
| `scripts/check-invariants.sql` | One query per invariant (new project only — see Step 5)                                                                            |
| `.dev.vars.example`            | Env template; `dev.mjs` copies it to git-ignored `.dev.vars`                                                                       |

**Also in scope — edit these:**

- `package.json` — the `scripts` block and `pnpm.onlyBuiltDependencies`
- `.gitignore` — must ignore `.dev.vars`, `.env`, `wrangler.local.jsonc`, `.deploy-log`,
  `.secrets.tmp.json`, `.wrangler/`, `dist/`

**Explicitly out of scope** — do not port or create: `AGENTS.md`, `.agents/`,
`eslint.config.js`, `vitest.config.ts`, `tsconfig*.json`, `drizzle.config.ts`,
`check-basalt.mjs`'s design-token list (see Step 6), or anything in `src/`. The `check`
script assumes eslint/vitest/tsc already exist in the project; if they don't, wire the
steps you can and note what you skipped.

## Step 1 — Name substitutions

Before writing, decide the new project's names and substitute them everywhere. Grep the
finished result for leftover `burrow` (case-insensitive) — there must be zero hits except
inside comments that are obviously generic.

| Burrow value                       | Replace with                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| Worker name `burrow`               | `<worker>`                                                                                 |
| D1 `database_name: "burrow"`       | `<db>` (no spaces; this is the identifier in every `d1 execute` / `migrations apply` call) |
| R2 bucket `burrow-files`           | `<bucket>`                                                                                 |
| `BOOTSTRAP_TOKEN`                  | keep the name, or your own first-owner token                                               |
| wrangler dev port `8787`           | pick a free pair, keep 8787 unless taken                                                   |
| vite port `5173`                   | keep unless taken                                                                          |
| `src/web` (basalt guard scan root) | your web source dir                                                                        |
| `dist/web` (assets dir)            | must match `wrangler.jsonc` `assets.directory`                                             |

`"burrow"` appears as a hardcoded literal in `setup.mjs`, `deploy.mjs`,
`migrate-remote.mjs`, `reset.mjs`, `seed.mjs`, `check-data.mjs`, plus inside the error
strings in `lib.mjs`. All of them must change.

## Step 2 — `lib.mjs`: copy essentially verbatim

This file is fully generic. Preserve these behaviours exactly — they exist because of
real Windows/Cloudflare failures:

1. **`bin(pkg, sub)`** resolves `node_modules/<pkg>/package.json` → `bin` field. Do **not**
   replace it with `npx` / `pnpm exec` / a bare command name. PATH lookup and `.cmd` shims
   are the source of intermittent "command not found" failures on Windows.
2. **`run()`** routes `.js`/`.cjs`/`.mjs` and extensionless files (e.g. typescript's
   `bin/tsc`) through `process.execPath` instead of the shell, because cmd.exe cannot exec
   them. `shell` is enabled **only** on win32 and **only** for non-script commands.
3. **`run()`** supports `dryRun`, `capture`, `cwd`, `env`, `allowFail`, `quiet`, and
   `maxBuffer: 64MB`. On non-zero exit it prints the command, re-emits captured stderr,
   calls `printWranglerTroubleshooting` when the command mentions `wrangler`, then
   `process.exit(status)`.
4. **`getWranglerConfigArgs()`** is the important one. It must:
   - read `D1_DATABASE_ID` / `CLOUDFLARE_D1_DATABASE_ID` from `.env` or `.dev.vars`;
   - fall back to an existing `wrangler.local.jsonc`;
   - fall back to `wrangler d1 list --json`, match by `database_name`, and write the
     discovered UUID back into `.dev.vars` if `D1_DATABASE_ID=` is present but blank;
   - generate a **git-ignored** `wrangler.local.jsonc` (base config with only
     `database_id` overridden) and return `['--config', 'wrangler.local.jsonc']`.
     This exists so no personal UUID or account id is ever committed to `wrangler.jsonc`.
5. **`loadEnv()`** parses both `.env` and `.dev.vars`, strips matching quotes, and never
   overwrites an already-set `process.env` key.
6. **`smoke(url)`** polls `GET <url>/api/health`, 3 attempts / 2s apart, prints the body
   on success. **The new project must expose a `GET /api/health` route returning 2xx**,
   otherwise setup and deploy will fail at the last step. If it doesn't exist yet, either
   add it or point `smoke()` at another cheap 2xx endpoint — but say which you chose.
7. `printMissingD1Error` and `printWranglerTroubleshooting`: rewrite the `"burrow"`
   references, and update the `pnpm exec wrangler d1 list` copy-paste hint to the new db
   name.

## Step 3 — `check.mjs` and `dev.mjs`

`check.mjs` runs four steps in order and aborts on the first failure (via `run` exiting
non-zero): `tsc -b`, `check-basalt.mjs`, `eslint .`, `vitest run`. Keep the
`console.log('check: <name>')` before each step and the final `check: OK`. If Step 6
results in dropping the basalt guard, drop that `run` line too rather than leaving a
commented-out step.

`dev.mjs` must keep all of:

- copy `.dev.vars.example` → `.dev.vars` if missing;
- write a placeholder `dist/web/index.html` if absent, so wrangler does not fail on a
  missing assets directory before the first build;
- launch **both** children with `stdio: ['ignore', 'inherit', 'inherit']` — inheriting
  stdin lets wrangler/vite put the Windows terminal into raw modes that trap Ctrl+C;
- `killTree()` using `taskkill /pid <pid> /T /F` on win32 and `SIGTERM` elsewhere;
- an idempotent `shutdown(code)` guarded by a `shuttingDown` flag, wired to `SIGINT` and
  `SIGTERM`;
- raw-mode stdin so `q` stops the dev server (guard with `process.stdin.isTTY`);
- launching via `process.execPath` with the resolved `bin()` path, not a shell command.

## Step 4 — `setup.mjs`, `deploy.mjs`, `migrate-remote.mjs`, `reset.mjs`, `clean.mjs`, `teardown.mjs`

`setup.mjs` — idempotent first-run provision. Preserve the step order and the flags
`--dry-run`, `--domain <domain>`, `--name <worker>`. Specifically:

- Preflight: require Node major ≥ 20; **refuse to run if `D1_DATABASE_ID` is already set**
  and print the "clear it, then re-run" guidance — re-running setup on a live database
  silently re-provisions it.
- `wrangler whoami --json` → `wrangler login` if not authenticated; if `CLOUDFLARE_ACCOUNT_ID`
  is unset and multiple accounts exist, prompt with an indexable list.
- `tsc -b` then `vite build`, then `wrangler deploy` (first deploy auto-provisions D1 and
  R2). Derive the URL from `--domains` or by regexing the `workers.dev` URL out of stdout;
  hard-fail if no URL.
- `ensureDatabaseId()`: env → `wrangler.jsonc` → `wrangler d1 create <db>` → on failure,
  look the db up by name in `wrangler d1 list --json`.
- `d1 migrations apply <db> --remote` with `env: { CI: '1' }` to skip the prompt.
- Secrets: list existing via `wrangler secret list --format json` and **only generate
  what is missing** — `BETTER_AUTH_SECRET` = 32 random bytes base64url, `BOOTSTRAP_TOKEN`
  = 16 random bytes hex, `BETTER_AUTH_URL` = deployed origin. Write to
  `.secrets.tmp.json`, upload with `secret bulk`, delete in a `finally`. Never print a
  secret value other than `BOOTSTRAP_TOKEN` in the final summary.
- Smoke test, then print the URL / D1 id / bootstrap token and the `.env` lines to add.

`deploy.mjs` — preserve this exact order and rationale: `getWranglerConfigArgs({required: true})`
→ `check.mjs` → `vite build` → **record a D1 time-travel bookmark** into
`.deploy-log/rollbacks.log` (allowFail, warn if unavailable) → **apply migrations before
uploading code** → `deploy` → smoke. The bookmark and the migrate-before-deploy ordering
are the rollback safety net; do not drop or reorder them.

`migrate-remote.mjs` — 3 lines: `step()`, `getWranglerConfigArgs({required: true})`,
`d1 migrations apply <db> --remote` with `CI=1`.

`reset.mjs` — require `--local` or `--remote`, exit 1 with usage if neither. Remote (unless
`--force`) requires the user to type exactly `RESET-PRODUCTION`; local runs unprompted for
the dev loop. Then `d1 execute` the wipe list and verify with a follow-up query asserting
`count(*) = 0`. **`cleanSql` is Burrow-specific: rebuild the DELETE list from this
project's schema, in foreign-key-safe order (children before parents, same ordering as
`reset.mjs` does for `card_subtasks` → `cards` → `boards` → `projects` → `workspaces` →
`account` → `user`).**

`clean.mjs` — a deprecation shim that warns and delegates to `reset.mjs --local`. Port it
only if you keep a `db:clean:local` alias in `package.json`; otherwise skip both.

`teardown.mjs` — list the Worker, D1 db and R2 bucket by name; require typing `TEARDOWN`
unless `--force`; delete each with `allowFail: true` so one missing resource does not abort
the rest; tell the user to remove `D1_DATABASE_ID` from their env file afterwards.

## Step 5 — `seed.mjs` + `check-data.mjs` + the two SQL files

`check-data.mjs` is generic — port it as-is (substituting the db name). It runs
`d1 execute <db> (--local|--remote) --file scripts/check-invariants.sql --json`, parses
with `parseFirstJson` (wrangler mixes logs into stdout), walks
`resultSets[].results ?? .rows`, and **fails if any row comes back**.

`check-invariants.sql` and `seed.sql` are Burrow-domain-specific. Handle them one of two
ways, and state which you chose:

- **Schema exists** — write `check-invariants.sql` against the real tables: one query per
  invariant, each returning only **offending rows** (empty result = pass), every statement
  carrying a literal `'I<n>'` tag in the first column, and **comments kept on their own
  lines** (the runner splits statements on `;`). Write `seed.sql` as a plain multi-statement
  script that the new schema accepts.
- **Schema does not exist yet** — port `check-data.mjs` and `seed.mjs`, ship the two SQL
  files as clearly-marked `TODO` stubs, and **remove** `seed:local` from the `check` path
  so the gate cannot fail on a placeholder. Say so explicitly in your report.

`seed.mjs` runs the seed then calls `check-data.mjs` in the same process and exits non-zero
if the invariant check fails — keep that coupling.

## Step 6 — Decide on the basalt guard

`check-basalt.mjs` walks `src/web` for `*.tsx` / `*.css` and fails on any line matching a
ban list (`rounded-`, `shadow-(xs|sm|…)`, `bg-neutral-`, `border-neutral-`,
`text-neutral-`, `dark:`, `TODO(ui)`, `once available`). It is calibrated to Burrow's
Basalt design system, and Burrow's list is already at zero matches.

Pick one and justify it in your report:

1. **Port and recalibrate** — keep the script, but first run the _unmodified_ list over the
   new project's web source, then trim patterns to only those the new codebase actually
   honours, so the guard starts green. Set the scan root to the real web source dir.
2. **Port as-is** — only correct if the new project adopts the same design system.
3. **Drop it** — delete the script, remove its step from `check.mjs`, and remove
   `check:basalt` from `package.json`. Do not leave a dead file or a commented-out step.

## Step 7 — `package.json`

Copy the `scripts` block and rewrite the commands for the new names:

```
dev, dev:node, build, preview, start, setup, deploy, check, check:data,
db:generate, db:migrate:local, db:migrate:remote, db:clean:local, reset,
teardown, seed:local, test, e2e, logs, typecheck, lint, format
```

- `dev:node` hardcodes a `src/server/index.ts` esbuild bundle that does not exist in a
  Workers project. **Omit it.**
- `e2e` / `logs` require Playwright and a live worker; include them only if the project
  actually has those, otherwise omit rather than shipping a broken alias.
- `db:migrate:local` and the `reset`/`seed` scripts must use the new db name.
- Keep `"type": "module"`.
- Keep `pnpm.onlyBuiltDependencies`; drop `better-sqlite3` and `@biomejs/biome` if they are
  not dependencies of the new project. (`@biomejs/biome` is not even a direct dependency in
  Burrow — do not propagate a dangling entry.)
- Do not add a `preinstall` hook.

## Step 8 — Config the scripts depend on

- **`wrangler.jsonc`** must have `name`, `main` pointing at your worker entry,
  `compatibility_flags: ["nodejs_compat"]`, `assets.directory` matching the `dist/web`
  placeholder `dev.mjs` writes, `not_found_handling: "single-page-application"`,
  `run_worker_first: ["/api/*"]`, and a `d1_databases[0]` with `binding`, `database_name`
  = `<db>`, `migrations_dir` = `migrations`. **`database_id` must be absent or empty** —
  that is the whole point of the `wrangler.local.jsonc` indirection.
- **R2**: include `r2_buckets[0]` only if the new project uses R2; `teardown.mjs` and
  `setup.mjs` both reference the bucket name.
- **`.dev.vars.example`**: `D1_DATABASE_ID=` and `CLOUDFLARE_ACCOUNT_ID=` blank,
  `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:<vite port>`, `BOOTSTRAP_TOKEN`.
- **`.gitignore`**: `.dev.vars`, `.env`, `wrangler.local.jsonc`, `.deploy-log`,
  `.secrets.tmp.json`, `.wrangler/`, `dist/`, `node_modules/`.
- **`migrations/`** must exist for `d1 migrations apply` and for `check-invariants.sql`
  to be meaningful.

## Step 9 — Verify before reporting done

Run these in order and report the actual output of each. Do not claim success you did not
observe.

```bash
pnpm install
pnpm setup --dry-run          # every command printed, nothing executed
pnpm check                    # must be green
pnpm dev                      # both ports serve; Ctrl+C and "q" both exit cleanly
pnpm db:migrate:local
pnpm reset --local
pnpm seed:local               # or confirm the TODO-stub decision from Step 5
pnpm check:data
pnpm check:data --remote      # only if a remote db is configured
```

Then, with a real Cloudflare account:

```bash
pnpm setup                    # fresh clone only; requires D1_DATABASE_ID to be unset
pnpm deploy                   # check → build → bookmark → migrate → deploy → smoke
pnpm teardown                 # type TEARDOWN; confirm resources are gone
```

Additional acceptance criteria:

- `grep -rni burrow scripts/ package.json .dev.vars.example` returns nothing.
- Every destructive script (reset, teardown) refuses without its typed confirmation phrase,
  and its `--force` path still works.
- No script prints a secret value other than `BOOTSTRAP_TOKEN` in the final summary.
- `pnpm check` fails loudly (non-zero) when any individual step fails.

## Report back

State: files created, files modified, the Step 5 and Step 6 decisions and why, the
`/api/health` endpoint decision from Step 2, every `burrow` → new-name substitution, and
the verbatim output of `pnpm setup --dry-run` and `pnpm check`.
