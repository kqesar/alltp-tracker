// app/Region/Standard/TurtleRock.php: Turtle Rock, its locations and its
// prize.
//
// Upstream reads three ways in, the closures `$upper` (87-101), `$middle`
// (103-115) and `$lower` (117-125), in can_enter and in most location rules.
// Each needs another region, so each is a part of the dungeon here
// (turtleRockUpper, turtleRockMiddle, turtleRockLower) with its own
// entrances; Turtle Rock enters from each, and a location that wants one
// way in reads `reach()` of its part. Only the upper way, by the medallion
// pad, is NoGlitches: the middle and lower ways are glitch branches, which
// NoGlitches folds away.
//
// Not ported here: the fill rules of the Big Chest (171-173), the Big Key
// Chest's always-allow and fill rules (180-184), and the boss's (243-255),
// which Location::canFill reads when the randomizer places an item; they
// wait for src/fill.ts.
import type { RegionModule } from "../../world";

/**
 * can_enter (257-264): RescueZelda and the basic placement's health gate,
 * around the three ways in.
 */
const GATE =
  "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor))";

/**
 * `$upper` up to the region it needs (88-96): the pad's medallion and a
 * sword, the pearl, and the Cane of Somaria for the platforms. The pad is
 * knowledge in the state (medallions.ts).
 */
const UPPER =
  "@hasTurtleRockMedallion & (setting(swordless) | @hasSword) & (moonPearl | setting(canOWYBA) & @hasABottle & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))) & caneOfSomaria";

/** `$lower` up to the region it needs (118-120). */
const LOWER =
  "setting(canMirrorWrap) & magicMirror & (moonPearl | setting(canOWYBA) & @hasABottle)";

/**
 * The compass chest and the roller room (133-164): any key from the upper
 * way in; four from the middle one, or two when the big key sits in one of
 * the two other chests (`itemInLocations`), which a tracker cannot know:
 * `maybe`.
 */
const NEAR_ROLLER =
  "reach(turtleRockUpper) | reach(turtleRockMiddle) & (keyD7 >= 4 | maybe & keyD7 >= 2) | reach(turtleRockLower) & lamp >= setting(requireLamp) & keyD7 >= 4";

/** The four chests of the eye bridge (192-222). */
const EYE_BRIDGE =
  "(reach(turtleRockLower) | (reach(turtleRockUpper) | reach(turtleRockMiddle)) & lamp >= setting(requireLamp) & caneOfSomaria & bigKeyD7 & keyD7 >= 3) & (!setting(basicPlacement) | cape | caneOfByrna | setting(mirrorShieldInPool) & @canBlockLasers)";

/**
 * The boss (228-242), whose rule is the prize's too: can_complete is the
 * boss's canAccess (224-226). Its glitch branch writes `$lower` out again
 * (231-237), which is reach(turtleRockLower). With wild maps or compasses
 * the boss wants its dungeon's, unless it holds that item itself
 * (`hasItem`): `maybe`.
 */
const BOSS =
  "keyD7 >= 4 & (reach(turtleRockLower) | lamp >= setting(requireLamp)) & bigKeyD7 & caneOfSomaria & @canBeatTurtleRockBoss & (!setting(wildCompasses) | compassD7 | maybe) & (!setting(wildMaps) | mapD7 | maybe)";

