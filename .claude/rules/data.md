---
paths:
  - "apps/web/src/data/**"
  - "apps/web/src/logic/**"
  - "apps/web/src/constants/**"
---

# Game data and logic (`apps/web/src/data/`, `apps/web/src/logic/`)

The rules are the alltpr pack's (`packs/alttpr`, ALttPR v31): the app holds no predicate of its own. It reads the pack through `apps/web/src/logic/`:

- `logic/settings.ts` — what the app's run types mean to the pack (`packSettings`: NoGlitches and randomized weapons in the Open, Standard or Inverted world (`worldOf` names it, the key of what is kept per world), with the run's goal, crystals, swords, item placement, accessibility, item pool and functionality, its dungeon items (`dungeonItems`: standard, mc, mcs or full, which of them may leave their dungeons)), the grid's dungeon indices (`dungeonAt`, `dungeonName`, by the pack's `LEGACY_DUNGEONS`) and where each dungeon counter starts (`counterMax`, from `dungeonItemCount`).
- `logic/packItems.ts` — `PACK_ITEMS`, the one table from each of the tracker's item ids to what its value records for the pack (an item and how it counts, a dungeon beaten, a prize, nothing). `packReading` reads a run through it and `itemsFromPack` turns pack item counts (an autotracker's reading) back into the tracker's values. `RECORDED_LEVELS` lists every pack item the cells can record, at the highest level they reach: what the blockers may propose. An item added to `data/items.ts` gets its entry here, and every reader picks it up; its spec holds the table to the pack's legacy copy for the version 5 ids.
- `logic/solution.ts` — the run solved: `trackerInput` reads the store's items (through `packReading`), pads and keys as the pack's `TrackerInput`; `solutionOf` runs `toState` and the key model (`solveWithKeys`) in the world compiled once per settings, memoized on the four slices it reads and the events checked (the pack's `EVENT_CHECKS`: the Bomb Merchant, whose big bomb Inverted's Pyramid Fairy wants), with no second store. The solution keeps each location's tri and what can be seen of it (the engine's visible channel). Markers and dungeons read it through `markerStateOf` (`locationStatus`: available > possible > seen > unavailable, seen being out of logic but in sight), `dungeonStateOf` (the pigeonhole rule over a counter), `bossStateOf` and the hooks `useLocationStatus`, `useMarkerStatus`, `useDungeonStatus`, `useBossStatus`, which return strings so a click re-renders only what it changed. `locationStateOf` is one location's: done once checked.
- `logic/checks.ts` — the Checks list's model: `zonesOf` groups the map's locations by zone in upstream's world order (a dungeon's under its name, Hyrule Castle for upstream's Escape; any other under its region's), memoized per world; `checkStates` says what each shows, every check of a dungeon whose counter is 0 done.
- `logic/missing.ts` — what each check not in logic is missing and the go mode's blockers (`analyzeRun`: the engine's `analyze` and `explain` in the state with every untracked key held, proposing only `RECORDED_LEVELS`), and `goModeStatusOf`, memoized on the solution. `analyzeRun` costs milliseconds for the world, so it never runs on a click: `hooks/useRunAnalysis.ts` schedules it at idle into `stores/analysisStore.ts`.
- `logic/timeline.ts` — when each thing held was found: the `Stamp` of a change (`stampOf`, read off the run timer of `logic/timer.ts`), `stampTimeline` (what a change of the run's items and checks adds to or drops from the timeline; the same object when nothing dated changed), and what a save's timeline may hold (`isTimelineKey`, `isStamp`). The store keeps it in `Progress` (`.claude/rules/store.md`).
- `logic/voice.ts` — the voice commands: every phrase (`COMMANDS`, built from the shortcut controls `CONTROLS` with the words players say them by) and what it does, the recognizer's grammar (`GRAMMAR`: each phrase after the wake word `tracker`, then `[unk]`), `commandsOf` (a recognized text's commands, none without the wake word) and `changedValue` (a find, not a click: a toggle held, a level up never round to none, a bit added, a named level never lowered, a dungeon count down never below none). Its words must be in the speech model's dictionary (vosk-model-small-en-us-0.15): a name it lacks is spoken as words it has ("samaria", "bom boss", "gannon tower"). Adding a control to `CONTROLS` fails its spec until a phrase reaches it.
- `logic/needs.ts` — the engine's blockers in the tracker's words: each atom as the name and icon the player knows (`waysOf`, `sameWays`).

`apps/web/src/data/`:

- `items.ts` — `ItemState`, and one `[min, max, initial?]` range table from which `items`, `itemsMin` and `itemsMax` are derived, plus `itemLabels` for accessibility names. Do not reintroduce parallel tables. The ids are the tracker's own, which `logic/packItems.ts` maps to the pack's (old saves go through the pack's frozen legacy copy, which `legacy.spec.ts` holds the table to): a dungeon counter's top follows the run's settings (`itemRange` in `stores/persistence.ts`), and `agahnim2` (Ganon's Tower's boss, on its map marker and its grid cell) is the one id version 6 added; `chest12` (Ganon's Tower's items left) came with its cell.
- `keymap.ts` — the keyboard shortcuts, as plain data.
- `presets.ts` — run types (`getPreset`, `presets`, `describeSettings`). `logicSupported` must be false for any preset whose rules the pack does not actually model.
- `apps/web/src/constants/index.ts` holds only values with game meaning.

## Rules are ported, not remembered

A rule changes in the pack, ported from the randomizer's own source (sporchia/alttp_vt_randomizer at the commit `packs/alttpr/upstream.json` pins) and held to its official tests: see `.claude/rules/pack.md`. The app maps settings and what the player records; it never re-spells a rule.

## Refactor guard

`logic/alttpr.snapshot.spec.ts` freezes what the map shows (every marker, every dungeon's counter and boss) across 15 item states, those the 2017 logic's characterization spec froze. If it moves without an intended rule change, the change is wrong — never update it to make the suite pass. An intended change (a rule ported from upstream, a pack fix) updates it in the same commit, and the commit message names each marker that moved and the upstream source of its rule.
