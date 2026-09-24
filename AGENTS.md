# Agent Rules & Guidelines

## UI Testing Instruction

- **Do NOT run any UI tests** (including browser subagents, Playwright tests, Puppeteer, or any other browser/UI test automation) unless explicitly requested by the user.
- **Do NOT run automated test suites** unless explicitly asked by the user. Focus on writing clean code, reviewing types and logic, and fixing bugs directly.

## Parallel Subagent Instruction

- **Always parallelize large tasks.** If a task touches 3+ files, spans multiple independent areas/components, or has separable workstreams (e.g. foundation + feature areas, independent files, research + implementation), split it into parallel `subagent` workers instead of doing it sequentially.
- **Split by disjoint file sets.** Give each subagent an explicit ONLY-these-files scope so edits never overlap. Shared contracts (new APIs, token names, types) must be specified identically in every prompt, or built first by one agent before the others consume them.
- **Verify after merging.** Parallel agents' outputs can drift (e.g. TODO fallbacks, duplicated helpers). After they complete, always re-check ground truth yourself: typecheck, grep for leftovers, and run a build before reporting done.
