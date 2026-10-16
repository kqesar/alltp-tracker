---
paths:
  - "apps/web/src/data/**"
  - "apps/web/src/constants/**"
---

# Game data and logic (`apps/web/src/data/`)

- `logic.ts` — the types (`ItemState`, `ChestItem`, `DungeonItem`, `Availability`) and the shared predicates (`canReachDarkWorld`, `canReachSouthDarkWorld`, `canReachDeathMountain`, `canReachEastDeathMountain`, `hasTitansMitt`, `checkMedallion`, `avail()`, `buildDungeonCaption`). Reuse a named predicate rather than re-spelling its expression.
- `chests.ts` / `dungeons.ts` — the 64 chests and 10 dungeons, static: progress lives in the store. Position in the array *is* the identity — there is no `id` field — so the persisted `chestsOpened` follows that order; reordering or removing an entry needs a save migration (see `stores/persistence.ts`).
- `items.ts` — one `[min, max, initial?]` range table from which `items`, `itemsMin` and `itemsMax` are derived, plus `itemLabels` for accessibility names. Do not reintroduce parallel tables.
- `presets.ts` — run types (`getPreset`, `presets`, `describeSettings`). `logicSupported` must be false for any preset whose rules the logic does not actually model.
- `apps/web/src/constants/index.ts` holds only values with game meaning.

## Rules are ported, not remembered

The current predicates date from the 2017 tracker and are known to diverge from ALttPR v31. Rule changes are ported from the randomizer's own source (sporchia/alttp_vt_randomizer; v31 read at commit `219fcafd`), citing the file and function, and noting the item-placement variant (Advanced is the site default; Basic adds gates). Example: the Hammer beats most bosses, but not Helmasaur (needs a sword or bow) nor Agahnim 1 in swords mode.

## Refactor guard

`logic.characterization.spec.ts` encodes chest availability, dungeon chest access and beatability across 15 item states. If it moves without an intended rule change, the change is wrong — never update it to make the suite pass. An intended rule change updates it in the same commit, and the commit message names each rule that moved and its source.
