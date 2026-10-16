// The racing rules ALttPR autotracking answers to, as @alltp/autotrack's
// race profile: the memory a race permits and the categories of tracked
// information, permitted or not. The memory map (memory.ts) files every
// range it reads under one of these categories.
import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

/**
 * The ALttPR rules: "The Official ALTTPR Race-legal Auto-tracker
 * Specification", version 1.2 (2021-05-19), at link.alttpr.com/autotracking.
 * Addresses are the spec's "Permitted SNES memory addresses", in the SNES
 * LoROM space, ends inclusive; the internal header line ($FFB0-$FFDF) is
 * bank $00. "Anything not covered in this document is, by default,
 * considered not permitted": the `other` category stands for it.
 */
export const ALTTPR_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    ammo: {
      permitted: true,
      rule: "Record and track if the player has at least one bomb, or at least one arrow.",
    },
    "boss-kills": {
      permitted: true,
      rule: "Record and track defeated dungeon bosses.",
    },
    "dungeon-checks": {
      permitted: false,
      rule: 'Record or track checked locations inside a dungeon, including presenting this information as the number of remaining "chests."',
    },
    entrances: {
      permitted: false,
      rule: "Record or track any entrance locations, or where they lead.",
    },
    "game-start": {
      permitted: true,
      rule: "Record and track when the player starts playing the game.",
    },
    goal: {
      permitted: true,
      rule: "Record and track when the player has completed the goal (warped to triforce room).",
    },
    hud: {
      permitted: false,
      rule: "Record or track any information on the HUD. This includes bomb/arrow/rupee counts, equipped item, and heart piece counts. Additionally, current bottle contents are forbidden from autotracking.",
    },
    items: {
      permitted: true,
      rule: "Record and track any item collected by a player, or record items already pre-equipped (starting boots, sword, flute, etc.).",
    },
    keys: {
      permitted: true,
      rule: "Record and track any small or big keys collected by a player.",
    },
    "msu-track": {
      permitted: true,
      rule: "Read the currently playing MSU-1 track for on-stream display or other similar use (using 0x7E010B).",
    },
    other: {
      permitted: false,
      rule: "Anything else not explicitly defined as a permitted auto-tracking behavior.",
    },
    "outside-checks": {
      permitted: true,
      rule: "Record and track checked locations that are not in a dungeon, including non-dungeon underworld caves and indoor areas.",
    },
    prizes: {
      permitted: false,
      rule: "Record or track information on pendants and crystal locations, regardless of the source of information.",
    },
    "race-flag": {
      permitted: true,
      rule: "The auto-tracker should read the race flag at memory address 0x308213 and automatically enable a race-compliant mode.",
    },
    "rom-header": {
      permitted: true,
      rule: "Auto-trackers are allowed to read the following memory addresses, and the internal ROM header.",
    },
    spheres: {
      permitted: false,
      rule: 'Record or track the "sphere," or logical progression, of an item.',
    },
  },
  id: "alttpr",
  mapping: "lorom",
  permitted: [
    [0x00_ffb0, 0x00_ffdf],
    [0x7e_0000, 0x7e_00b0],
    [0x7e_010b, 0x7e_010b],
    [0x7e_f000, 0x7e_f500],
    [0x30_8210, 0x30_823f],
  ],
  raceFlag: { bus: 0x30_8213, openValue: 0x00, raceValue: 0x01 },
  source: "https://link.alttpr.com/autotracking",
  title: "The Official ALTTPR Race-legal Auto-tracker Specification",
  version: "1.2 (2021-05-19)",
});
