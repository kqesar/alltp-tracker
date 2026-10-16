# CLAUDE.md

A Link to the Past Tracker — a React 19 + TypeScript (Vite, Zustand, Biome, Vitest) web app tracking items, chests and dungeons in ALttP Randomizer runs. Package manager is **pnpm**, pinned by `packageManager` in `package.json` (pnpm switches to that version itself; CI reads it too); Node `>=22.0.0`. Build scripts are denied by default, so a dependency that needs one (esbuild) is listed under `allowBuilds` in `pnpm-workspace.yaml`.

Area rules live in `.claude/rules/` and load when you touch their files: `store.md` (state, persistence), `data.md` (game data and logic), `components.md` (UI, styles, a11y), `tests.md`.

## Quality bar

This tracker is meant to become the reference tracker for randomizer runs, so every change is held to that standard on every axis: runtime performance (renders, CPU, memory, storage), visual design (pixel-perfect at every width), accessibility and semantic HTML, code and algorithm quality, bundle size, dependencies, tests, CI and infrastructure.

- **Fix what you find.** A defect noticed while working on something else — a bug, a re-render storm, an a11y violation, a flaky or vacuous test, a broken workflow — is fixed, in its own commit, without waiting to be asked. Say what was found and fixed.
- **Verify in a real browser.** UI work is driven with Playwright (screenshots at 390 / 820 / 1440 / 1920 px, real interactions) and audited with axe-core plus a check for clickable elements a keyboard cannot reach; jsdom alone misses layout and focus bugs.
- **Dependencies are welcome when they earn their place.** Add a library when it is the better engineering choice over hand-rolled code, and state why: what it replaces, its size and maintenance, and why it beats the alternative. Remove a dependency the moment it stops earning it.
- **Game rules come from the randomizer's own source**, never from memory; record the upstream commit they were read from.

## Commands

```bash
pnpm dev                     # Start dev server (vite)
pnpm build                   # tsc -b && vite build
pnpm lint                    # Biome check
pnpm lint:fix                # Biome check --write
pnpm test                    # Run tests once (vitest run)
pnpm test:coverage           # Run tests with coverage (enforces the floors)
pnpm vitest run <file>       # One spec file; add -t "name" to filter by test name
```

`tsc -b` emits `vite.config.js` at the repo root. It is gitignored and excluded from Biome; delete it if it gets in the way.

The `verifier` subagent runs lint, types, tests and build and returns only the failures; use it instead of reading full command output.

## Conventions

- Import via the `@/` alias (`@` → `src`). There are no barrel/`index.ts` re-export files — import from the file path.
- Biome (not ESLint/Prettier) handles lint + format and sorts imports, JSX attributes and object keys. A hook runs it on every file you edit; fix what it reports.
- Code and comments in English.

## Commits

Conventional Commits, enforced by commitlint via a husky `commit-msg` hook (`feat`/`fix`/`docs`/`style`/`refactor`/`perf`/`test`/`build`/`ci`/`chore`/`revert`); body lines ≤ 100 characters. A `pre-commit` hook runs `lint-staged` (Biome) on staged files. Do not add Co-Authored-By trailers. `standard-version` derives releases from commit types, so mark a commit breaking (`!` / `BREAKING CHANGE`) only when users must act — an automatic save migration is not breaking.
