# @alltp/pack-sm

Super Metroid as the tracker plays it: **Map Rando** seeds (maprando.com,
`blkerby/MapRandomizer`), the randomizer the community races. On
racetime.gg's Super Metroid Randomizer category, about 99 % of the races of
August to October 2026 linked a maprando.com seed (measured on 2026-10-19
from the races' info links; the rest were DASH).

The pack holds what a tracker of those seeds needs, read from Map Rando's
own source at the commit `upstream.json` pins, never from memory:

| Module | What | Source |
| --- | --- | --- |
| `src/items.ts` | the items, Map Rando's `enum Item` but Nothing, with the game's full pool for the counted ones | `rust/maprando-game/src/lib.rs:155-181` |
| `src/objectives.ts` | the 19 objectives a seed may ask for, by group, each with its flag | `rust/maprando/src/patch.rs:3327-3355, 3596-3681` |
| `src/settings.ts` | the presets the ROM keeps for autotrackers, and the items its settings add | `settings.rs:113-241`, `patch.rs:783, 2038-2105`, `Bank DF.txt` |
| `src/spoiler.ts` | Map Rando's spoiler log read into `@alltp/spoiler`'s shape | `rust/maprando/src/spoiler_log.rs:110-149, 197-262, 1236`, `settings.rs:521-545` |
| `src/autotrack/` | the memory map, the decoders, the game check and the race profile | below |

## No logic, on purpose

Map Rando reconnects the game's rooms, and its logic is `sm-json-data`, a
database of strategies per room that spends energy, ammunition and frames of
heat. A tracker cannot follow it without the seed's map and a solver of that
database; players follow the game's own map, and the trackers they use (the
EmoTracker package maprando.com credits) track items and objectives. So does
this pack: what the player holds, the seed's objectives, and whether each
is done.

## Autotracking

```mermaid
flowchart LR
  rom["ROM: header, $82:FFFC, $84 PLMs,<br/>$8F:EBC0 table, $DF:FEF0 seed"] --> seed["decodeSeed<br/>name, presets, added items"]
  rom --> obj["decodeObjectives"]
  wram["WRAM: $0998 state, $09A2-$09ED<br/>equipment, $D820-$D82F events"] --> items["decodeItems"]
  rom --> items
  wram --> obj
  wram --> play["decodeInPlay"]
  wram --> goal["decodeBeforePlay, decodeGoal<br/>game state, escape event"]
  clock["SRAM $70:1E10 + WRAM $7E:1F80<br/>(never read in Race Mode)"] --> rta["decodeGameClock<br/>clockStraddled, rtaMs"]
```

- **The game check**: Map Rando names the cartridge "SUPERMETROID MAPRANDO"
  (`patch.rs:2111-2112`), where the original game's header says
  "Super Metroid". Archipelago's Super Metroid (VARIA's randomizer) writes
  "SM", AP's version, the player and the seed (AP 0.6.8,
  `worlds/sm/__init__.py:677-681`): refused as `archipelago-rom`, which points
  the player to the app's Archipelago board (AP's own client tracks that ROM;
  nothing of its logic or settings is read).
