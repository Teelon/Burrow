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

---

## 4. Repository layout

See `docs/plan/PLAN.md` for complete specification.