export const TURTLE_ROCK = {
  file: "app/Region/Standard/TurtleRock.php",
  regions: [
    {
      entrances: [
        {
          from: "turtleRockLower",
          req: GATE,
          source: "app/Region/Standard/TurtleRock.php:261",
        },
        {
          from: "turtleRockMiddle",
          req: GATE,
          source: "app/Region/Standard/TurtleRock.php:262",
        },
        {
          from: "turtleRockUpper",
          req: GATE,
          source: "app/Region/Standard/TurtleRock.php:263",
        },
      ],
      id: "turtleRock",
      locations: [
        {
          id: "turtle-rock/chain-chomps",
          kind: "chest",
          name: "Turtle Rock - Chain Chomps",
          req: "reach(turtleRockUpper) & keyD7 | reach(turtleRockMiddle) | reach(turtleRockLower) & lamp >= setting(requireLamp) & caneOfSomaria",
          source: "app/Region/Standard/TurtleRock.php:127",
        },
        {
          id: "turtle-rock/compass-chest",
          kind: "chest",
          name: "Turtle Rock - Compass Chest",
          req: `caneOfSomaria & (${NEAR_ROLLER})`,
          source: "app/Region/Standard/TurtleRock.php:155",
        },
        {
          id: "turtle-rock/roller-room/left",
          kind: "chest",
          name: "Turtle Rock - Roller Room - Left",
          req: `fireRod & caneOfSomaria & (${NEAR_ROLLER})`,
          source: "app/Region/Standard/TurtleRock.php:133",
        },
        {
          id: "turtle-rock/roller-room/right",
          kind: "chest",
          name: "Turtle Rock - Roller Room - Right",
          req: `fireRod & caneOfSomaria & (${NEAR_ROLLER})`,
          source: "app/Region/Standard/TurtleRock.php:144",
        },
        {
          id: "turtle-rock/big-chest",
          kind: "bigChest",
          name: "Turtle Rock - Big Chest",
          req: "bigKeyD7 & (reach(turtleRockUpper) & keyD7 >= 2 | reach(turtleRockMiddle) & (hookshot | caneOfSomaria) | reach(turtleRockLower) & lamp >= setting(requireLamp) & caneOfSomaria)",
          source: "app/Region/Standard/TurtleRock.php:166",
        },
        {
          // Two keys; with wild keys four, three if the chest holds a key
          // and two if it holds the big key (`hasItem`), which a tracker
          // cannot know: `maybe`
          id: "turtle-rock/big-key-chest",
          kind: "chest",
          name: "Turtle Rock - Big Key Chest",
          req: "keyD7 >= 4 | keyD7 >= 2 & (!setting(wildKeys) | maybe)",
          source: "app/Region/Standard/TurtleRock.php:175",
        },
        {
          id: "turtle-rock/crystaroller-room",
          kind: "chest",
          name: "Turtle Rock - Crystaroller Room",
          req: "bigKeyD7 & (reach(turtleRockUpper) & keyD7 >= 2 | reach(turtleRockMiddle)) | reach(turtleRockLower) & lamp >= setting(requireLamp) & caneOfSomaria",
          source: "app/Region/Standard/TurtleRock.php:186",
        },
        {
          id: "turtle-rock/eye-bridge/bottom-left",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Bottom Left",
          req: EYE_BRIDGE,
          source: "app/Region/Standard/TurtleRock.php:192",
        },
        {
          id: "turtle-rock/eye-bridge/bottom-right",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Bottom Right",
          req: EYE_BRIDGE,
          source: "app/Region/Standard/TurtleRock.php:200",
        },
        {
          id: "turtle-rock/eye-bridge/top-left",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Top Left",
          req: EYE_BRIDGE,
          source: "app/Region/Standard/TurtleRock.php:208",
        },
        {
          id: "turtle-rock/eye-bridge/top-right",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Top Right",
          req: EYE_BRIDGE,
          source: "app/Region/Standard/TurtleRock.php:216",
        },
        {
          id: "turtle-rock/boss",
          kind: "drop",
          name: "Turtle Rock - Boss",
          req: BOSS,
          source: "app/Region/Standard/TurtleRock.php:228",
        },
        {
          id: "turtle-rock/prize",
          kind: "prize",
          name: "Turtle Rock - Prize",
          req: BOSS,
          source: "app/Region/Standard/TurtleRock.php:224",
        },
      ],
      name: "Turtle Rock",
      prize: "turtle-rock/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD7",
          "Compass",
          "CompassD7",
          "Key",
          "KeyD7",
          "Map",
          "MapD7",
          "Crystal7",
        ],
        source: "app/Region/Standard/TurtleRock.php:27",
      },
    },
    {
      // `$upper`: up East Death Mountain, the pegs hammered and the dark
      // rock lifted to the pad; or a clip
      entrances: [
        {
          from: "eastDeathMountain",
          req: `${UPPER} & hammer & @canLiftDarkRocks`,
          source: "app/Region/Standard/TurtleRock.php:97",
        },
        {
          from: "start",
          req: `${UPPER} & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))`,
          source: "app/Region/Standard/TurtleRock.php:99",
        },
      ],
      id: "turtleRockUpper",
      locations: [],
    },
    {
      // `$middle`: the ledges of East Dark World Death Mountain, through a
      // glitch only
      entrances: [
        {
          from: "eastDarkWorldDeathMountain",
          req: "(setting(canMirrorClip) & magicMirror & (moonPearl | setting(canDungeonRevive)) | setting(canBootsClip) & pegasusBoots & (setting(canOWYBA) & @hasABottle | moonPearl) | setting(canSuperSpeed) & moonPearl & @canSpinSpeed | setting(canOneFrameClipOW) & (setting(canDungeonRevive) | moonPearl | setting(canOWYBA) & @hasABottle)) & (pegasusBoots | caneOfSomaria | hookshot | !setting(cantTakeDamage) | cape | caneOfByrna)",
          source: "app/Region/Standard/TurtleRock.php:103",
        },
      ],
      id: "turtleRockMiddle",
      locations: [],
    },
    {
      // `$lower`: the mirror wrapped from West Death Mountain or East Dark
      // World Death Mountain, through a glitch only
      entrances: [
        {
          from: "westDeathMountain",
          req: `${LOWER} & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))`,
          source: "app/Region/Standard/TurtleRock.php:121",
        },
        {
          from: "eastDarkWorldDeathMountain",
          req: `${LOWER} & setting(canSuperSpeed) & @canSpinSpeed`,
          source: "app/Region/Standard/TurtleRock.php:123",
        },
      ],
      id: "turtleRockLower",
      locations: [],
    },
  ],
} as const satisfies RegionModule;
