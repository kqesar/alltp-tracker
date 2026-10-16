---
paths:
  - "src/stores/**"
---

# State: a single Zustand store

All game state lives in `src/stores/gameStore.ts`: `zustand` + `devtools` (development only) + `persist` (localStorage key `alltp-tracker-state`). The store holds only serializable data; the chest and dungeon tables with their predicates stay static in `src/data/`. Its shape is `Progress & Prefs` plus the undo history, both types declared in `src/stores/persistence.ts`. Transient UI state (the tooltip) lives in its own store, `tooltipStore.ts`.

- **`Progress`** — the run; "New game" (`reset`), `applyPreset` and `loadProgress` replace it.
  - `items` — keyed by item id; `boolean` (toggles) or `number` (progressive). `handleItemClick` steps `-1` for `chest*` counters and `+1` for everything else, wrapping between `itemsMin[item]` and `itemsMax[item]`. `bossN` (1 alive, 2 beaten) is the only "boss beaten" flag: the grid cell and the map marker both read and toggle it.
  - `chestsOpened` — one boolean per overworld chest, indexed by position in `chests`.
  - `smallKeys` — 10 entries capped by `SMALL_KEYS_MAX_BY_INDEX`; `medallions` — 10 entries, only 8 and 9 used.
  - `presetId` / `settings` — run type from `src/data/presets.ts`. Logic reads `settings` (e.g. `settings.keysanity`), never a display preference.
- **`Prefs`** — how this device shows the tracker (`mapLayout`: `auto` by default, `side-by-side` or `stacked`; `bigKeysVisible`). They survive a new game, a preset switch and an import. `applyPreset` changes `bigKeysVisible` only when the run's keysanity changes.

## Saves

- **Persisted shape changes** bump `PERSIST_VERSION` and add a step to `migrate` in `persistence.ts`, which upgrades localStorage and imported files alike; then update `toPersisted`, `restoreProgress` / `restorePrefs` together. Never bump the version without a migration — persist would silently drop every existing save.
- `validateProgress` checks every field against the current tables. `parseSave` (import) refuses a file with any invalid field and names it; rehydration from localStorage is lenient and keeps the valid fields.
- Exports are `{ format: "alltp-tracker-save", version, progress }`; bare objects from earlier versions still import.

## History

`past` / `future` hold earlier `Progress` snapshots for undo/redo (cap 200), never persisted. Every action that changes `Progress` goes through `record(state, next)`, which pushes the current run and clears `future`; prefs bypass it. Rehydration (first load, another tab via `crossTabSync.ts`) clears the history.

## Subscriptions

Components subscribe with selectors — `useGameStore((state) => state.items[item])` — never bare `useGameStore()`: a component re-renders only for the slice it shows. A selector must return a stable value; for several fields use one selector per field or `useShallow`.
