// The racing rules ALttPR autotracking answers to, as @alltp/autotrack's
// race profile: the memory Race Mode reads and the categories of tracked
// information, permitted or not. The memory map (memory.ts) files every
// range it reads under one of these categories.
import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

/** The rules racetime.gg's ALTTPR category links (read 2026-10-24). */
const RULES_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTgsj0FMiWyaBOYP97e_ABc4P_0vIGiJxoUJ5Rj-PBr1T7i_zpyLqhLLVkbftPwS_B6nwad5j5zhtMg/pub";

/** What a category v2.0 allows but Race Mode keeps forbidden says of it. */
const STRICT =
  " Race Mode still leaves it to the player: deliberately strict, pending clarification with the race admins.";

/**
 * The ALttPR rules: the "ALTTPR Auto-tracker Rules and Guidelines", version
 * 2.0 (2024), which racetime.gg's ALTTPR category links. Each `rule` quotes
 * it. Race Mode is stricter than v2.0 on purpose: it keeps the categories
 * v2.0 opened (checks inside dungeons, prizes upon collection, the HUD's
 * counts, some stats, the ROM's settings) forbidden until their limits are
 * clarified, and reads only inside the memory windows below, in the SNES
 * LoROM space, ends inclusive (the internal header line $FFB0-$FFDF is bank
 * $00). v2.0 lists no addresses ("it does not matter where information is
 * gathered, only that its use is allowed or disallowed"): the windows are
 * the tracker's own limit. They started as the earlier version's, whose
 * WRAM window ($7E:0000-$7E:00B0) held Link's coordinates ($20-$23), the
 * room ($A0) and the overworld screen ($8A). The race admins' clarification
 * of 11 and 13 June 2026 (no change to the rules) says a tracker may not
 * identify or display Link's position, dungeon, room or X/Y in a race, so
 * the WRAM window is now only the game mode ($7E:0010: when the game starts
 * and ends), which holds no coordinates, room or dungeon. Widening a window needs a read of
 * what the new bytes hold (memory.spec.ts holds the position out). "Anything not
 * covered in this document is, by default, considered not permitted": the
 * `other` category stands for it. v2.0 says nothing of a race flag: the
 * randomizer's tournament flag is what switches Race Mode on.
 */
export const ALTTPR_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    ammo: {
      permitted: true,
      rule: "The tracker may also display and/or react to changes in current bomb count, arrow count, rupee count, heart count, heart piece count, and bottle contents.",
    },
    "boss-kills": {
      permitted: true,
      rule: "Defeated bosses and their prizes upon collection (but not identify if a crystal is a 5/6 crystal or a regular crystal). This includes not auto-tracking who the dungeon boss is in Enemizer modes before the boss is defeated.",
    },
    "dungeon-checks": {
      permitted: false,
      rule: `An auto-tracker is allowed to track whether or not a location's content has been acquired by the player. This includes: overworld-locations, underworld-locations, and dungeon-locations.${STRICT}`,
    },
    entrances: {
      permitted: false,
      rule: "Region endpoints may not be auto-tracked: this includes any form of connecting one region to another, any annotations that indicate what is on the other side of an endpoint, or marking/clearing it off the map. ROM addresses associated with entrance locations and/or chest or other location contents should not ever be accessed by an auto-tracker before or during a race.",
    },
    "game-start": {
      permitted: true,
      rule: "A program may keep track of when the game starts and when the game ends (i.e. auto-livesplit).",
    },
    goal: {
      permitted: true,
      rule: "A program may keep track of when the game starts and when the game ends (i.e. auto-livesplit).",
    },
    hud: {
      permitted: false,
      rule: `The tracker may also display and/or react to changes in current bomb count, arrow count, rupee count, heart count, heart piece count, and bottle contents.${STRICT}`,
    },
    items: {
      permitted: true,
      rule: "It is legal to have a program auto-track items that Link possesses, and locations that Link has checked: Y-, B-, and A-items, unique or progressive equipment.",
    },
    keys: {
      permitted: true,
      rule: "Dungeon items (keys, maps, compasses).",
    },
    "msu-track": {
      permitted: true,
      rule: "The current MSU-1-track playing may be displayed but may not be used to infer regions.",
    },
    navigation: {
      permitted: false,
      rule: "Anything not covered in this document is, by default, considered not permitted: the race admins' clarification of June 2026 (no change to v2.0) reads it to bar any display of Link's position, the dungeon ID, the room ID or the X/Y coordinates, and what follows from them. A dark room's plan and Link's place in it show the same and what the game hides without the Lamp, so Race Mode never reads them.",
    },
    other: {
      permitted: false,
      rule: "Anything not covered in this document is, by default, considered not permitted.",
    },
    "outside-checks": {
      permitted: true,
      rule: "An auto-tracker is allowed to track whether or not a location's content has been acquired by the player. This includes: overworld-locations, underworld-locations, and dungeon-locations.",
    },
    prizes: {
      permitted: false,
      rule: `Defeated bosses and their prizes upon collection (but not identify if a crystal is a 5/6 crystal or a regular crystal). Map checks are not allowed to be auto-tracked, and trackers may not auto-track which crystal is a 5/6-crystal. The green pendant may not be auto-tracked before it is picked up.${STRICT}`,
    },
    "race-flag": {
      permitted: true,
      rule: "Auto-trackers are allowed to read any SRAM and/or ROM locations at any time (the randomizer's tournament flag, which switches Race Mode on; v2.0 does not name it).",
    },
    "rom-header": {
      permitted: true,
      rule: "Auto-trackers are allowed to read any SRAM and/or ROM locations at any time, except ROM addresses associated with entrance locations and/or chest or other location contents.",
    },
    spheres: {
      permitted: false,
      rule: "An auto-tracker may not associate an acquired item with a specific location, nor can it derive any conclusions from the order or timing by which items are acquired.",
    },
  },
  id: "alttpr",
  mapping: "lorom",
  permitted: [
    [0x00_ffb0, 0x00_ffdf],
    [0x7e_0010, 0x7e_0010],
    [0x7e_f000, 0x7e_f500],
    [0x30_8210, 0x30_823f],
  ],
  raceFlag: { bus: 0x30_8213, openValue: 0x00, raceValue: 0x01 },
  source: RULES_URL,
  title: "ALTTPR Auto-tracker Rules and Guidelines",
  version: "2.0 (2024)",
});
