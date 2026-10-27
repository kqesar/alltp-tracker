// The rules Map Rando races answer to, as @alltp/autotrack's race profile.
//
// Map Rando races run on racetime.gg's "Super Metroid Randomizer" category
// (racetime.gg/smr), whose rules ban the old emulators (SNES9x 1.43 and below,
// ZSNES), glitches, stream sniping and controller macros, and say nothing of
// trackers or autotrackers (its `info`, read on 2026-10-19, 2026-10-25 and
// 2026-10-27). Map Rando's own "Race mode" only locks a seed's spoiler on the
// website (rust/maprando-web/templates/generate/help/race.html) and writes
// nothing into the ROM: there is no race flag to read, so the app keeps Race
// Mode on unless the player turns it off.
//
// The one rule found that states what Map Rando races allow is a tournament's:
// "Auto tracking is permitted for items and boss kills. Auto tracking of the
// map layout is not permitted." (Super Metroid Map Randomizer - Hard Tricky
// Multicategory Tournament, rules of 2025, read on 2026-10-27). What it does
// not state is not permitted in Race Mode, as for A Link to the Past ("Anything
// not covered in this document is, by default, considered not permitted";
// the app's owner, 2026-10-27). So Race Mode reads the items and the boss
// flags, and what reading them needs: the header (which game runs), the game
// state (a game in play, whose items are the run's), the pack sizes (what a
// pack counts for). The map layout is never read, race or not.
//
// Kept out of Race Mode: the seed's objectives and settings in the ROM
// (`objectives`, `seed`: the player sets them in the Mode dialog), the event
// flags beside the boss flags (`events`: the escape, a statue used, a room
// cleared), Map Rando's RTA clock (`game-time`, with the game's own in-game
// time, which the `equipment` range stops short of), and the bits of the
// locations collected with the mask of those that hold Nothing (`locations`,
// which would show where the seed put no item: a Nothing location's bit is set
// from the first frame, new_game.asm:121-128). The run timer is then the
// player's: the app starts and stops it from the game outside Race Mode only.

import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

/** The one Map Rando rule found on autotracking, quoted. */
const TOURNAMENT =
  'Super Metroid Map Randomizer - Hard Tricky Multicategory Tournament (2025): "Auto tracking is permitted for items and boss kills. Auto tracking of the map layout is not permitted."';

/** What no rule states. */
const NOT_STATED = `Not stated by racetime.gg/smr, which says nothing of tracking, nor by ${TOURNAMENT}`;

export const MAP_RANDO_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    "boss-kills": { permitted: true, rule: TOURNAMENT },
    events: {
      permitted: false,
      rule: `${NOT_STATED}: the escape, the statues used and the rooms cleared.`,
    },
    "game-state": {
      permitted: true,
      rule: `${TOURNAMENT} Read to tell a game in play, whose items are the run's.`,
    },
    "game-time": {
      permitted: false,
      rule: `${NOT_STATED}: Map Rando shows its RTA clock only in its end credits.`,
    },
    items: { permitted: true, rule: TOURNAMENT },
    locations: {
      permitted: false,
      rule: `${NOT_STATED}: the collected bits and their Nothing mask show which locations hold no item.`,
    },
    objectives: {
      permitted: false,
      rule: `${NOT_STATED}: the seed's objectives are the player's to set in a race.`,
    },
    "rom-header": {
      permitted: true,
      rule: `${TOURNAMENT} Read to know which game runs.`,
    },
    seed: {
      permitted: false,
      rule: `${NOT_STATED}: the seed's name and the settings that add items to the board.`,
    },
  },
  id: "map-rando",
  mapping: "lorom",
  // The memory Race Mode reads: the header, the item sizes in bank $84, and
  // the game's state, the words of the equipment the items count reads (the
  // items and beams collected, the five maximums: no HUD, no in-game time),
  // the tanks disabled and the boss flags
  permitted: [
    [0x00_ffc0, 0x00_ffdf],
    [0x84_e0b8, 0x84_e128],
    [0x84_e444, 0x84_e445],
    [0x7e_0998, 0x7e_0999],
    [0x7e_09a4, 0x7e_09a5],
    [0x7e_09a8, 0x7e_09a9],
    [0x7e_09c4, 0x7e_09c5],
    [0x7e_09c8, 0x7e_09c9],
    [0x7e_09cc, 0x7e_09cd],
    [0x7e_09d0, 0x7e_09d1],
    [0x7e_09d4, 0x7e_09d5],
    [0x7e_09ec, 0x7e_09ed],
    [0x7e_d828, 0x7e_d82f],
  ],
  source: "https://racetime.gg/smr",
  title: "Map Rando races on racetime.gg (Super Metroid Randomizer)",
  version: "2026-10-27",
});
