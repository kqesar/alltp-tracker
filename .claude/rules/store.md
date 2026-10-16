---
paths:
  - "apps/web/src/stores/**"
---

# State: a single Zustand store

All game state lives in `apps/web/src/stores/gameStore.ts`: `zustand` + `devtools` (development only) + `persist` (localStorage key `alltp-tracker-state`). The store holds only serializable data; the rules are the alltpr pack's, solved from it by a memoized selector (`apps/web/src/logic/solution.ts`), never kept in a store. Its shape is `Progress & Prefs` plus the undo history, both types declared in `apps/web/src/stores/persistence.ts`. Transient UI state lives in its own stores, never saved or undone: the tooltip (`tooltipStore.ts`), the keyboard layout map (what each key types, for labels) in `keyboardLayoutStore.ts`, a waiting new version (`updateStore.ts`, which also registers the service worker), and autotracking (`autotrackStore.ts`: the one session per page, loaded lazily on Connect, its status and last decoded reading; only `connectOnStart` is saved, under `alltp-tracker-autotrack`; the stream view never connects).

- **`Progress`** — the run; "New game" (`reset`), `applyPreset` and `loadProgress` replace it.
  - `items` — keyed by item id; `boolean` (toggles) or `number` (progressive). `handleItemClick` steps `-1` for `chest*` counters and `+1` for everything else, wrapping within `itemRange(item, settings)`: a dungeon counter counts its items left from `counterMax` (every location with keysanity), the rest from `itemsMin` to `itemsMax`. `bossN` (1 alive, 2 beaten) is the only "boss beaten" flag: the grid cell and the map marker both read and toggle it. `bigkeyN`, `mapN` and `compassN` (0 or 1) are a dungeon's own items; the grid shows the map and compass in keysanity runs only, where the boss wants them.
  - `checked` — the locations checked on the map, by the pack's ids (`{ "kings-tomb": true }`); `toggleChecks` checks a marker's locations together, or none once all are. A dungeon's own locations are counted by its counter instead.
  - `smallKeys` — 10 entries, each capped by its dungeon's small keys in the pack (`SMALL_KEYS_MAX` in `logic/settings.ts`: Eastern Palace has none, so no toggle); `medallions` — 10 entries, only 8 and 9 used.
  - `presetId` / `settings` — run type from `apps/web/src/data/presets.ts`. Logic reads `settings` (e.g. `settings.keysanity`), never a display preference.
- **`Prefs`** — how this device shows and drives the tracker (`mapLayout`: `auto` by default, `side-by-side` or `stacked`; `bigKeysVisible`; `shortcuts`). They survive a new game, a preset switch and an import, and stay out of save files and the undo history. `applyPreset` changes `bigKeysVisible` only when the run's keysanity changes.
  - `shortcuts` — `{ enabled, keymap }`, one self-contained object so a later save format or the desktop app can carry it as is. The model lives in `apps/web/src/data/keymap.ts` (plain data, no DOM): `keymap` maps an action (`advance:hookshot`, `back:chest3`) to a chord (`Shift+KeyW`: modifiers, then a `KeyboardEvent.code`). `restoreShortcuts` validates a saved one.

## Saves

- **Persisted shape changes** bump `PERSIST_VERSION` and add a step to `migrate` in `persistence.ts`, which upgrades localStorage and imported files alike; then update `toPersisted`, `restoreProgress` / `restorePrefs` together. Never bump the version without a migration — persist would silently drop every existing save.
- `validateProgress` checks every field against the current tables. `parseSave` (import) refuses a file with any invalid field and names it; rehydration from localStorage is lenient and keeps the valid fields.
- Exports are `{ format: "alltp-tracker-save", game: "alttpr", version, progress }` (localStorage also keeps `game`); a file of another game is refused, and bare objects from earlier versions still import. Version 6 checked locations by the pack's ids: its migration expands each version 5 chest flag through the pack's `LEGACY_CHESTS` and carries a keysanity counter's items found. Version 7 takes the small-key maxima from the pack: its migration brings Eastern Palace's count, which could be 1, to 0. An item id added to `items` needs no version: a save without it restores it at its fresh value, and an older version ignores it.

## History

`past` / `future` hold earlier `Progress` snapshots for undo/redo (cap 200), never persisted. Every action that changes `Progress` goes through `record(state, next)`, which pushes the current run and clears `future`; prefs bypass it. Rehydration (first load, another tab via `crossTabSync.ts`) clears the history.

## Subscriptions

Components subscribe with selectors — `useGameStore((state) => state.items[item])` — never bare `useGameStore()`: a component re-renders only for the slice it shows. A selector must return a stable value; for several fields use one selector per field or `useShallow`.
