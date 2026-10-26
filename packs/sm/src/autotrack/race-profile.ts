// The rules Map Rando races answer to, as @alltp/autotrack's race profile.
//
// Map Rando races run on racetime.gg's "Super Metroid Randomizer" category
// (racetime.gg/smr), whose rules ban the old emulators (SNES9x 1.43 and below,
// ZSNES), glitches, stream sniping and controller macros, and say nothing of
// trackers or autotrackers (its `info`, read on 2026-10-19 and again on
// 2026-10-25). Map Rando's own "Race mode" only locks a seed's
// spoiler on the website (rust/maprando-web/templates/generate/help/
// race.html) and writes nothing into the ROM: there is no race flag to read.
// So a category this pack reads is permitted unless kept out below. In Race
// Mode it reads what the player holds and has done, never what a location holds.
//
// Two categories are kept out on purpose. `game-time`, Map Rando's RTA clock,
// reveals nothing of the seed, but the game shows it only in its end credits,
// never in play, and the tracker's rule for races is to read no more than a
// player sees (a policy, not a rule of the page: the rules restrict no
// tracking). A race therefore keeps the run timer on real time, as racetime.gg
// times it. `locations`, the bits of the locations collected and the mask of
// those that hold Nothing, would show where the seed put no item: a Nothing
// location's bit is set from the first frame (new_game.asm:121-128), which a
// player learns otherwise only by reaching the spot. A race therefore keeps
// the review's count of items, and the board never reads either range.

import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

const NO_RULE =
  "racetime.gg/smr's rules restrict no tracking; Map Rando's race mode only locks the seed's spoiler on the website.";

export const MAP_RANDO_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    "game-state": { permitted: true, rule: NO_RULE },
    "game-time": {
      permitted: false,
      rule: "Not a rule of racetime.gg/smr: the tracker reads no more than a player sees in a race, and Map Rando shows its RTA clock only in its end credits.",
    },
    items: { permitted: true, rule: NO_RULE },
    locations: {
      permitted: false,
      rule: "Not a rule of racetime.gg/smr: the tracker reads no more than a player sees in a race, and the collected bits and their Nothing mask show which locations hold no item.",
    },
    objectives: { permitted: true, rule: NO_RULE },
    "rom-header": { permitted: true, rule: NO_RULE },
    seed: { permitted: true, rule: NO_RULE },
  },
  id: "map-rando",
  mapping: "lorom",
  // The memory the pack reads: the header, the seed's tables in banks $82,
  // $84, $8F and $DF, and the game's state, equipment and events
  permitted: [
    [0x00_ffc0, 0x00_ffdf],
    [0x82_fffc, 0x82_fffd],
    [0x84_e0b8, 0x84_e128],
    [0x84_e444, 0x84_e445],
    [0x8f_ebc0, 0x8f_ec0f],
    [0xdf_fef0, 0xdf_ff0d],
    [0x7e_0998, 0x7e_09ed],
    [0x7e_d820, 0x7e_d82f],
  ],
  source: "https://racetime.gg/smr",
  title: "Map Rando races on racetime.gg (Super Metroid Randomizer)",
  version: "2026-10-19",
});
