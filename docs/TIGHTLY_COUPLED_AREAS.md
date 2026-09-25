# Tightly Coupled & Fragile Areas in Burrow

This document tracks tightly coupled, high-risk areas across the Burrow codebase that are prone to regression during AI-assisted or parallel engineering sessions. Each area is cataloged with its risks, current coupling points, and decoupled target architecture.

---

## 1. Drag-and-Drop & Spatial Math in JSX Components

### A. Notepad Hierarchy (`src/web/components/notepads/NotepadTree.tsx`)
- **Symptoms / Incident**: Drag-and-drop tree rearrangement broke due to `computeProjection` math, sensitive collision bounds, and silent mutation failures.
- **Coupling**:
  - 200+ lines of coordinate math (`relY`, `ROOT_EDGE_PX`, `px`/`py`), cycle detection, depth cap checking, and drop mode calculation (`before` | `after` | `inside`) are closures inside the React component.
  - Tightly coupled to `@dnd-kit/core` events (`onDragMove`, `onDragEnd`) with no unit-testable pure layer.
- **Refactor Target**:
  - Extract pure function `computeDropProjection(...)` into `src/web/components/notepads/treeProjection.ts`.
  - Add co-located unit test `treeProjection.test.ts` testing every boundary (before, after, inside, cycle rejection, depth rejection).

### B. Kanban Board & Column Dragging (`src/web/components/boards/views/KanbanView.tsx`)
- **Status**: 959 lines in a single file.
- **Coupling**:
  - Contains ~150 lines of drag-and-drop math in `handleDragEnd` (lines 640–780) computing:
    - Intra-column card reordering.
    - Inter-column card transfers based on cursor midpoints (`activeMidY > overMidY`).
    - Column reordering (`afterId` resolution).
  - Also contains: WIP limits logic, confetti triggers on column regex match, inline card creation, context menus, quick peek modals, and keyboard navigation.
- **Refactor Target**:
  - Extract drag reordering logic into `src/web/components/boards/kanbanReorder.ts`.
  - Extract `KanbanColumn.tsx` and `KanbanCardTile.tsx` into standalone components.
  - Add unit tests for `kanbanReorder.test.ts`.

### C. Subtask Reordering (`src/web/components/boards/SubtasksSection.tsx`)
- **Coupling**: Lines 184–190 compute `afterId` inline using duplicate `reordered.findIndex` calls without unit test coverage.
- **Refactor Target**:
  - Extract sibling index resolution helper `getReorderedAfterId(items, activeId, overId)`.
  - Add unit test coverage.

---

## 2. Monolithic Rich Editor (`src/web/editor/NotepadEditor.tsx`)

- **Status**: 1,035 lines in a single file.
- **Coupling**:
  - Combines 7 independent subsystems in one component:
    1. BlockNote editor instantiation and schema.
    2. Edit-lock heartbeat, takeover, and read-only banner logic.
    3. Autosave single-flight queue, debounce timer, and optimistic version increment.
    4. S3/R2 direct cover image upload.
    5. Mention auto-complete and backlinks extraction.
    6. Slash command popup integration.
    7. Title change debounced patch.
- **Risk**: Touching editor UI or styling easily breaks the lock heartbeat or single-flight autosave concurrency.
- **Refactor Target**:
  - `useNotepadLock(notepadId)`: Custom hook encapsulating heartbeat, claim, takeover, and release.
  - `useAutosave(notepadId, version)`: Custom hook encapsulating debounced single-flight save with version conflict handling.
  - `useNotepadHeader(notepadId)`: Title, cover upload, tags, and favorite toggle.

---

## 3. Monolithic React Query File & Silent Mutations (`src/web/lib/queries.ts`)

- **Status**: 1,220 lines in a single file.
- **Coupling**:
  - Houses all queries and mutations across 10 unrelated domains (auth, projects, boards, columns, cards, subtasks, comments, notifications, tags, search).
  - Contains manual, optimistic cache modifications (`onMutate`) splicing nested arrays.
  - **Rule Violations**:
    - `useMoveColumn` (line 442) has no `toast.error` in `onError`.
    - `useMoveCard` (line 616) has no `toast.error` in `onError`.
