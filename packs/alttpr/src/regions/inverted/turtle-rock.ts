// app/Region/Inverted/TurtleRock.php: Turtle Rock, its locations and its
// prize. Its initalize (85-217) replaces Standard's without calling it.
//
// As in Standard, its three ways in (`enterTop`, 53-62; `enterMiddle`,
// 64-71; `enterBottom`, 73-77) each need another region, so each is a part
// of the dungeon (turtleRockUpper, turtleRockMiddle, turtleRockLower) that
// Turtle Rock enters from. In Inverted the middle and bottom ones are no
// glitch: the mirror from East Death Mountain. `canReachTop`, `canReachMiddle`
// and `canReachBottom` (13-42) are the rooms reached from either way.
// `accountForWastingKeyOnTrinexDoor` (45-51) reads turtlerock.wastekey, which
// no config sets: the key wasted on Trinexx's door is always counted.
import { dungeonBoss } from "../../bosses";
import type { RegionModule } from "../../world";

const FILE = "app/Region/Inverted/TurtleRock.php";

const LAMP = "lamp >= setting(requireLamp)";

/** canReachTop (13-21). */
const TOP = `caneOfSomaria & (reach(turtleRockUpper) | reach(turtleRockMiddle) & keyD7 >= 4 | reach(turtleRockLower) & ${LAMP} & keyD7 >= 4)`;

/** canReachMiddle (23-30). */
const MIDDLE = `reach(turtleRockMiddle) | reach(turtleRockUpper) & keyD7 >= 3 | reach(turtleRockLower) & ${LAMP} & caneOfSomaria`;

/** canReachBottom (32-42). */
const BOTTOM = `reach(turtleRockLower) | (reach(turtleRockUpper) | reach(turtleRockMiddle)) & ${LAMP} & caneOfSomaria & bigKeyD7 & keyD7 >= 3`;

/** The four chests of the eye bridge (135-169). */
const EYE_BRIDGE = `(${BOTTOM}) & (!setting(basicPlacement) | cape | caneOfByrna | setting(mirrorShieldInPool) & @canBlockLasers)`;

/**
 * The basic placement's health gate around the three ways in (202-212):
 * two swords (or swordless), 12 hearts and two bottles or armor.
 */
const GATE =
  "!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)";

