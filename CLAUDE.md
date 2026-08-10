# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Link to the Past Tracker — a React 19 + TypeScript web app for tracking item/dungeon/chest progress in ALttP Randomizer playthroughs. Package manager is **pnpm** (required, `>=10.0.0`; Node `>=22.0.0`).

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

There is no `index.ts` barrel/export pattern anywhere — always import components/hooks/utils directly from their file path.

## Architecture

### State: single Zustand store
All game state lives in one store, `src/stores/gameStore.ts`, created with `zustand` + `devtools` + `persist` middleware (localStorage key `alltp-tracker-state`). There is no separate persistence store — save/load, import/export, and reset all live here.

- `items` — an `ItemState` object (from `src/data/items.ts`) keyed by item id; values are `boolean` (toggle items) or `number` (progressive items, e.g. sword 0-4, glove 0-2). `handleItemClick` inspects the current value's type to decide toggle-vs-increment behavior, wrapping at `itemsMin`/`itemsMax` from `src/data/items.ts`. Chest items (`chest0`..`chest9`) decrement instead of increment.
- `chestsState` / `dungeonsState` — arrays of `ChestItem`/`DungeonItem` (from `src/data/chests.ts`). These carry non-serializable methods (`isAvailable`, `isBeatable`, etc.), so the store's `persist.partialize`/`merge` only round-trip the boolean flags (`isOpened`, `isBeaten`) and re-apply them onto freshly-constructed objects on load (`applyPersisted`/`toPersisted` in gameStore.ts). When adding new persisted fields, extend `PersistedState` and both of these functions together, not just the `GameState` interface.
- `smallKeys` — fixed-length array of 10 (one per dungeon, indexed via `DUNGEON_INDICES`), capped per-dungeon by `SMALL_KEYS_MAX_BY_INDEX` (`src/constants`).
- `presetId`/`settings` (`RunSettings` from `src/data/presets.ts`) — run-type presets (e.g. keysanity) applied via `applyPreset`, which rebuilds the whole state via `createInitialState`.
- Prefer the exported selector hooks (`useItems`, `useChests`, `useDungeons`, `useMedallions`, `useCaption`, `useGameActions`) over destructuring the whole store, to avoid unnecessary re-renders. `useGameActions` uses `useShallow` — follow that pattern for any new grouped-action selector.

### Data layer (`src/data/`)
- `items.ts` — item definitions, the tracker grid layout, and per-item min/max values.
- `chests.ts` — chest and dungeon definitions plus their accessibility logic (`isAvailable`/`isBeatable` predicates driven by current `items`/`medallions`), and `buildDungeonCaption`.
- `presets.ts` — run-type presets (`RunSettings`, `getPreset`, `DEFAULT_PRESET_ID`).
- `tooltips.ts` — tooltip copy for items/dungeons.

### Components (`src/components/`)
- `tracker/` — the CSS Grid item panel. `TrackerGrid` → `grid/GridRow` (renders with `display: contents` to participate in the parent grid) → `grid/GridItem` (renders a spacer `div` for empty cells instead of `null`, to keep column alignment) → `items/RegularItem` / `items/BossItem` / `items/BigKey` / `items/SmallKey`.
- `map/` — `MapTracker` (interactive overworld/dungeon map), `MapChest`, `DungeonChest`, `DungeonBoss`, `MapLegend`. Coordinates are percentage-based and run through `transformMapCoordinates` (`src/utils/index.ts`) to support the vertical/split map orientation.
- `tracker/overlays/` — `ChestOverlay` (remaining chest count), `RewardOverlay` (crystal/pendant), `MedaillonOverlay` (Bombos/Ether/Quake requirement for Misery Mire / Turtle Rock).
- `ui/` — `Header`, `Caption`, `Modal`, `ConfirmDialog`, `PresetSelector`, `TrackerControls`, `BigKeyToggle`.

Every component has a co-located `*.spec.tsx`. Broader interaction tests live under `src/integration/*.integration.spec.tsx` (keyboard navigation, mobile gestures, grid wiring).

### Hooks (`src/hooks/`)
`useKeyboardNavigation` (arrow-key/Tab grid navigation with wrap-around, uses `data-grid-row`/`data-grid-col` attributes), `useDeviceDetection`, `useTouchGestures`.

### Constants (`src/constants/index.ts`)
All magic numbers, CSS class name strings, asset names, and config values are centralized here (`CSS_CLASSES`, `DUNGEON_INDICES`, `MAP_COORDINATES`, `SMALL_KEYS_MAX_BY_INDEX`, etc.). Don't hardcode values already covered here.

## Conventions

- **Imports**: use the `@/` alias (`@/components/...`, `@/stores/gameStore`, `@/data/...`, `@/constants`, `@/utils`) instead of relative paths (`tsconfig.json` and both vite/vitest configs map `@` → `src`).
- **No HTML tables for layout, no `null` for empty grid cells** — use CSS Grid + spacer elements (see `GridItem.tsx`).
- Interactive grid elements are semantic `<button>`s with `aria-label`s; keep new interactive elements keyboard-accessible and screen-reader friendly (WCAG-focused project).
- Biome (not ESLint/Prettier) handles lint + format; `biome.json` auto-organizes imports on save/check. Run `pnpm lint:fix` before committing.
- Styles are modular CSS files under `src/styles/`, imported through `src/styles/index.css`.
- Coverage thresholds are enforced in `vitest.config.ts` (branches 55 / functions 80 / lines 75 / statements 72) — these are floors slightly below current coverage to catch regressions, not aspirational targets.

## Commits

Conventional Commits are enforced by commitlint via a husky `commit-msg` hook (`type(scope): description`, types: feat/fix/docs/style/refactor/perf/test/build/ci/chore/revert). `pnpm commit` runs commitizen for a guided commit message. A `pre-commit` hook runs `lint-staged` (Biome) on staged files.
