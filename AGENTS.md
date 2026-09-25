# Agent Rules & Guidelines

## UI Testing Instruction

- **Do NOT run browser/UI tests** (including browser subagents, Playwright tests, Puppeteer, or any other browser/UI test automation) unless explicitly requested by the user.
- **DO run API/unit/contract test suites when you touch covered code.** `pnpm exec vitest run <touched-file>` (or the nearest suite) is mandatory verification, not optional. The blanket ban on test suites was lifted 2026-09-25 after a missing-WHERE-clause regression shipped because only typecheck+build ran.
- **The full gate must be green before reporting done:** `pnpm check` (typecheck + basalt guard + eslint + all vitest suites). Never leave it red; a failing gate that everyone ignores is worse than no gate.

## Regression-Test Rule (learned 2026-09-25)

- **Every route/service change ships with an endpoint contract test** asserting its filter/shape semantics — especially "X must not appear in list Y after delete/restore". Tests live in `tests/api/` using the `createWorkerApp` + bootstrap-cookie harness; see `tests/api/notepads-tree.test.ts` as the reference example.
- **Every repository change ships with a contract case** in `tests/adapters/*.contract.test.ts`, executed against each adapter. Adapters must never disagree on filter semantics (D1 vs Postgres drift caused the 2026-09-25 sidebar-delete incident).
- **Shared interfaces carry doc comments stating filter semantics** (e.g. `INotepadRepository.listByProject` = live tree rows only). If you change what a method returns, update its doc comment in the same edit.

## UI Mutation Rule (learned 2026-09-25)

- **No silent mutations.** Every `useMutation` and every fire-and-forget `fetch` write must have an `onError`/catch path that surfaces a toast (sonner) — never `console.error`-only, never an unhandled rejection. Silent failures double every future debug session.
- **No native dialogs for destructive actions.** Use the in-app `ConfirmDialog` (`src/web/components/ui/ConfirmDialog.tsx`); `window.confirm`/`alert`/`prompt` are silently ignored in sandboxed/embedded contexts.

## Parallel Subagent Instruction

- **Always parallelize large tasks.** If a task touches 3+ files, spans multiple independent areas/components, or has separable workstreams (e.g. foundation + feature areas, independent files, research + implementation), split it into parallel `subagent` workers instead of doing it sequentially.
- **Split by disjoint file sets.** Give each subagent an explicit ONLY-these-files scope so edits never overlap. Shared contracts (new APIs, token names, types) must be specified identically in every prompt, or built first by one agent before the others consume them.
- **Verify after merging.** Parallel agents' outputs can drift (e.g. TODO fallbacks, duplicated helpers). After they complete, always re-check ground truth yourself: typecheck, grep for leftovers, and run a build before reporting done.
