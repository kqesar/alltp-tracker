# @alltp/pack-smz3

SMZ3 as [samus.link](https://samus.link) generates it: the logic of both games, A Link to the Past and Super Metroid, as data over `@alltp/engine`, held to the randomizer's own logic tests.

Read from [`tewtal/SMZ3Randomizer`](https://github.com/tewtal/SMZ3Randomizer) (MIT) at the commit `upstream.json` pins: `production`, `d53be76` (11.3.2). samus.link and beta.samus.link both run it; about 97 % of racetime.gg's SMZ3 races of 2025-2026 used one of them.

| Module | What | Upstream |
| --- | --- | --- |
| `src/regions/{sm,zelda}/*.ts` | the 40 regions and 316 locations, one module per region file | `Randomizer.SMZ3/Regions/**` |
| `src/helpers.ts` | the item helpers, the portals between the games, the rewards | `Item.cs` (ProgressionExtensions), `World.cs` (CanAcquire) |
| `src/items.ts` | the items the logic reads and their most | `Item.cs` (Progression, the pools) |
| `src/settings.ts` | a run's settings, and the item placements rules ask about | `Config.cs`, `RandomizerOptions.cs` |
| `src/medallions.ts`, `src/derived.ts` | the facts a state carries beside the items | `MiseryMire.cs`, `TurtleRock.cs`, `PalaceOfDarkness.cs`, `IcePalace.cs` |
| `src/world.ts`, `src/pack.ts` | the graph, compiled for a run | `Region.cs`, `Location.cs` |
| `scripts/import-upstream-tests.mjs` | upstream's tests as JSON fixtures | `Randomizer.SMZ3.Tests/Logic/**` |
| `src/markers.ts` | where the maps draw each location: Zebes's markers, Hyrule's by world, `ZELDA_ALIASES` | VARIA's map (`theonlydude/RandomMetroidSolver`, MIT), `@alltp/pack-alttpr`'s markers |
| `src/autotrack/*.ts` | autotracking: the memory map, its modes, the race profile, the decoders | `tewtal/alttp_sm_combo_randomizer_rom` (the combo ROM's ASM), `Patch.cs` |

Hyrule's markers are the ALttPR pack's, by alias, kept as data (`src/markers-hyrule.json`): `src/markers.spec.ts` derives them from `@alltp/pack-alttpr`, a dev dependency only, and holds the file to them. When ALttPR's markers move, that spec fails; `pnpm vitest run -u packs/smz3/src/markers.spec.ts` writes the file again. Importing them instead would make every SMZ3 board download ALttPR's world, 140 kB, for their coordinates.

## The world model

```mermaid
flowchart LR
  start((start)) -->|items| lwdmw[Light World Death Mountain West]
  lwdmw -->|hookshot, or hammer and mirror| lwdme[Light World Death Mountain East]
  lwdme -->|medallion, sword, somaria...| tr[Turtle Rock]
  start -->|"Norfair's way in, or the portal (flute, or glove and lamp)"| nuw[Norfair Upper West]
  nuw -->|gravity, power bombs| mi[Maridia Inner]
  mi -->|"Draygon beaten (Space Jump's rule)"| ce[Crateria East]
  start -->|"@canAccessMaridiaPortal..."| ce
```

Both games are one graph, as the engine's README plans for SMZ3. A region's `CanEnter` becomes its entrances. A branch that calls another region's (`World.CanEnter("...")`, or a location's `Available`) comes from that region; any other comes from `start`. The portals between the games are conditions on the items (`@canAccessNorfairUpperPortal`...), not regions, so the graph has no cycle across games.

- **Super Metroid's two logics.** Most SM rules differ between Normal and Hard (`Logic switch { Normal => ..., _ => ... }`). A rule may be `{ normal, hard }`, and the world of a run takes the one its logic asks for (`pick`).
- **Keysanity** stays a setting of the engine: `Config.Keysanity ? a : b` is `ifKeysanity(a, b)`. Without keysanity, upstream never places the keycards and holds every one, so `toState` adds them all.
- **Rewards.** Upstream asks whether the boss holding a pendant, a crystal or a boss token can be beaten (`World.CanAcquire`), since its filler knows which boss holds which. A tracker counts the rewards found instead (`pendantGreen`, `crystalRed`, `tokenKraid`...), which is what the game itself checks.
  - Agahnim alone is computed: Castle Tower always holds it (`@agahnim`).
  - Upstream's tests run a world whose bosses hold nothing, where every reward check passes; the setting `rewardsPlaced`, false only there, says so.
- **Placements.** A few dungeon rules ask what item sits at a location (`GetLocation(...).ItemIs(KeyPD)`), which a tracker does not know.
  - Each such placement is a setting (`PLACEMENTS`): unknown in a run, so the rule reads as maybe, and known in the tests that place it.
- **Facts.** The medallion pads are what the player knows (`mireIsEther`, `mireUnknown`), as in the ALttPR pack.
  - Palace of Darkness's and Ice Palace's non-monotone key rules read facts derived from the items (`podNoHammerBowLamp`, `ipNoBigKey`). A state recomputes these on every change, so every rule stays monotone within one state.

## The contract

`test/upstream/` holds upstream's four logic fixtures (Normal and Hard SM logic, with and without keysanity), 5,490 cases, written by the importer from a checkout. Upstream's code is read, never run. LogicTests.cs asserts each case minimal: with all it lists, the region (`CanEnter`) or the location (`CanAccess`, its own rule alone) is reachable; without any one of them, it is not. `test/contract.spec.ts` holds the pack to every case: upstream's `true` is `yes`, its `false` anything but `yes`. A location's case runs in a world where every location sits at the start (`locationsAtStart`), as upstream reads the rule alone. The regions it may reach stay in the graph.

**Cases the logic outran.** Commit `3dc171c` (2022-04-29) added `&& (items.Gravity || items.Ice || items.HiJump && items.SpringBall)` to yellow Maridia's three rules, after the tests' last change (2022-02-18). The cases without those items no longer hold upstream either: its CI only publishes and never runs the tests. The pack follows the logic samus.link runs, and the contract checks that these cases, and only these, break, each for that clause.

`test/regions.spec.ts` checks every module against the region files' names and lines (`test/upstream/regions.json`). Every rule carries its `source`, `file:line`.

```bash
# Regenerate the fixtures from a checkout of the pinned commit
pnpm --filter @alltp/pack-smz3 import-upstream <SMZ3Randomizer checkout>
```

## Autotracking

`SMZ3_AUTOTRACK` is the pack `@alltp/autotrack` reads an SMZ3 seed with. Its facts come from the combo ROM's ASM, `tewtal/alttp_sm_combo_randomizer_rom` at `5f9eaf6` (the submodule `d53be76` pins; MIT), and from what `Patch.cs` writes into the ROM; each range in `src/autotrack/memory.ts` cites its file and lines.

**One ROM, two homes per game.** The running game's state is in WRAM; the other's is in SRAM. The game byte at `$A1:73FE` says which runs: `$00` Zelda, negative Super Metroid, `$11` the credits (`common.asm`). The pack declares these as modes, and each range is read only in its mode. Each game is saved before a portal (`z3/teleport.asm:48`, `sm/teleport.asm:58-61`), so the SRAM of the game not running is current, but for what is found for it in the other game: that goes to a buffer, written back on the next save.

| | While Zelda runs | While Super Metroid runs |
| --- | --- | --- |
| Zelda's save (`$7E:F000`, 0x500 bytes) | WRAM | SRAM `$A0:6000`, with the buffers laid over: `$A1:7B00` (offsets `$300-$3FF`, the items) and `$A1:7F50` (`$4E0-$4EF`, the keys found) |
| Super Metroid's save (offset n: `$7E:09A2+n` below `$60`, `$7E:D7C0+n` above) | buffer `$A1:7900` (offsets `$00-$7F`) and its SRAM save's items collected (`$A1:60C0`, offsets `$B0-$CF`) | WRAM: `$7E:09A2` (equipment) and `$7E:D830` (keycards, boss tokens, items collected) |

The decoders read each game through one view of its save, whichever game runs, so the same game gives the same items and checks in either mode (`decode.spec.ts`). After a switch, `@alltp/autotrack` counts a mode's ranges unread until read again: a decoder never takes an earlier visit's bytes for the current one.

**What is read.**
- The items held in both games: Zelda's equipment and tracking bits, its keys found (`DungeonCollectedKeys`, which no door takes back) and big keys; Super Metroid's items, beams, and each pack's or tank's maximum over what one gives; the keycards (bit n of save offset `$70` is item `$D0+n`) and the boss tokens.
- The rewards found: the pendants' and crystals' bits, as `Patch.cs` writes them (the green pendant `$04`; crystals 5 and 6, the red ones, `$04` and `$01`).
- The locations checked. Zelda's by the flags the ALttPR pack's `CHECK_FLAGS` gives the same location (by `ZELDA_ALIASES`), kept as data in `src/autotrack/zelda-flags.json`, which `flags.spec.ts` derives and writes again with `vitest -u` when those flags move. Super Metroid's by its item's bit in the items collected: upstream's location id is that bit (the item PLM's argument, checked against the vanilla ROM for 99 of the 100 locations; the patch moves the Morphing Ball's PLM, whose bit stays `$1A`), and `flags.spec.ts` holds the table to the ids `regions.json` records.
- The seed: its title (`ZSM…`, the game check), its race bit, keysanity and Super Metroid's logic from the seed block's first word.
- Outside races, its requirements: the thresholds and medallions, in Zelda's config bank, which `Snes()` places at bus `$40:0000` (ROM `$400000`, ExHiROM's second half). A bridge must serve that half: bsnes-mercury's memory map through RetroArch does not, and answers with first-half bytes, a plausible but wrong medallion among them (seen on 2026-10-19). Two bytes of the block are foretold by the seed block, Ganon's vulnerability by the goal and the save-and-quit flag: when they differ, the requirements decode as `unreadable` and stay the player's.

The game state and both saves are read at one cadence, in the same tick. With the state read twice as often, the first reading in play carried saves read during the new file's load, when the buffers were still blank SRAM: the board took every item for found. A save that was never written (Zelda's equipment all `$FF`, Super Metroid's items word `$FFFF`) decodes to nothing besides.

**Races.** No SMZ3 autotracking specification exists; racetime.gg's smz3 category allows autotracking and bans ROM or RAM inspection otherwise. The race profile (`race-profile.ts`) therefore reads what the player sees and the settings a race announces. It forbids, in a race seed, the requirements a seed may draw at random (the crystals Ganon's Tower and Ganon ask for, the bosses Tourian asks for) and the medallions opening Misery Mire and Turtle Rock. The dungeons' and bosses' rewards are never read at all: a reward counts once found.

## Not modelled

- **Ganon and Mother Brain.** Upstream's logic has no region for them: the game checks the goal (crystals for Ganon, bosses for Tourian), which the tracker counts from the rewards found.
- **The filler's rules** (`.Allow`, `.AlwaysAllow`, `CanFill`): they say where the randomizer may place an item, not what reaches a location.

## When upstream moves

The weekly Logic drift workflow compares `tewtal/SMZ3Randomizer`'s default branch with `commit` in `upstream.json`. When a file `upstream.json` lists has changed, it opens or updates the issue "Upstream logic drift (smz3): ...".

To port the change:

1. Read the upstream diff the issue links.
2. Port each changed rule into the module of its file: keep the rule as upstream writes it, and set `source` to its new line. Lines shift, so recheck every location of a changed file.
3. Check out the new commit, run the importer, then set `commit` here to it.
4. Hold the pack to the new fixtures. A case that breaks is a rule to port, never a fixture to edit; an entry of `STALE` that no longer breaks leaves the list.
