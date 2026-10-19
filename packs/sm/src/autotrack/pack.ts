// Map Rando as an @alltp/autotrack pack: the memory map, the game check and
// the race profile. definePack checks it all when this module loads. The game
// has no race flag: races put nothing in the ROM.

import { type AutotrackPack, definePack } from "@alltp/autotrack";
import { MEMORY_RANGES } from "./memory";
import { MAP_RANDO_GAME_CHECK } from "./probes";
import { MAP_RANDO_RACE_PROFILE } from "./race-profile";

/** What AutotrackSession takes to autotrack a Map Rando seed. */
export const MAP_RANDO_AUTOTRACK: AutotrackPack = definePack({
  gameCheck: MAP_RANDO_GAME_CHECK,
  id: "map-rando",
  profile: MAP_RANDO_RACE_PROFILE,
  raceFlag: null,
  ranges: MEMORY_RANGES,
});
