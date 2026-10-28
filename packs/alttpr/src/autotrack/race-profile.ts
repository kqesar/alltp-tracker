// The racing rules ALttPR autotracking answers to, as @alltp/autotrack's
// race profile: the memory Race Mode reads and the categories of tracked
// information, permitted or not. The memory map (memory.ts) files every
// range it reads under one of these categories.
import { defineRaceProfile, type RaceProfile } from "@alltp/autotrack";

/** The rules racetime.gg's ALTTPR category links (read 2026-10-28). */
const RULES_URL =
  "https://docs.google.com/document/d/e/2PACX-1vTgsj0FMiWyaBOYP97e_ABc4P_0vIGiJxoUJ5Rj-PBr1T7i_zpyLqhLLVkbftPwS_B6nwad5j5zhtMg/pub";

/** v2.0's line on the HUD's counts: the heart count and the bottles, read. */
const HUD_COUNTS =
  "The tracker may also display and/or react to changes in current bomb count, arrow count, rupee count, heart count, heart piece count, and bottle contents.";

/** What a category v2.0 allows but Race Mode keeps forbidden says of it. */
const STRICT =
  " Race Mode still leaves it to the player: deliberately strict, pending clarification with the race admins.";

/**
 * The ALttPR rules: the "ALTTPR Auto-tracker Rules and Guidelines", version
 * 2.0 (2024), which racetime.gg's ALTTPR category links. Each `rule` quotes
 * it. Race Mode reads what v2.0 permits in so many words, and nothing it
 * leaves in doubt (in doubt, forbidden):
 * - the items, the dungeon items, the bosses, the heart count (`health`)
 *   and the bottles' contents (`bottles`), both named among the HUD's counts;
 * - the locations checked, outside the dungeons and inside them
 *   (`dungeon-checks`: "overworld-locations, underworld-locations, and
 *   dungeon-locations"; "how many locations have been cleared, both in
 *   total, and per dungeon"). A dungeon location checked says Link cleared
 *   it, as a cave's says he was in the cave: that is the location tracking
 *   v2.0 names, not his position, and the decoders read no other bit of a
 *   room's word (its doors, the quadrants visited). Zelda's rescue, a
 *   dungeon's event, stays out: "Likewise an auto-tracker may not alert
 *   whether or not Zelda was rescued in a Standard opening seed.";
 * - the pendants and crystals Link took (`prizes-held`): the pendants by
 *   name, the crystals as a count, never which is crystal 5 or 6 (the
 *   decoders read their field and let the count alone out), nor which
 *   dungeon gave which (v2.0: "An auto-tracker may not associate an
 *   acquired item with a specific location").
 * It keeps forbidden the rest of the HUD's counts and the stats v2.0 opens
 * within limits, the ROM's settings, and the ROM's prize table, a
 * location's content. It reads only inside the memory windows below, in the
 * SNES LoROM space, ends inclusive (the internal header line $FFB0-$FFDF is
 * bank $00). v2.0 lists no addresses ("it does not matter where information
 * is gathered, only that its use is allowed or disallowed"): the windows are
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
 * randomizer's tournament flag is what switches Race Mode on, and bank $30's
 * window is that flag and its complement alone ($30:8213-$30:8214, probes.ts).
 * The seed type beside them ($30:8210)
 * is a setting, which v2.0 lets a tracker set itself up from only "if it can
 * ensure it does not do so on Mystery seeds": a race seed's ROM does not say
 * whether it is one, so Race Mode reads no setting (seed-settings.ts).
 */
export const ALTTPR_RACE_PROFILE: RaceProfile = defineRaceProfile({
  categories: {
    "boss-kills": {
      permitted: true,
      rule: "Defeated bosses and their prizes upon collection (but not identify if a crystal is a 5/6 crystal or a regular crystal). This includes not auto-tracking who the dungeon boss is in Enemizer modes before the boss is defeated.",
    },
    bottles: { permitted: true, rule: HUD_COUNTS },
    "dungeon-checks": {
      permitted: true,
      rule: "An auto-tracker is allowed to track whether or not a location's content has been acquired by the player. This includes: overworld-locations, underworld-locations, and dungeon-locations. The tracker is allowed to display how many locations have been cleared, both in total, and per dungeon.",
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
    health: { permitted: true, rule: HUD_COUNTS },
    hud: {
      permitted: false,
      rule: `${HUD_COUNTS}${STRICT}`,
    },
    items: {
      permitted: true,
      rule: "It is legal to have a program auto-track items that Link possesses, and locations that Link has checked: Y-, B-, and A-items, unique or progressive equipment.",
    },
    keys: {
      permitted: true,
      rule: "Dungeon items (keys, maps, compasses). An item is anything Link would normally raise over his head when picked up, as well as small keys.",
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
    // Which prize each dungeon holds, as the ROM's table and the world map
    // tell it, and the world Link is in, which picks the map's half
    prizes: {
      permitted: false,
      rule: "Map checks are not allowed to be auto-tracked, and trackers may not auto-track which crystal is a 5/6-crystal. The green pendant may not be auto-tracked before it is picked up. ROM addresses associated with entrance locations and/or chest or other location contents should not ever be accessed by an auto-tracker before or during a race.",
    },
    "prizes-held": {
      permitted: true,
      rule: "Defeated bosses and their prizes upon collection (but not identify if a crystal is a 5/6 crystal or a regular crystal). The green pendant may not be auto-tracked before it is picked up. An auto-tracker may not associate an acquired item with a specific location.",
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
    [0x30_8213, 0x30_8214],
  ],
  raceFlag: { bus: 0x30_8213, openValue: 0x00, raceValue: 0x01 },
  source: RULES_URL,
  title: "ALTTPR Auto-tracker Rules and Guidelines",
  version: "2.0 (2024)",
});
