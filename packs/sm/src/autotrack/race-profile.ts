// The rules Map Rando races answer to, as @alltp/autotrack's race profile.
//
// Map Rando races run on racetime.gg's "Super Metroid Randomizer" category
// (racetime.gg/smr), whose rules ban the old emulators (SNES9x 1.43 and below,
// ZSNES), glitches, stream sniping and controller macros, and say nothing of
// trackers or autotrackers (its `info`, read on 2026-10-19, 2026-10-25 and
// 2026-10-27). Map Rando's own "Race mode" only locks a seed's spoiler on the
// website (rust/maprando-web/templates/generate/help/race.html) and writes
// nothing into the ROM: there is no race flag to read.
//
// The one rule found that states what Map Rando races allow is a tournament's:
// "Auto tracking is permitted for items and boss kills. Auto tracking of the
// map layout is not permitted." (Super Metroid Map Randomizer - Hard Tricky
// Multicategory Tournament, rules of 2025, read on 2026-10-27). What it does
// not state is not permitted in Race Mode, as for A Link to the Past ("Anything
// not covered in this document is, by default, considered not permitted").
// So in Race Mode the pack reads the items and the boss flags, and what that
// needs: the header (which game runs), the game state (a game in play, whose
// items are the run's), the pack sizes (what a pack counts for). The map
// layout is never read, race or not.
//
// Not stated either, and still read in Race Mode until decided otherwise
// (2026-10-27): the seed's objectives and its settings in the ROM (which the
// board lays as the seed's), the event flags beside the boss flags (the
// escape, which stops the run timer; a statue used, a room cleared, which
// `decodeObjectives` never tells in a race) and the game state as the run
// timer's start. Kept out: `game-time`, Map Rando's RTA clock (the game shows
// it only in its end credits), with the game's own in-game time, which the
// `equipment` range stops short of; and `locations`, the bits of the
// locations collected and the mask of those that hold Nothing, which would
// show where the seed put no item: a Nothing location's bit is set from the
// first frame (new_game.asm:121-128), which a player learns otherwise only by
// reaching the spot.

import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

/** The one Map Rando rule found on autotracking, quoted. */
const TOURNAMENT =
  'Super Metroid Map Randomizer - Hard Tricky Multicategory Tournament (2025): "Auto tracking is permitted for items and boss kills. Auto tracking of the map layout is not permitted."';

/** What no rule states, read for what a permitted category needs. */
const NOT_STATED = `Not stated by racetime.gg/smr, which says nothing of tracking, nor by ${TOURNAMENT}`;

export const MAP_RANDO_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    "game-state": {
      permitted: true,
      rule: `${NOT_STATED}: read to tell a game in play, whose items are the run's, and when it starts and ends.`,
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
      permitted: true,
      rule: `${TOURNAMENT} The seed's objectives and the event flags are read with the boss flags; in Race Mode only a boss kill is told done (decodeObjectives).`,
    },
    "rom-header": {
      permitted: true,
      rule: `${NOT_STATED}: read to know which game runs.`,
    },
    seed: {
      permitted: true,
      rule: `${NOT_STATED}: the seed's name and the settings that add items to the board.`,
    },
  },
  id: "map-rando",
  mapping: "lorom",
  // The memory the pack reads: the header, the seed's tables in banks $82,
  // $84, $8F and $DF, and the game's state, equipment (short of the in-game
  // time at $09DA-$09E1), disabled tanks and events
  permitted: [
    [0x00_ffc0, 0x00_ffdf],
    [0x82_fffc, 0x82_fffd],
    [0x84_e0b8, 0x84_e128],
    [0x84_e444, 0x84_e445],
    [0x8f_ebc0, 0x8f_ec0f],
    [0xdf_fef0, 0xdf_ff0d],
    [0x7e_0998, 0x7e_0999],
    [0x7e_09a2, 0x7e_09d5],
    [0x7e_09ec, 0x7e_09ed],
    [0x7e_d820, 0x7e_d82f],
  ],
  source: "https://racetime.gg/smr",
  title: "Map Rando races on racetime.gg (Super Metroid Randomizer)",
  version: "2026-10-27",
});
