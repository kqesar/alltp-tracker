# @alltp/pack-alttpr

The A Link to the Past Randomizer game pack: the v31 rules (Standard and Open
worlds, NoGlitches) as plain data over `@alltp/engine`, read from
[sporchia/alttp_vt_randomizer](https://github.com/sporchia/alttp_vt_randomizer)
at the commit `upstream.json` pins, and held to upstream's own test cases.

| Module | Ports |
| --- | --- |
| `src/items.ts` | `app/Item.php`, `config/item.php`: item ids, ranges, and how upstream counts them |
| `src/settings.ts` | `app/World.php`, `config/logic.php`: every config value a rule reads, and the presets |
| `src/helpers.ts` | `app/Support/ItemCollection.php`: `@canLiftRocks`, `@hasSword2`… |
| `src/bosses.ts` | `app/Boss.php`: each boss's `canBeat`, and the boss each dungeon fights |
| `src/world.ts` | `app/Region.php`: regions, entrances, prizes, `canFill` |
| `src/worlds/*.ts` | `app/World/Standard.php`, `app/World/Open.php`: the region modules of each world |
| `src/regions/**` | one module per upstream region file |
| `src/fill.ts` | `app/Location.php`: `canFill`, whether the randomizer may place an item somewhere |
| `src/keys.ts` | `app/Support/LocationCollection.php`: where a dungeon's items may sit (`itemInLocations`) |
| `src/pack.ts` | the run's world, compiled with its settings |

`upstream.json` maps every upstream file to its module, with its status;
`test/contract.ts` checks the pack against every case of the test files it
marks ported.

## The world model

Upstream has no graph. Each region is an object with a `can_enter` closure,
which may call another region's `canEnter`, and each location a closure that
runs after its region's (`Location::canAccess`). The pack turns that into the
engine's graph:

- **Regions.** Each upstream region becomes an engine region whose id is the
  camelCase of its key in `World/Standard.php` (`regionId('Tower of Hera')`
  is `towerOfHera`), so any module can name it. A module may split a region
  into parts for its own use (Turtle Rock's three ways in); a part has no
  `name`.
- **The start.** Upstream has no start region: a region whose `can_enter`
  calls no other region's is entered from anywhere. The graph starts at
  `start`, which holds nothing, and that entry is an entrance from `start`.
- **Entrances.** A region lists its ways in, its `can_enter` read as an OR of
  branches. A branch that calls `X->canEnter()` is an entrance from `X` with
  the rest of the branch; any other is an entrance from `start`; an OR gives
  several. Conditions around the OR go into each branch. East Death
  Mountain's `RescueZelda && (… || Hookshot && West->canEnter() || Hammer &&
  Hera->canEnter())` is `{ from: "westDeathMountain", req: "rescueZelda &
  hookshot" }` and `{ from: "towerOfHera", req: "rescueZelda & hammer" }`,
  its glitch branches entrances from `start`. The entrance lives in the
  module of the region it enters, as upstream's rule lives in that region's
  file. An entrance cannot `reach()` a region: the engine's single pass
  refuses it, so a cross-region condition is always the graph's.
- **Locations.** A location's `req` is its closure without its own region's
  `canEnter`, which the graph already applies. Another region's `canEnter`
  inside it is `reach(id)`; another location's `canAccess` is that location's
  rule (and `reach()` of its region if it is elsewhere). Its id is
  `locationId(name)`, its `kind` the upstream class, its `source` the line of
  its closure, or of its declaration when it has none.
- **Prizes.** A region's `can_complete` is the rule of its prize location
  (`RegionDef.prize`): the pendant or crystal of a dungeon, Zelda, Agahnim. A
  dungeon's `can_complete` is its boss's `canAccess`, so the boss and the
  prize share one rule. The tracker derives pendants, crystals, `rescueZelda`
  and `defeatAgahnim` from what the player records; the solver does not
  compute events.
- **The overworld.** No hub stands for the Light World: its three regions
  enter from `start` with `rescueZelda`, as upstream writes them. West Death
  Mountain enters from `start` (the flute, or a glove and the lamp), East
  Death Mountain from West Death Mountain and from Tower of Hera, the Dark
  World's regions from `start` (Agahnim, or the hammer and glove routes) and
  from one another, and its Death Mountain from the Light World's.
- **Standard and Open.** The two worlds list the same modules but the
  escape: `regions/open/hyrule-castle-escape.ts` replaces Standard's, as
  `app/Region/Open/HyruleCastleEscape.php` does. Open gives RescueZelda at the
  start (`Randomizer.php:133`), which the tracker's state does.
- **Settings.** A config read is a setting, folded at compile time:
  `config('itemPlacement') === 'advanced'` is `setting(advancedPlacement)`,
  `!== 'basic'` is `!setting(basicPlacement)`, `has('Lamp',
  config('item.require.Lamp', 1))` is `lamp >= setting(requireLamp)`. A glitch
  branch keeps its flag (`setting(canBootsClip) & pegasusBoots`): NoGlitches
  folds it away.
- **What a tracker cannot know.** Upstream's rules may ask where an item
  sits (`$location->hasItem(...)`); a tracker does not know the placement,
  so that test is `maybe`: "the boss holds its own compass" makes
  `!setting(wildCompasses) | compassP1 | maybe`.
- **Dungeon items.** A region's `regionItems` is its `$region_items`, which
  `canFill` keeps in it unless the class is wild.
- **Filling.** A location's `fill` is what its region file tells
  Location::canFill: the items it always takes (`setAlwaysAllow`), those its
  fill rules refuse (`setFillRules`, clause by clause), and its rule once it
  holds an item that rule asks about (`holding`): placing the item settles
  a `hasItem` the location's `req` reads as `maybe`. `filler(world,
  settings).canFill(location, item, state)` reads them as upstream does:
  always allowed, or kept by the region, not refused and reachable with the
  item there. Every dungeon boss writes the same rules, which `dungeonBoss`
  (`src/bosses.ts`) builds. The 135 `fill` cases of the upstream tests run
  in the contract.
- **Where dungeon items sit.** The randomizer places the dungeon items
  first, each where canFill holds with every item not placed yet assumed
  held, and canFill only grows with the items held. `possibleLocations`
  lists where an item may sit at all: wherever canFill is not `no` with
  everything else held (`everythingBut`). Swamp Palace's key can only be at
  its entrance; Desert Palace's, in the Map Chest, the Torch or the Big
  Chest.
- **Pending modules.** A region file not ported yet still has its module: its
  upstream regions with no entrance and no location. The worlds list every
  module from the start, so a port only fills its own module in.
