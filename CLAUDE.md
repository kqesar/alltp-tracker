# CLAUDE.md

A Link to the Past Tracker — a React 19 + TypeScript (Vite, Zustand, Biome, Vitest) web app tracking items, chests and dungeons in ALttP Randomizer runs. Package manager is **pnpm**, pinned to one exact version by both `packageManager` and `devEngines.packageManager` in `package.json`, which a bump changes together (pnpm switches to that version itself and records its binaries' sha512 in `pnpm-lock.yaml`; CI reads it too). Node is pinned the same way by `devEngines.runtime`: `pnpm install` fetches that Node (exact version and checksum in the lockfile) and every `pnpm` script runs with it, whatever Node the shell has; CI sets up pnpm, that Node and the frozen install in one step (`pnpm/setup`). Build scripts are denied by default, so a dependency that needs one (esbuild) is listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Layout

A pnpm workspace. Dependencies point one way: `apps/web` → packs → `packages/*`, and the packages import nothing of the app or the packs.

- `apps/web` — the tracker app (`@alltp/web`); all React, Vite and Playwright code and configs. It holds no game rule: `apps/web/src/games/alttpr/logic/` reads the run through `packs/alttpr`. Each game's modules live under `apps/web/src/games/<id>/` (ALttPR's: its board, map, logic, store, autotracking, voice); `src/` itself keeps what every game shares (the entry point, the dialogs and toolbar menu, the update notice, the setup guide's model, utils, styles).
- `packages/engine` — `@alltp/engine`, the game-agnostic logic engine; its README is the design doc.
- `packages/autotrack` — `@alltp/autotrack`, the game-agnostic autotracking link: the usb2snes protocol to SNI / QUsb2Snes, the session and its diagnostic codes, polling, Race Mode by construction, the setup-guide model. Packs supply every address, game probe and race profile; its README is the design doc.
- `packs/*` — game packs (rules as data, items, map markers). `packs/alttpr` (`@alltp/pack-alttpr`) ports ALttPR v31 from the randomizer's source: `upstream.json` pins the upstream commit and maps each upstream file to its module, `test/upstream/` holds the official tests as generated fixtures, and the weekly Logic drift workflow opens a `logic-drift` issue when upstream moves. `packs/sm` (`@alltp/pack-sm`) is Super Metroid as Map Rando seeds play it: items, objectives and the autotracking memory map, read from Map Rando's source (its README; no logic, the rooms being reconnected).
- Root — shared tooling only: Biome, TypeScript (a solution `tsconfig.json`), Vitest (`projects` + coverage over every workspace), husky, commitlint. The root `package.json` carries the product version, which release-please bumps. Commit scopes follow the workspace: `web`, `engine`, `autotrack`, `alttpr`, `sm`.

Area rules live in `.claude/rules/` and load when you touch their files: `store.md` (state, persistence), `data.md` (game data and logic), `components.md` (UI, styles, a11y), `tests.md`, `engine.md` (the logic engine), `pack.md` (game packs).

## Quality bar

This tracker is meant to become the reference tracker for randomizer runs, so every change is held to that standard on every axis: runtime performance (renders, CPU, memory, storage), visual design (pixel-perfect at every width), accessibility and semantic HTML, code and algorithm quality, bundle size, dependencies, tests, CI and infrastructure.

- **Fix what you find.** A defect noticed while working on something else — a bug, a re-render storm, an a11y violation, a flaky or vacuous test, a broken workflow — is fixed, in its own commit, without waiting to be asked. Say what was found and fixed.
- **Verify in a real browser.** UI work is driven with Playwright (screenshots at 390 / 820 / 1440 / 1920 px, real interactions) and audited with axe-core plus a check for clickable elements a keyboard cannot reach; jsdom alone misses layout and focus bugs.
- **The design stays current.** Follow interface trends that have proven themselves (in the tools players already use and in mainstream product design), not passing fads. When part of the UI starts to look or behave dated, propose its evolution to the user before or while changing it: say what feels dated and why, show examples of the current practice it should move to (named apps or sites, screenshots, mock-ups), and keep the pixel-art identity of the game assets.
- **Dependencies are welcome when they earn their place.** Add a library when it is the better engineering choice over hand-rolled code, and state why: what it replaces, its size and maintenance, and why it beats the alternative. Remove a dependency the moment it stops earning it.
- **Game rules come from the randomizer's own source**, never from memory; record the upstream commit they were read from.
- **The architecture follows the need.** Watch whether the app's structure still fits what is being built (a single store as game packs arrive, hand-written predicates against a rules engine, one package against a monorepo, client-only state against sync). When it stops fitting, propose the change before building more on top: what no longer fits and why, the options, and each one's advantages, drawbacks and migration cost.
- **The platform is a choice, not a ceiling.** Today the tracker is front-end only, deployed as static files on GitHub Pages. The day that blocks something worth building (a relay for autotracking or multi-device sync, accounts, secrets for a racetime.gg or Archipelago integration, a server-side job), say so plainly and propose concrete options with trade-offs (serverless functions or an edge worker, a small backend, the Tauri desktop app, another host) instead of working around it. Once the platform has moved, delete this rule.

## Commands

```bash
pnpm dev                     # Start dev server (vite)
pnpm build                   # typecheck, then vite build of apps/web
pnpm typecheck               # tsc over every workspace (app, its configs and e2e, engine, packs)
pnpm lint                    # Biome check
pnpm lint:fix                # Biome check --write
pnpm test                    # Run tests once (vitest run)
pnpm test:coverage           # Run tests with coverage (enforces the floors)
pnpm test:e2e                # Playwright + axe on the production build, 4 widths (~10 s)
                             # port 4173; another worktree at once: E2E_PORT=<free port>
pnpm vitest run <file>       # One spec file; add -t "name" to filter by test name
pnpm --filter @alltp/pack-alttpr import-upstream <checkout>  # Regenerate the upstream test fixtures
pnpm --filter @alltp/pack-alttpr import-er <checkout> --rom <base.sfc>  # Re-import the entrance randomizer's tables and rules
pnpm --filter @alltp/web fetch-voice-model  # The speech model (40 MB, gitignored), before test:e2e
```

`tsc -b` writes its build info and the config projects' output under `node_modules/.tmp`, never next to the sources: a stray `vite.config.js` would shadow `vite.config.ts`.

The `verifier` subagent runs lint, types, tests and build and returns only the failures; use it instead of reading full command output. When running a check yourself, judge it by its exit code, never by the last line of its output: Biome prints its error count before a trailing blank line.

## Conventions

- In the app, import via the `@/` alias (`@` → `apps/web/src`). The app has no barrel/`index.ts` re-export files — import from the file path; a package exposes one `src/index.ts`.
- Biome (not ESLint/Prettier) handles lint + format and sorts imports, JSX attributes and object keys. A hook runs it on every file you edit; fix what it reports.
- Code and comments in English.
- One game at a time: `main.tsx` loads the module of the game this device tracks (`games/registry.ts`: `activeGame`, saved under `alltp-tracker-game`, A Link to the Past by default; `loadGame`), each a chunk of its own, so a player never downloads another game's board. A module (`games/<id>/module.ts`) gives its `start` (what it runs once per page: ALttPR's cross-tab sync) and its two views. Two entry views, picked in `main.tsx` by the query string: the tracker (`App`) and the OBS stream view (`?view=obs`, `ObsView`), which shows only the grid (with `&timer=1`, the run timer under it) and takes new versions on its own. Only the tracker autotracks: the stream view follows it through storage and never opens a session. `?bridge=<port>` points autotracking at a bridge on another port (the browser tests' fake one).
- The service worker (`apps/web/sw/`, production builds only) lists every built file with its content hash, so any release updates it: there is no version to bump.

## Commits

Conventional Commits, enforced by commitlint via a husky `commit-msg` hook (`feat`/`fix`/`docs`/`style`/`refactor`/`perf`/`test`/`build`/`ci`/`chore`/`revert`); body lines ≤ 100 characters. A `pre-commit` hook runs `lint-staged` (Biome) on staged files. Do not add Co-Authored-By trailers. release-please derives the version and changelog from commit types (`release-please-config.json` lists which are shown: `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`), so mark a commit breaking (`!` / `BREAKING CHANGE`) only when users must act — an automatic save migration is not breaking.
