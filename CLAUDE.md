# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Link to the Past Tracker — a React 19 + TypeScript web app for tracking item/dungeon/chest progress in ALttP Randomizer playthroughs. Package manager is **pnpm**, pinned by `packageManager` in `package.json` (pnpm switches to that version itself; CI reads it too); Node `>=22.0.0`. Build scripts are denied by default, so a dependency that needs one (esbuild) is listed under `allowBuilds` in `pnpm-workspace.yaml`.

## Commands

```bash
pnpm dev                     # Start dev server (vite)
pnpm build                   # tsc -b && vite build
pnpm lint                    # Biome check
pnpm lint:fix                # Biome check --write
pnpm test                    # Run tests once (vitest run)
pnpm test:coverage           # Run tests with coverage
pnpm test:coverage:show      # Coverage + formatted terminal table
pnpm coverage                # Show existing coverage table without rerunning
```

Run a single test file: `pnpm vitest run src/stores/gameStore.spec.ts`
Run tests matching a name: `pnpm vitest run -t "some test name"`

Note: `tsc -b` emits `vite.config.js` at the repo root. It is gitignored and excluded from Biome; delete it if it gets in the way.

There are no barrel/`index.ts` re-export files — always import from the file path.

## Architecture

### State: a single Zustand store
All game state lives in `src/stores/gameStore.ts`, created with `zustand` + `devtools` (development only) + `persist` (localStorage key `alltp-tracker-state`). The store holds only serializable data; the chest and dungeon tables with their predicates stay static in `src/data/`. Its shape is `Progress & Prefs` plus the transient `caption`, both types declared in `src/stores/persistence.ts`:

- **`Progress`** — the run; "New game" (`reset`), `applyPreset` and `importState` replace it.
  - `items` — keyed by item id; values are `boolean` (toggles) or `number` (progressive). `handleItemClick` reads the current value's type, then steps by `-1` for `chest*` counters and `+1` for everything else, wrapping between `itemsMin[item]` and `itemsMax[item]`. `bossN` (1 alive, 2 beaten) is the only "boss beaten" flag: the grid cell and the map marker both read and toggle it.
  - `chestsOpened` — one boolean per overworld chest, indexed by position in `chests`.
  - `smallKeys` — 10 entries capped by `SMALL_KEYS_MAX_BY_INDEX`; `medallions` — 10 entries, only 8 and 9 used.
  - `presetId` / `settings` — run-type presets from `src/data/presets.ts`. Logic reads `settings` (e.g. `settings.keysanity`), never a display preference.
- **`Prefs`** — how this device shows the tracker (`mapLayout`, `bigKeysVisible`). They survive a new game, a preset switch and an import. `applyPreset` changes `bigKeysVisible` only when the run's keysanity changes.

**Persisted shape changes** bump `PERSIST_VERSION` and add a step to `migrate` in `persistence.ts`, which also upgrades imported files; then update `toPersisted`, `restoreProgress` / `restorePrefs` together. Never bump the version without a migration — persist would silently drop every existing save.

Components subscribe with selectors — `useGameStore((state) => state.items[item])` — and never call bare `useGameStore()`: a component must re-render only for the slice it shows. Tests reset the store with `useGameStore.setState(useGameStore.getInitialState(), true)`.

### Data layer (`src/data/`)
- `logic.ts` — the types (`ItemState`, `ChestItem`, `DungeonItem`, `Availability`) plus the shared predicates: `canReachDarkWorld`, `canReachSouthDarkWorld`, `canReachDeathMountain`, `canReachEastDeathMountain`, `hasTitansMitt`, `checkMedallion`, the `avail()` helper and `buildDungeonCaption`. Prefer reusing a named predicate over re-spelling its expression.
- `chests.ts` / `dungeons.ts` — the 64 chests and 10 dungeons, static: progress lives in the store. Position in the array *is* the identity — there is no `id` field — so the persisted `chestsOpened` follows that order, and reordering or removing an entry needs a save migration.
- `items.ts` — one `[min, max, initial?]` range table from which `items`, `itemsMin` and `itemsMax` are derived, plus `itemLabels` for accessibility names. Do not reintroduce parallel tables.
- `presets.ts` — run types (`getPreset`, `presets`, `describeSettings`).

### Components (`src/components/`)
- `tracker/` — `TrackerGrid` → `grid/GridItem` (routes: empty → spacer, `bigkey*` → `BigKeyCell`, else → `Item`) → `items/Item`, which renders boss overlays when the id starts with `boss`.
- `tracker/overlays/BossOverlays.tsx` — one `Overlay` skeleton behind `CounterOverlay` (chest count and reward) and `MedaillonOverlay`.
- `tracker/items/KeyToggle.tsx` — the keysanity big-key and small-key buttons, one component with a `variant` prop.
- `map/MapMarkers.tsx` — one `Marker` handling position, icon and hover caption; `MapChest`, `DungeonBoss` and `DungeonChest` supply only their availability rule. Marker coordinates are authored against the side-by-side asset and re-projected by `transformMapCoordinates` when `mapLayout` is `stacked`; the matching CSS lives under `.layout--stacked` in `map.css` and repaints the single map asset as two rows.
- `ui/` — `Header`, `Caption`, `Modal`, `ConfirmDialog`, `PresetSelector`, `TrackerControls`, `BigKeyToggle`.

### Tests
`src/data/logic.characterization.spec.ts` snapshots chest availability, dungeon chest access and beatability across 15 item states. **It is a refactor guard: if the snapshot moves without an intended rule change, the change is wrong. Never update it to make the suite pass.**

Write assertions that can fail — this codebase previously carried tests asserting `expect([all four states]).toContain(result)` and "keyboard navigation" specs that pressed no keys. Never guard an assertion with `if (found.length > 0)`: a query that finds nothing must fail the test.

Locate elements with `data-testid` (`getByTestId`, `getAllByTestId(/^chest-marker-/)`), not by CSS class, inline style or array position in `getAllByRole("button")`. Test ids are kebab-case `<kind>-<id>`: `item-hookshot`, `chest-marker-3`, `boss-marker-0`, `chest-overlay-0`, `medallion-overlay-8`. Then assert accessibility on the element found — `toHaveAccessibleName`, its role — so the test still covers what a screen reader hears.

## Conventions

- Import via the `@/` alias (`tsconfig.json` and both vite/vitest configs map `@` → `src`).
- CSS class names are written literally in the JSX; there is deliberately no `CSS_CLASSES` map. `src/constants/index.ts` holds only values with game meaning.
- CSS Grid for layout, never tables; empty cells render a spacer rather than `null`.
- Interactive elements are semantic `<button>`s with `aria-label`. A native button fires click on Enter and Space, so do not add key handlers for them.
- Styles live in `src/styles/`, all imported by `styles/index.css`, which `main.tsx` alone imports. `reset.css` must stay first in that list — it sits at the base of the cascade.
- Biome (not ESLint/Prettier) handles lint + format and sorts imports and object keys.
- Coverage thresholds in `vitest.config.ts` are floors just below current coverage.

## Commits

Conventional Commits, enforced by commitlint via a husky `commit-msg` hook (`feat`/`fix`/`docs`/`style`/`refactor`/`perf`/`test`/`build`/`ci`/`chore`/`revert`). `pnpm commit` runs commitizen. A `pre-commit` hook runs `lint-staged` (Biome) on staged files. Do not add Co-Authored-By trailers.
