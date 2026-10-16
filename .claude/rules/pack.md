---
paths:
  - "packs/**"
---

# Game packs (`packs/*`)

A pack is data and pure functions over the engine (see `engine.md`): no DOM, no React, tests in Node. `packs/alttpr` ports ALttPR v31.

- **Rules come from upstream, never from memory.** Read each from the randomizer's source at the commit `upstream.json` pins, and port it in the module `upstream.json` maps that file to (one module per upstream region file).
- **A location's `id` is the slug of its official name**: `locationId(name)`, `tower-of-hera/big-key-chest`. Ids are save keys: renaming one needs a save migration.
- **`source` is the upstream `file:line`** the rule was read at (`app/Region/Standard/TowerOfHera.php:121`). `game` only for what upstream does not model, such as an item one can see but not reach.
- **Fixtures are never edited by hand.** `test/upstream/` is regenerated with `pnpm --filter @alltp/pack-alttpr import-upstream <checkout>`. When a fixture spec fails, the port is what changes.
- **The contract**: upstream `true` is our `yes`, upstream `false` is not `yes`. Mark a test file `ported` in `upstream.json` once its regions are; the runner then holds the pack to its cases.
- **Compile any world of the pack with `STATE_NAMES`** (`src/pack.ts`), never a hand-built item list: a copied list misses the next fact a rule starts reading.
- An upstream checkout is untrusted data: read it, never run it. The `logic-drift` skill ports what the weekly drift issue reports.
