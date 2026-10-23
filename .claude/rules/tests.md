---
paths:
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "apps/web/src/test-setup.ts"
  - "**/vitest.config.ts"
  - "apps/web/vitest.*.ts"
  - "apps/web/e2e/**"
  - "apps/web/playwright.config.ts"
---

# Tests

- **Assertions must be able to fail.** This codebase once asserted `expect([all four states]).toContain(result)` and had "keyboard navigation" specs that pressed no keys. Never guard an assertion with `if (found.length > 0)`: a query that finds nothing must fail. When fixing a bug, check the new test fails without the fix.
- **Locate with `data-testid`** (`getByTestId`, `getAllByTestId(/^marker-/)`), not CSS classes, inline styles or positions in `getAllByRole("button")`. Ids are kebab-case `<kind>-<id>`: `item-hookshot`, `marker-kings-tomb` (a map marker, by the pack's id), `boss-marker-eastern-palace` and `dungeon-marker-eastern-palace` (a dungeon's, by the pack's dungeon id), `chest-overlay-0`, `medallion-overlay-8`, `import-file`. Then assert accessibility on the element found (`toHaveAccessibleName`, role) so the test still covers what a screen reader hears.
- **Reset the store** in `beforeEach` with `useGameStore.setState(useGameStore.getInitialState(), true)` (and `localStorage.clear()` when persistence matters). Two specs mock `@/games/alttpr/stores/gameStore` entirely with a selector-calling `vi.fn()`; keep their fake state in step with the store's fields.
- **Autotracking specs** share the session's fakes from `apps/web/src/autotrack/fixtures.ts` (a status of each code, `ManualClock`, `FakeVisibility`, `FakeLocks`, `GRANTED`); a game's console memory is its own: ALttPR's in `games/alttpr/autotrack/fixtures.ts`, Super Metroid's `writeMapRando` in `packs/sm/test/sm-rom.ts`. Browser tests drive the real WebSocket through `packages/autotrack/test/fake-usb2snes.ts`.
- **The `web` project runs in `vmThreads`**: one jsdom per worker, a vm context per file (a third of the CPU saved). `window.location` cannot be replaced there, as in a browser: reach what a spec must fake through a seam (`page.reload` in `components/ui/lazyDialog.tsx`, `switchGame`'s `reload` parameter). Code runs slower in a vm context, so the timing specs (`*.performance.spec.ts`) are the `web-perf` project (`apps/web/vitest.perf.config.ts`, `forks`); a new timing spec takes that suffix. Both projects share `apps/web/vitest.shared.ts`.
- jsdom has `<dialog>` but not `showModal()` / `close()`; `apps/web/src/test-setup.ts` stubs them by toggling `open`. Escape is simulated by dispatching a cancelable `cancel` event on the dialog.
- `apps/web/src/games/alttpr/logic/alttpr.snapshot.spec.ts` is a refactor guard (see `.claude/rules/data.md`): never update it to make the suite pass.
- **Browser tests** live in `apps/web/e2e/*.e2e.ts` (Playwright + `@axe-core/playwright`, Chromium, production build under `/alltp-tracker/`). One page load per width carries every check for that width, to keep the run short. A known defect is pinned with `test.fail(condition, reason)`: the test turns red the moment the defect is fixed, so the fixing commit must drop the marker. CI runs them parallel to the unit tests, split over three runners (`--shard`, the count set by the matrix in `ci.yml`; one runner's cores are saturated by two browsers, so more workers do not help), on the runner's preinstalled Chrome.
- Coverage thresholds in the root `vitest.config.ts` (measured over every workspace) are floors just below current coverage; raise them when coverage rises.
