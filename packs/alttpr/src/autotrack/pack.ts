// ALttPR as an @alltp/autotrack pack: the memory map, the game check and the
// race flag, under the community's race profile. definePack checks it all
// when this module loads.

import { type AutotrackPack, definePack } from "@alltp/autotrack";
import { MEMORY_RANGES } from "./memory";
import { ALTTPR_GAME_CHECK, ALTTPR_RACE_FLAG } from "./probes";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/** What AutotrackSession takes to autotrack an ALttPR seed. */
export const ALTTPR_AUTOTRACK: AutotrackPack = definePack({
  gameCheck: ALTTPR_GAME_CHECK,
  id: "alttpr",
  profile: ALTTPR_RACE_PROFILE,
  raceFlag: ALTTPR_RACE_FLAG,
  ranges: MEMORY_RANGES,
});
