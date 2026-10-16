// app/Region/Standard/SwampPalace.php: Swamp Palace, its locations and its
// prize.
//
// Not ported here:
// - the glitched branch of can_enter (185-192: canOneFrameClipUW with
//   canBootsClip, canSuperSpeed or canOneFrameClipOW), which needs Misery
//   Mire (`$mire`) and the Old Man's location (West Death Mountain) besides
//   South Dark World: an entrance comes from one region only;
// - the fill rules and always-allow of the Entrance (87-91), the Big Chest
//   (100-104) and the boss (162-175), which Location::canFill reads when the
//   randomizer places an item; they wait for src/fill.ts.
import type { RegionModule } from "../../world";

/** `$mire` (75-79): one-frame clipping in from Misery Mire, with its keys. */
const MIRE = "setting(canOneFrameClipUW) & keyD6 >= 3 & reach(miseryMire)";

/** `$hera` (81-85): one-frame clipping in from Tower of Hera. */
const HERA = "setting(canOneFrameClipUW) & reach(towerOfHera) & bigKeyP3";

/** The first key door, then the hammer's pegs, as most chests want them. */
const PAST_PEGS = `(keyD2 | ${MIRE}) & (hammer | ${MIRE} | ${HERA})`;

/**
 * The boss (154-161), whose rule is the prize's too: can_complete is the
 * boss's canAccess (150-152). With wild maps or compasses the boss wants its
 * dungeon's, unless it holds that item itself (`hasItem`), which a tracker
 * cannot know: `maybe`.
 */
const BOSS = `hookshot & ${PAST_PEGS} & @canBeatSwampPalaceBoss & (!setting(wildCompasses) | compassD2 | maybe) & (!setting(wildMaps) | mapD2 | maybe)`;

export const SWAMP_PALACE = {
  file: "app/Region/Standard/SwampPalace.php",
  regions: [
    {
      entrances: [
        {
          from: "southDarkWorld",
          req: "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & flippers & moonPearl & magicMirror",
          source: "app/Region/Standard/SwampPalace.php:177",
        },
      ],
      id: "swampPalace",
      locations: [
        {
          id: "swamp-palace/entrance",
          kind: "chest",
          name: "Swamp Palace - Entrance",
          req: "true",
          source: "app/Region/Standard/SwampPalace.php:50",
        },
        {
          id: "swamp-palace/big-chest",
          kind: "bigChest",
          name: "Swamp Palace - Big Chest",
          req: `${PAST_PEGS} & (bigKeyD2 | ${MIRE} & bigKeyD6 | ${HERA} & bigKeyP3)`,
          source: "app/Region/Standard/SwampPalace.php:93",
        },
        {
          id: "swamp-palace/big-key-chest",
          kind: "chest",
          name: "Swamp Palace - Big Key Chest",
          req: PAST_PEGS,
          source: "app/Region/Standard/SwampPalace.php:106",
        },
        {
          id: "swamp-palace/map-chest",
          kind: "chest",
          name: "Swamp Palace - Map Chest",
          req: `@canBombThings & (keyD2 | ${MIRE})`,
          source: "app/Region/Standard/SwampPalace.php:112",
        },
        {
          id: "swamp-palace/west-chest",
          kind: "chest",
          name: "Swamp Palace - West Chest",
          req: PAST_PEGS,
          source: "app/Region/Standard/SwampPalace.php:117",
        },
        {
          id: "swamp-palace/compass-chest",
          kind: "chest",
          name: "Swamp Palace - Compass Chest",
          req: PAST_PEGS,
          source: "app/Region/Standard/SwampPalace.php:123",
        },
        {
          id: "swamp-palace/flooded-room/left",
          kind: "chest",
          name: "Swamp Palace - Flooded Room - Left",
          req: `hookshot & ${PAST_PEGS}`,
          source: "app/Region/Standard/SwampPalace.php:129",
        },
        {
          id: "swamp-palace/flooded-room/right",
          kind: "chest",
          name: "Swamp Palace - Flooded Room - Right",
          req: `hookshot & ${PAST_PEGS}`,
          source: "app/Region/Standard/SwampPalace.php:136",
        },
        {
          id: "swamp-palace/waterfall-room",
          kind: "chest",
          name: "Swamp Palace - Waterfall Room",
          req: `hookshot & ${PAST_PEGS}`,
          source: "app/Region/Standard/SwampPalace.php:143",
        },
        {
          id: "swamp-palace/boss",
          kind: "drop",
          name: "Swamp Palace - Boss",
          req: BOSS,
          source: "app/Region/Standard/SwampPalace.php:154",
        },
        {
          id: "swamp-palace/prize",
          kind: "prize",
          name: "Swamp Palace - Prize",
          req: BOSS,
          source: "app/Region/Standard/SwampPalace.php:150",
        },
      ],
      name: "Swamp Palace",
      prize: "swamp-palace/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD2",
          "Compass",
          "CompassD2",
          "Key",
          "KeyD2",
          "Map",
          "MapD2",
          "Crystal2",
        ],
        source: "app/Region/Standard/SwampPalace.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
