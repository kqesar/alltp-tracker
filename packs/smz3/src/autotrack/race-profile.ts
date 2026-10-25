// The rules SMZ3 races answer to, as @alltp/autotrack's race profile.
//
// racetime.gg's smz3 category (racetime.gg/smz3, its rules updated
// 2024-01-30) allows autotracking and bans ROM and RAM inspection besides;
// SMZ3 has no autotracking specification of its own. So the profile keeps to
// what a player sees: what they hold, the locations they checked, the
// settings a race announces. It forbids, in a race, what only the ROM
// knows: the requirements a seed may draw at random (the crystals Ganon's
// Tower and Ganon ask for, the bosses Tourian asks for) and the medallions
// that open Misery Mire and Turtle Rock. Which dungeon or boss holds which
// reward is never read: the pendants, crystals and boss tokens held are
// (decode.ts), so a reward counts once found. Decided on 2026-10-19,
// without asking the moderators.
//
// Two more are kept out on purpose (2026-10-25). `seed-guid`: the seed's id,
// 32 characters the post-run review matches a spoiler log with; it states no
// setting, but a race has no spoiler to match. And `game-time`, the two
// games' frame counters. They reveal nothing of the seed, but the game shows
// their sum only in its end credits, never in play, and the tracker's rule
// for races is to read no more than a player sees (a policy, not a rule of
// the page: the category allows autotracking). A race therefore keeps the
// run timer on real time, as racetime.gg times it. The Zelda half of the
// sum does lie in the 0x500-byte Zelda save, which a race reads whole as
// before; nothing decodes it there.

import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

const ALLOWED =
  "racetime.gg/smz3: autotracking is allowed; what it reads, the player sees.";

export const SMZ3_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    "game-state": { permitted: true, rule: ALLOWED },
    "game-time": {
      permitted: false,
      rule: "Not a rule of racetime.gg/smz3: the tracker reads no more than a player sees in a race, and the game shows its time only in its end credits.",
    },
    requirements: {
      permitted: false,
      rule: "racetime.gg/smz3: ROM inspection beyond autotracking is banned, and a seed's random requirements and its medallions show only in the game.",
    },
    "rom-header": { permitted: true, rule: ALLOWED },
    seed: {
      permitted: true,
      rule: "racetime.gg/smz3: a race announces its settings (Super Metroid's logic, keysanity).",
    },
    "seed-guid": {
      permitted: false,
      rule: "Not a rule of racetime.gg/smz3: the guid names a seed on samus.link and a race seed has no public spoiler log to match it to, so the tracker does not read it in a race.",
    },
    sm: { permitted: true, rule: ALLOWED },
    zelda: { permitted: true, rule: ALLOWED },
  },
  id: "smz3",
  mapping: "exhirom",
  // The memory the permitted ranges read: the seed block and the title, the
  // game byte, both games' modes, saves and buffers
  permitted: [
    [0x80_ff50, 0x80_ff59],
    [0x80_ffc0, 0x80_ffdf],
    [0xa1_73fe, 0xa1_73ff],
    [0x7e_0010, 0x7e_0010],
    [0x7e_0998, 0x7e_0999],
    [0x7e_f000, 0x7e_f4ff],
    [0x7e_09a2, 0x7e_0a01],
    [0x7e_d830, 0x7e_d88f],
    [0xa0_6000, 0xa0_64ff],
    [0xa1_60c0, 0xa1_60df],
    [0xa1_7900, 0xa1_797f],
    [0xa1_7b00, 0xa1_7bff],
    [0xa1_7f50, 0xa1_7f5f],
  ],
  source: "https://racetime.gg/smz3",
  title: "SMZ3 races on racetime.gg",
  version: "2026-10-19",
});