- **Items** (`decodeItems`): the items and beams collected (`$09A4`, `$09A8`),
  by the bits the patcher gives a seed's starting items (`patch.rs:
  2300-2324`), Map Rando's three included (the Wall Jump Boots, the Spark
  and Blue Boosters). Packs and tanks are counted from the maximum they
  raised (`$09C4-$09D4`, `new_game.asm:85-120`) over what one gives, which
  the patcher writes into the items' PLMs for a seed of other sizes
  (`patch.rs:794-838`; the original game's are 100, 5, 5, 5 and 100, read
  from its ROM). Energy starts at 99, and an energy tank disabled from the
  pause menu takes 100 off the maximum but counts in `$09EC`
  (`disableable_etanks.asm:564-569`): it is held all the same.
- **Objectives** (`decodeObjectives`): the ROM keeps how many the seed has
  (`$82:FFFC`, its high bit the fast pause menu) and each one's flag, an
  event address and a mask (`$8F:EBC0`, `$8F:EBE8`, `patch.rs:3574-3584,
  3683-3684`), in the pause screen's order. An objective is done once its
  flag is set in WRAM (`$7E:D820-$D82F`).
- **The seed** (`decodeSeed`): its name at `$DF:FEF0`, which
  maprando.com/seed/<name>/ finds, the presets at `$DF:FF09-$FF0D` (0 for a
  setting the seed customized) and the items its settings add at `$DF:FF05`
  (`Bank DF.txt`).
- **In play** (`decodeInPlay`): game state `$07` or `$08`
  (`fast_reload.asm:134-136`).
- **Before play** (`decodeBeforePlay`): states `$00-$06` (the title, the menus,
  the file select, the loading of a game) and `$1F`, where a new game is set
  up (`fast_reload.asm:46-47, 166-167`, `new_game.asm:195-212`). A reading in
  play after one before play is a game starting: the run timer starts there,
  and not on `$1F` or `$06`, which a poll every second misses.
- **The goal** (`decodeGoal`): event `$0E`, the escape (`$D821` bit 6, set when
  Mother Brain dies: `stats.asm`, `hook_samus_enter_ship`), with the game state
  `$26` (Samus escapes) or `$27` (the ending and credits): Samus in the ship.
  `stat_final_time` is no signal: a new game does not clear it.
- **The RTA clock** (`decodeGameClock`, `rtaMs`): Map Rando's frame counter,
  which its credits print as the final time (`stats.asm`, "based on VARIA
  patch by total & ouiche"). Every NMI counts, lag, menus, the file select and
  the credits too, and a death or a reload never rewinds it, unlike the
  game's own IGT (`$7E:09DA`, which reverts to the last save). It has two
  parts: `!stat_timer`, a 32-bit count in SRAM (`$70:1E10`) which the NMI
  counter adds its 255 to when it fills and on every item pickup, and
  `!nmi_counter`, a byte of WRAM (`$7E:1F80`) holding the frames not yet
  flushed, 0 to 254 (`constants.asm`, `stats.asm`): the clock is their sum.
  It is a count since the console's SRAM was set up, not since a run began:
  the app notes it when the run starts. Frames convert at Map Rando's
  `100 / 60.09881186` hundredths a frame (`credits.asm`, `adjust_time_fps`),
  defined here from that source (packs import nothing of each other).
  **The flush guard** (`clockStraddled`): the two parts are read one after the
  other, the SRAM word first (the planner sorts pieces by address; the spec
  holds the order), and a flush between them leaves the old word with the new
  counter, so the sum falls back by up to 254 frames. Such a reading is told
  by the word standing still while the counter went back, which only a
  missed flush does (a flush raises the word): it is not a time, and the
  app holds the last one. Not verified against a live console: how SNI and
  RetroArch order a multi-range read is taken from the planner's contract.

Bank `$DF` lies past the first 2 MiB of this 3 MiB LoROM game: it reads
through `@alltp/autotrack`'s 4 MiB LoROM mapping (its README, "Address
spaces").

### Races

Map Rando races run on racetime.gg/smr, whose rules restrict no tracking
(its category info, read 2026-10-19); Map Rando's "Race mode" only locks a
seed's spoiler on the website and writes nothing into the ROM. The race
profile (`MAP_RANDO_RACE_PROFILE`) therefore permits every category this
pack reads, and the pack has no race flag. It reads what the player holds
and has done, never what a location holds. The one exception is the RTA clock
(category `game-time`), which the profile forbids: it reveals nothing of the
seed, but the game shows it only in its end credits, and the tracker reads no
more than a player sees in a race (a policy of the tracker, not a rule of the
page). Race Mode therefore never reads `rta-saved` and `rta-pending`
(`memory.spec.ts` proves it over a real plan), and the run timer counts real
time. The state and the escape event, which start and stop it, stay permitted.
The rules of racetime.gg/smr ban the old emulators (SNES9x 1.43 and below, ZSNES),
not emulators in general (read again on 2026-10-25).

## Spoiler logs

`parseSpoiler(text)` reads the `spoiler.json` of maprando.com
(`/seed/<name>/data/spoiler.json`, "Spoiler log JSON" on the seed page) into
`@alltp/spoiler`'s `SpoilerLog`, for the post-run review. It never throws on
its input: a refusal is `{ ok: false, error, detail? }` with the package's
codes. The caller bounds the size first (`checkSize("sm", file.size)`, 64 MiB).

- **A file of 21 MB, 39 KB read.** `details` (routes), `game_data`
  (sm-json-data copied in) and the traversals are 99.8 % of it. `sliceTopLevel`
  takes `all_items`, `summary`, `objectives`, `start_location` and the three
  pack sizes without building the rest; zod (`zod/mini`) checks what it took
  (bounded: 500 locations, 200 steps, names of 200 characters).
- **Measured** on the real file of seed `dsjF6gGsH` (20 928 610 bytes, 100
  locations), Node 24.22, desktop CPU, under Vitest, median of 15 runs: slice
  35.8 ms, slice and parse 36.5 ms, against 83.6 ms for a full `JSON.parse`.
  A phone is several times slower: the app reads it in a worker.
- **Locations** are keyed `<room_id>:<node_id>` (sm-json-data's ids: node names
  repeat inside a room), named `<room>: <node>`, with the file's `area`. The
  pack has no location list of its own (no logic), so the log is the only
  source of them.
- **Items**: Rust `enum Item` variant names, through `SM_ITEMS[].variant` (the
  25 of `lib.rs:155-181`, held to their indices by the spec). "Nothing" is a
  location without an item: no placement, `skipped: ["Nothing"]`. A variant the
  pack lacks refuses as `newer-version`, naming it.
- **Steps**: `summary[].step` is the placement's `sphere`; `spheres` is the
  highest step holding an item. An item in no step (one logic never collects)
  keeps `sphere: null`. The file contradicting itself (a location twice, a step
  item `all_items` does not hold) is `not-a-spoiler`.
- **Objectives**: flag names (`f_DefeatedKraid`) to the pack's ids through
  `OBJECTIVES[].upstream`; an unknown flag refuses as `newer-version`.
- **No seed.** The file names no seed, version or date (searched: 0 hits for
  the seed's name), so `seed` is empty and a log is never "verified". The
  weak facts live in `mapRandoEvidence(extra, run)`, for `bindSeed`: the
  objectives (same set), and the Wall Jump Boots and split Speed Booster the
  seed placed against the run's ROM (`decodeSeed`). A log placing none of them
  says nothing, since a starting item is not a placement. Likewise "the run
  holds more of an item than the seed placed" is no refusal here: Map Rando's
  starting items (`details[0].start_state`, not read) would trip it;
  `extra.placed` holds the counts for the app to word.

**The fixture** `test/spoilers/dsjF6gGsH.json` (38 KB, with its
`.provenance.json`: source URL, SHA-256 and size of the 21 MB file) is the
real file cut to the keys the parser reads, in the file's order, by
`pnpm --filter @alltp/pack-sm spoiler-fixture <seed name | file> [name]`;
never edit it. It holds game data only: no seed name, path, address or account
(checked by search). To hold the parser to the real file and time it, run the
spec with `MAP_RANDO_SPOILER=<spoiler.json>` set: it must read the same log as
the fixture.

## Tests

`test/sm-rom.ts` writes a Map Rando seed in play into a memory image, as its
ROM and the game hold it; the decoders' spec, the web app's specs and its
browser tests build on it. The decoders' spec also runs them on random
bytes: they never throw, and keep every count within the pool.