- **Refactor Target**:
  - Split `queries.ts` by domain into `src/web/lib/queries/`:
    - `projects.ts`
    - `notepads.ts`
    - `boards.ts`
    - `cards.ts`
    - `auth.ts`
  - Add an automated lint rule requiring `onError` with `toast.error` on all `useMutation` definitions.

---

## 4. Database Adapter Drift (D1 vs Postgres)

- **Incident**: Drift between SQLite and Postgres caused the 2026-09-25 sidebar-delete incident and the position helper discrepancy.
- **Uncovered Repositories**:
  - `tests/adapters/` currently only tests:
    - `lock.contract.test.ts`
    - `notepad.contract.test.ts`
    - `search.contract.test.ts`
    - `storage-local.test.ts`
  - **Missing Contract Suites**:
    - `card.contract.test.ts` (moving cards between columns, subtasks, quick-add cards)
    - `board.contract.test.ts` (column reordering, WIP limits)
    - `project.contract.test.ts` (ordering, archiving, recent projects)
    - `tag.contract.test.ts` (project-scoped tagging)
    - `member.contract.test.ts` (role enforcement)
- **Refactor Target**:
  - Implement contract test suites for `card`, `board`, and `project` executed against both D1 and Postgres.

---

## 5. UI Dialog Inconsistency (`Sidebar.tsx`)

- **Rule Violation**: In `src/web/components/layout/Sidebar.tsx` line 184:
  ```ts
  const name = window.prompt('New Board Name:', 'Sprint Board');
  ```
  `window.prompt` violates the UI Mutation Rule in `AGENTS.md` ("No native dialogs for destructive actions... silently ignored in sandboxed/embedded contexts").
- **Refactor Target**:
  - Replace `window.prompt` with an in-app dialog or inline board creation popover.

---

## 6. Dev Server Port Disparity (`scripts/dev.mjs`)

- **Issue**:
  - `scripts/dev.mjs` boots Vite on port 5173 (with live HMR) and Wrangler on port 8787 (Worker API + `./dist/web` static assets).
  - Opening port 8787 in a browser serves the compiled production bundle (`dist/web`), which does NOT hot-reload on file edits.
  - If code is edited without running `pnpm build`, port 8787 continues running stale code, misleading developers and agents into thinking fixes didn't work.
- **Refactor Target**:
  - Update `scripts/dev.mjs` to configure Wrangler to proxy non-API requests to Vite (port 5173) in dev, or explicitly warn in console when accessing port 8787 for web assets.

---

## Prioritized Session Backlog

| Priority | Session Item | Status | Primary Files |
| :--- | :--- | :--- | :--- |
| **P1** | Add missing `toast.error` to `useMoveCard`, `useMoveColumn`, delete mutations | ✅ **Done** | `src/web/lib/queries.ts` |
| **P1** | Replace `window.prompt` & `window.confirm` with `PromptDialog` & `ConfirmDialog` | ✅ **Done** | `src/web/components/layout/Sidebar.tsx`, `ProjectHome.tsx`, `TrashView.tsx`, `CommentsFeed.tsx` |
| **P2** | Extract pure `treeProjection.ts` and add unit test suite (16 tests) | ✅ **Done** | `src/web/components/notepads/treeProjection.ts`, `treeProjection.test.ts` |
| **P2** | Extract pure `kanbanReorder.ts` and add unit test suite (19 tests) | ✅ **Done** | `src/web/components/boards/kanbanReorder.ts`, `kanbanReorder.test.ts`, `KanbanView.tsx`, `SubtasksSection.tsx` |
| **P3** | Add `card.contract.test.ts` and `board.contract.test.ts` | Backlog | `tests/adapters/` |
| **P3** | Split `queries.ts` into domain-specific modules | Backlog | `src/web/lib/queries/` |
| **P4** | Decompose `NotepadEditor.tsx` into custom hooks | Backlog | `src/web/editor/` |