/**
 * The boss (175-200), whose rule is the prize's too: can_complete is the
 * boss's canAccess (171-173, 214). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss(
  `(${BOTTOM}) & keyD7 >= 4 & bigKeyD7 & caneOfSomaria & @canBeatTurtleRockBoss`,
  "D7",
  { always: 197, file: FILE, fill: 187, holding: 181 },
);

export const INVERTED_TURTLE_ROCK = {
  file: FILE,
  regions: [
    {
      entrances: [
        { from: "turtleRockUpper", req: GATE, source: `${FILE}:209` },
        { from: "turtleRockMiddle", req: GATE, source: `${FILE}:210` },
        { from: "turtleRockLower", req: GATE, source: `${FILE}:211` },
      ],
      id: "turtleRock",
      locations: [
        {
          id: "turtle-rock/chain-chomps",
          kind: "chest",
          name: "Turtle Rock - Chain Chomps",
          req: "reach(turtleRockUpper) & caneOfSomaria & keyD7 >= 2 | reach(turtleRockMiddle)",
          source: `${FILE}:87`,
        },
        {
          id: "turtle-rock/compass-chest",
          kind: "chest",
          name: "Turtle Rock - Compass Chest",
          req: TOP,
          source: `${FILE}:104`,
        },
        {
          id: "turtle-rock/roller-room/left",
          kind: "chest",
          name: "Turtle Rock - Roller Room - Left",
          req: `fireRod & ${TOP}`,
          source: `${FILE}:94`,
        },
        {
          id: "turtle-rock/roller-room/right",
          kind: "chest",
          name: "Turtle Rock - Roller Room - Right",
          req: `fireRod & ${TOP}`,
          source: `${FILE}:99`,
        },
        {
          fill: {
            refuse: [
              { refuse: { items: ["BigKeyD7"] }, source: `${FILE}:113` },
            ],
          },
          id: "turtle-rock/big-chest",
          kind: "bigChest",
          name: "Turtle Rock - Big Chest",
          req: `bigKeyD7 & (${MIDDLE}) & (hookshot | caneOfSomaria)`,
          source: `${FILE}:108`,
        },
        {
          // A key may always sit here, but not when every location must be
          // reachable. Four keys, or holding a key itself (`hasItem`), which
          // a tracker cannot know: `maybe`
          fill: {
            always: { items: ["KeyD7"], req: "true", source: `${FILE}:122` },
            holding: {
              items: { KeyD7: MIDDLE },
              otherwise: `(${MIDDLE}) & keyD7 >= 4`,
              source: `${FILE}:121`,
            },
            refuse: [
              {
                refuse: { items: ["KeyD7"] },
                source: `${FILE}:124`,
                when: "setting(locationsAccessibility)",
              },
            ],
          },
          id: "turtle-rock/big-key-chest",
          kind: "chest",
          name: "Turtle Rock - Big Key Chest",
          req: `(${MIDDLE}) & (keyD7 >= 4 | maybe)`,
          source: `${FILE}:117`,
        },
        {
          id: "turtle-rock/crystaroller-room",
          kind: "chest",
          name: "Turtle Rock - Crystaroller Room",
          req: `bigKeyD7 & (${MIDDLE}) | reach(turtleRockLower) & ${LAMP} & caneOfSomaria`,
          source: `${FILE}:128`,
        },
        {
          id: "turtle-rock/eye-bridge/bottom-left",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Bottom Left",
          req: EYE_BRIDGE,
          source: `${FILE}:135`,
        },
        {
          id: "turtle-rock/eye-bridge/bottom-right",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Bottom Right",
          req: EYE_BRIDGE,
          source: `${FILE}:144`,
        },
        {
          id: "turtle-rock/eye-bridge/top-left",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Top Left",
          req: EYE_BRIDGE,
          source: `${FILE}:153`,
        },
        {
          id: "turtle-rock/eye-bridge/top-right",
          kind: "chest",
          name: "Turtle Rock - Eye Bridge - Top Right",
          req: EYE_BRIDGE,
          source: `${FILE}:162`,
        },
        {
          fill: BOSS.fill,
          id: "turtle-rock/boss",
          kind: "drop",
          name: "Turtle Rock - Boss",
          req: BOSS.req,
          source: `${FILE}:175`,
        },
        {
          id: "turtle-rock/prize",
          kind: "prize",
          name: "Turtle Rock - Prize",
          req: BOSS.req,
          source: `${FILE}:171`,
        },
      ],
      name: "Turtle Rock",
      prize: "turtle-rock/prize",
      // Standard's $region_items, which this class inherits
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
      // `enterTop`: the pad's medallion and a sword, and the Cane of
      // Somaria for the platforms, from the Dark World's Death Mountain. The
      // pad is knowledge in the state (medallions.ts)
      entrances: [
        {
          from: "eastDarkWorldDeathMountain",
          req: "@hasTurtleRockMedallion & (setting(swordless) | @hasSword) & caneOfSomaria",
          source: `${FILE}:55`,
        },
      ],
      id: "turtleRockUpper",
      locations: [],
    },
    {
      // `enterMiddle`: the mirror from East Death Mountain, or a spin speed
      // along the Dark World's ledges
      entrances: [
        { from: "eastDeathMountain", req: "magicMirror", source: `${FILE}:66` },
        {
          from: "eastDarkWorldDeathMountain",
          req: "setting(canSuperSpeed) & @canSpinSpeed",
          source: `${FILE}:68`,
        },
      ],
      id: "turtleRockMiddle",
      locations: [],
    },
    {
      // `enterBottom`: the mirror from East Death Mountain
      entrances: [
        { from: "eastDeathMountain", req: "magicMirror", source: `${FILE}:75` },
      ],
      id: "turtleRockLower",
      locations: [],
    },
  ],
} as const satisfies RegionModule;
