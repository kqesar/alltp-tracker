---
paths:
  - "apps/web/src/data/**"
  - "apps/web/src/logic/**"
  - "apps/web/src/constants/**"
---

# Game data and logic (`apps/web/src/data/`, `apps/web/src/logic/`)

The rules are the alltpr pack's (`packs/alttpr`, ALttPR v31): the app holds no predicate of its own. It reads the pack through `apps/web/src/logic/`:

- `logic/settings.ts` — what the app's run types mean to the pack (`packSettings`: the site's default preset in the Open or Standard world, its goal, keysanity as `dungeonItems: 'full'`), the grid's dungeon indices (`dungeonAt`, `dungeonName`, by the pack's `LEGACY_DUNGEONS`) and where each dungeon counter starts (`counterMax`, from `dungeonItemCount`).
- `logic/solution.ts` — the run solved: `trackerInput` reads the store's items (the tracker's ids, through the pack's legacy table), bosses, prizes, pads and keys as the pack's `TrackerInput`; `solutionOf` runs `toState` and the key model (`solveWithKeys`) in the world compiled once per settings, memoized on the four slices it reads, with no second store. Markers and dungeons read it through `markerStateOf`, `dungeonStateOf` (the pigeonhole rule over a counter), `bossStateOf` and the hooks `useLocationStatus`, `useMarkerStatus`, `useDungeonStatus`, `useBossStatus`, which return strings so a click re-renders only what it changed.

`apps/web/src/data/`:

- `items.ts` — `ItemState`, and one `[min, max, initial?]` range table from which `items`, `itemsMin` and `itemsMax` are derived, plus `itemLabels` for accessibility names. Do not reintroduce parallel tables. The ids are the tracker's own, which the pack's frozen legacy copy maps (`legacy.spec.ts` holds the two together): a dungeon counter's top follows the run's settings (`itemRange` in `stores/persistence.ts`), and `agahnim2` (Ganon's Tower's boss, on its map marker only) is the one id version 6 added.
- `keymap.ts` — the keyboard shortcuts, as plain data.
- `presets.ts` — run types (`getPreset`, `presets`, `describeSettings`). `logicSupported` must be false for any preset whose rules the pack does not actually model.
- `apps/web/src/constants/index.ts` holds only values with game meaning.

## Rules are ported, not remembered

A rule changes in the pack, ported from the randomizer's own source (sporchia/alttp_vt_randomizer at the commit `packs/alttpr/upstream.json` pins) and held to its official tests: see `.claude/rules/pack.md`. The app maps settings and what the player records; it never re-spells a rule.

## Refactor guard

`logic/alttpr.snapshot.spec.ts` freezes what the map shows (every marker, every dungeon's counter and boss) across 15 item states, those the 2017 logic's characterization spec froze. If it moves without an intended rule change, the change is wrong — never update it to make the suite pass. An intended change (a rule ported from upstream, a pack fix) updates it in the same commit, and the commit message names each marker that moved and the upstream source of its rule.
