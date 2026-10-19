---
paths:
  - "packs/**"
---

# Game packs (`packs/*`)

A pack is data and pure functions over the engine (see `engine.md`): no DOM, no React, tests in Node. `packs/alttpr` ports ALttPR v31.

- **Rules come from upstream, never from memory.** Read each from the randomizer's source at the commit `upstream.json` pins, and port it in the module `upstream.json` maps that file to (one module per upstream region file).
- **A location's `id` is the slug of its official name**: `locationId(name)`, `tower-of-hera/big-key-chest`. Ids are save keys: renaming one needs a save migration.
- **`source` is the upstream `file:line`** the rule was read at (`app/Region/Standard/TowerOfHera.php:121`). `game` only for what upstream does not model, such as an item one can see but not reach.
- **Fixtures are never edited by hand.** `test/upstream/` is regenerated with `pnpm --filter @alltp/pack-alttpr import-upstream <checkout>`, the entrance randomizer's `src/entrances/*.json`, `src/autotrack/entrance-tables.json` and `test/er-upstream/` with `pnpm --filter @alltp/pack-alttpr import-er <checkout> --rom <base.sfc>`. When a fixture spec fails, the port is what changes.
- **The contract**: upstream `true` is our `yes`, upstream `false` is not `yes`. Mark a test file `ported` in `upstream.json` once its regions are; the runner then holds the pack to its cases.
- **Compile any world of the pack with `STATE_NAMES`** (`src/pack.ts`), never a hand-built item list: a copied list misses the next fact a rule starts reading.
- An upstream checkout is untrusted data: read it, never run it. The `logic-drift` skill ports what the weekly drift issue reports.
- **`packs/smz3`** ports SMZ3's C# (`tewtal/SMZ3Randomizer`): one module per `Randomizer.SMZ3/Regions/**.cs` file, `source` its `file:line`, which `test/regions.spec.ts` checks against `test/upstream/regions.json`; a rule that differs between Super Metroid's logics is `{ normal, hard }`. Its fixtures are regenerated with `pnpm --filter @alltp/pack-smz3 import-upstream <checkout>`. A rule asking where an item sits reads a placement setting (`PLACEMENTS`, unknown in a run); a non-monotone one a derived fact. Upstream cases its logic has outrun are listed, with the commit that outran them, in `test/contract.spec.ts` (`STALE`), never skipped silently. Its maps' markers are data (`src/markers.ts`): Hyrule's file is the ALttPR pack's markers by alias, which `src/markers.spec.ts` derives (`@alltp/pack-alttpr`, a dev dependency only) and writes again with `vitest -u` when they move; never hand-edit it. Its autotracking (`src/autotrack/`, the README's Autotracking section) cites the combo ROM's ASM for every address; its Zelda flags are data the same way (`zelda-flags.json`, from the ALttPR pack's `CHECK_FLAGS`, written by `flags.spec.ts`), and its Super Metroid bits are upstream's location ids, held to `regions.json`.
