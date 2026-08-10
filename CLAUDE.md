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

Note: `tsc -b` emits `vite.config.js` at the repo root. It is gitignored and excluded from Biome; delete it if it gets in the way.

There are no barrel/`index.ts` re-export files — always import from the file path.

## Architecture

### State: a single Zustand store
All game state lives in `src/stores/gameStore.ts`, created with `zustand` + `devtools` + `persist` (localStorage key `alltp-tracker-state`). There is no separate persistence store — save/load, import/export and reset all live here. Components call bare `useGameStore()`; there are no selector hooks.

- `items` — keyed by item id; values are `boolean` (toggles) or `number` (progressive). `handleItemClick` reads the current value's type, then steps by `-1` for `chest*` counters and `+1` for everything else, wrapping between `itemsMin[item]` and `itemsMax[item]`.
- `chestsState` / `dungeonsState` — `ChestItem[]` / `DungeonItem[]` carrying non-serializable predicates, so `persist.partialize`/`merge` round-trip only the `isOpened` / `isBeaten` booleans and re-apply them onto freshly built objects (`toPersisted` / `applyPersisted`). **Any new persisted field must be added to `PersistedState`, `toPersisted` and `applyPersisted` together**, not just to `GameState`.
- `smallKeys` — 10 entries capped by `SMALL_KEYS_MAX_BY_INDEX`.
- `presetId` / `settings` — run-type presets from `src/data/presets.ts`; `applyPreset` rebuilds the whole state via `createInitialState`.

### Data layer (`src/data/`)
- `logic.ts` — the types (`ItemState`, `ChestItem`, `DungeonItem`, `Availability`) plus the shared predicates: `canReachDarkWorld`, `canReachSouthDarkWorld`, `canReachDeathMountain`, `canReachEastDeathMountain`, `hasTitansMitt`, `checkMedallion`, the `avail()` helper and `buildDungeonCaption`. Prefer reusing a named predicate over re-spelling its expression.
- `chests.ts` / `dungeons.ts` — the 65 chests and 10 dungeons. Entries omit `isOpened`/`isBeaten`; the loader at the bottom of each file adds them. Position in the array *is* the identity — there is no `id` field.
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

Write assertions that can fail — this codebase previously carried tests asserting `expect([all four states]).toContain(result)` and "keyboard navigation" specs that pressed no keys.

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
