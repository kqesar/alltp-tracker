// SMZ3 as an @alltp/autotrack pack: the memory map, its modes (which game
// runs), the game check, the race flag and the race profile. definePack
// checks it all when this module loads.

import { type AutotrackPack, definePack } from "@alltp/autotrack";
import { MEMORY_RANGES } from "./memory";
import { SMZ3_GAME_CHECK, SMZ3_MODES, SMZ3_RACE_FLAG } from "./probes";
import { SMZ3_RACE_PROFILE } from "./race-profile";

/** What AutotrackSession takes to autotrack an SMZ3 seed. */
export const SMZ3_AUTOTRACK: AutotrackPack = definePack({
  gameCheck: SMZ3_GAME_CHECK,
  id: "smz3",
  modes: SMZ3_MODES,
  profile: SMZ3_RACE_PROFILE,
  raceFlag: SMZ3_RACE_FLAG,
  ranges: MEMORY_RANGES,
});
