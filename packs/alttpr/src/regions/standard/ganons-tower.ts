// app/Region/Standard/GanonsTower.php: Ganon's Tower, its locations and its
// prize, Agahnim 2.
//
// The tower fights four bosses: Agahnim 2 (`$this->boss`) and the three it
// meets on the way up (`boss_bottom`, `boss_middle`, `boss_top`), each a
// slot of bosses.ts. getBoss, setBoss and canPlaceBoss (94-184) are boss
// shuffle's, which the pack does not model.
import type { LocationFill } from "../../location";
import type { RegionModule } from "../../world";

/** A setFillRules that refuses these items here. */
const REFUSE = (line: number, ...items: string[]) =>
  ({
    refuse: [
      {
        refuse: { items },
        source: `app/Region/Standard/GanonsTower.php:${line}`,
      },
    ],
  }) as const satisfies LocationFill;

/**
 * can_enter (396-416): RescueZelda and the basic placement's health gate,
 * around every way in.
 */
const GATE =
  "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor))";

/** The pearl, or with glitches a bottle (400), on both Death Mountain ways. */
const PEARL = "(moonPearl | setting(canOWYBA) & @hasABottle)";

/** The way to the Map Chest, before its keys (266). */
const MAP_CHEST_WAY =
  "hammer & (hookshot | !setting(basicPlacement) & pegasusBoots)";

/** The four chests of the DMs room (198-212). */
const DMS_ROOM = "hammer & hookshot";

/**
 * The four chests of the randomizer room (214-252): four keys, or three
 * when the big key sits in one of the three others (`itemInLocations`),
 * which a tracker cannot know: `maybe`.
 */
const RANDOMIZER_ROOM = "hammer & hookshot & (keyA2 >= 4 | maybe & keyA2 >= 3)";

/** The four chests of the compass room (293-331), as the randomizer room. */
const COMPASS_ROOM =
  "fireRod & caneOfSomaria & (keyA2 >= 4 | maybe & keyA2 >= 3)";

/** The big key chest and room, past the bottom boss (333-352). */
const BIG_KEY_ROOM =
  "(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & @canBeatGanonsTowerBottomBoss";

/** The chests past the big key door and the middle boss (354-376). */
const UPSTAIRS =
  "@canShootArrows & @canLightTorches & bigKeyA2 & keyA2 >= 3 & @canBeatGanonsTowerMiddleBoss";

/**
 * The Moldorm Chest (378-383), past the top boss; Agahnim 2 wants it too
 * (388-392).
 */
const MOLDORM_CHEST =
  "hookshot & @canShootArrows & @canLightTorches & bigKeyA2 & keyA2 >= 4 & @canBeatGanonsTowerMiddleBoss & @canBeatGanonsTowerTopBoss";

export const GANONS_TOWER = {
  file: "app/Region/Standard/GanonsTower.php",
  regions: [
    {
      entrances: [
        {
          // The way the game opens: the crystals crystals.tower asks for
          from: "eastDarkWorldDeathMountain",
          req: `${GATE} & ${PEARL} & count(crystal) >= setting(crystalsTower)`,
          source: "app/Region/Standard/GanonsTower.php:401",
        },
        {
          from: "westDarkWorldDeathMountain",
          req: `${GATE} & ${PEARL} & (setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & pegasusBoots & hookshot)`,
          source: "app/Region/Standard/GanonsTower.php:409",
        },
        {
          from: "start",
          req: `${GATE} & setting(canOneFrameClipOW) & (setting(canDungeonRevive) | moonPearl | setting(canOWYBA) & @hasABottle)`,
          source: "app/Region/Standard/GanonsTower.php:413",
        },
      ],
      id: "ganonsTower",
      locations: [
        {
          id: "ganons-tower/bobs-torch",
          kind: "dash",
          name: "Ganon's Tower - Bob's Torch",
          req: "pegasusBoots",
          source: "app/Region/Standard/GanonsTower.php:194",
        },
        {
          id: "ganons-tower/dms-room/top-left",
          kind: "chest",
          name: "Ganon's Tower - DMs Room - Top Left",
          req: DMS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:198",
        },
        {
          id: "ganons-tower/dms-room/top-right",
          kind: "chest",
          name: "Ganon's Tower - DMs Room - Top Right",
          req: DMS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:202",
        },
        {
          id: "ganons-tower/dms-room/bottom-left",
          kind: "chest",
          name: "Ganon's Tower - DMs Room - Bottom Left",
          req: DMS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:206",
        },
        {
          id: "ganons-tower/dms-room/bottom-right",
          kind: "chest",
          name: "Ganon's Tower - DMs Room - Bottom Right",
          req: DMS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:210",
        },
        {
          id: "ganons-tower/randomizer-room/top-left",
          kind: "chest",
          name: "Ganon's Tower - Randomizer Room - Top Left",
          req: RANDOMIZER_ROOM,
          source: "app/Region/Standard/GanonsTower.php:214",
        },
        {
          id: "ganons-tower/randomizer-room/top-right",
          kind: "chest",
          name: "Ganon's Tower - Randomizer Room - Top Right",
          req: RANDOMIZER_ROOM,
          source: "app/Region/Standard/GanonsTower.php:224",
        },
        {
          id: "ganons-tower/randomizer-room/bottom-left",
          kind: "chest",
          name: "Ganon's Tower - Randomizer Room - Bottom Left",
          req: RANDOMIZER_ROOM,
          source: "app/Region/Standard/GanonsTower.php:234",
        },
        {
          id: "ganons-tower/randomizer-room/bottom-right",
          kind: "chest",
          name: "Ganon's Tower - Randomizer Room - Bottom Right",
          req: RANDOMIZER_ROOM,
          source: "app/Region/Standard/GanonsTower.php:244",
        },
        {
          fill: {
            holding: {
              items: { KeyA2: "hammer & hookshot & keyA2 >= 2" },
              source: "app/Region/Standard/GanonsTower.php:261",
            },
          },
          // Three keys, or two when the big key sits in the randomizer room
          // or a key in this chest (`itemInLocations`, `hasItem`): `maybe`
          id: "ganons-tower/firesnake-room",
          kind: "chest",
          name: "Ganon's Tower - Firesnake Room",
          req: "hammer & hookshot & (keyA2 >= 3 | maybe & keyA2 >= 2)",
          source: "app/Region/Standard/GanonsTower.php:254",
        },
        {
          // A key may sit here once three others are found, unless every
          // location must be reachable
          fill: {
            always: {
              items: ["KeyA2"],
              req: "!setting(locationsAccessibility) & keyA2 >= 3",
              source: "app/Region/Standard/GanonsTower.php:269",
            },
            holding: {
              items: {
                BigKeyA2: `${MAP_CHEST_WAY} & keyA2 >= 3`,
                KeyA2: `${MAP_CHEST_WAY} & keyA2 >= 3`,
              },
              otherwise: `${MAP_CHEST_WAY} & keyA2 >= 4`,
              source: "app/Region/Standard/GanonsTower.php:267",
            },
            refuse: [
              {
                refuse: { items: ["KeyA2"] },
                source: "app/Region/Standard/GanonsTower.php:271",
                when: "setting(locationsAccessibility)",
              },
            ],
          },
          // Four keys, or three when the chest holds a key or the big key
          // itself (`getItem`), which a tracker cannot know: `maybe`
          id: "ganons-tower/map-chest",
          kind: "chest",
          name: "Ganon's Tower - Map Chest",
          req: `${MAP_CHEST_WAY} & (keyA2 >= 4 | maybe & keyA2 >= 3)`,
          source: "app/Region/Standard/GanonsTower.php:265",
        },
        {
          fill: REFUSE(278, "BigKeyA2"),
          id: "ganons-tower/big-chest",
          kind: "bigChest",
          name: "Ganon's Tower - Big Chest",
          req: "bigKeyA2 & keyA2 >= 3 & (hammer & hookshot | fireRod & caneOfSomaria)",
          source: "app/Region/Standard/GanonsTower.php:275",
        },
        {
          id: "ganons-tower/hope-room/left",
          kind: "chest",
          name: "Ganon's Tower - Hope Room - Left",
          req: "true",
          source: "app/Region/Standard/GanonsTower.php:65",
        },
        {
          id: "ganons-tower/hope-room/right",
          kind: "chest",
          name: "Ganon's Tower - Hope Room - Right",
          req: "true",
          source: "app/Region/Standard/GanonsTower.php:66",
        },
        {
          id: "ganons-tower/bobs-chest",
          kind: "chest",
          name: "Ganon's Tower - Bob's Chest",
          req: "(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & (!setting(basicPlacement) | fireRod | ether & @hasSword)",
          source: "app/Region/Standard/GanonsTower.php:282",
        },
        {
          id: "ganons-tower/tile-room",
          kind: "chest",
          name: "Ganon's Tower - Tile Room",
          req: "caneOfSomaria",
          source: "app/Region/Standard/GanonsTower.php:289",
        },
        {
          id: "ganons-tower/compass-room/top-left",
          kind: "chest",
          name: "Ganon's Tower - Compass Room - Top Left",
          req: COMPASS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:293",
        },
        {
          id: "ganons-tower/compass-room/top-right",
          kind: "chest",
          name: "Ganon's Tower - Compass Room - Top Right",
          req: COMPASS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:303",
        },
        {
          id: "ganons-tower/compass-room/bottom-left",
          kind: "chest",
          name: "Ganon's Tower - Compass Room - Bottom Left",
          req: COMPASS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:313",
        },
        {
          id: "ganons-tower/compass-room/bottom-right",
          kind: "chest",
          name: "Ganon's Tower - Compass Room - Bottom Right",
          req: COMPASS_ROOM,
          source: "app/Region/Standard/GanonsTower.php:323",
        },
        {
          id: "ganons-tower/big-key-chest",
          kind: "chest",
          name: "Ganon's Tower - Big Key Chest",
          req: BIG_KEY_ROOM,
          source: "app/Region/Standard/GanonsTower.php:333",
        },
        {
          id: "ganons-tower/big-key-room/left",
          kind: "chest",
          name: "Ganon's Tower - Big Key Room - Left",
          req: BIG_KEY_ROOM,
          source: "app/Region/Standard/GanonsTower.php:340",
        },
        {
          id: "ganons-tower/big-key-room/right",
          kind: "chest",
          name: "Ganon's Tower - Big Key Room - Right",
          req: BIG_KEY_ROOM,
          source: "app/Region/Standard/GanonsTower.php:347",
        },
        {
          fill: REFUSE(358, "BigKeyA2"),
          id: "ganons-tower/mini-helmasaur-room/left",
          kind: "chest",
          name: "Ganon's Tower - Mini Helmasaur Room - Left",
          req: UPSTAIRS,
          source: "app/Region/Standard/GanonsTower.php:354",
        },
        {
          fill: REFUSE(366, "BigKeyA2"),
          id: "ganons-tower/mini-helmasaur-room/right",
          kind: "chest",
          name: "Ganon's Tower - Mini Helmasaur Room - Right",
          req: UPSTAIRS,
          source: "app/Region/Standard/GanonsTower.php:362",
        },
        {
          fill: REFUSE(374, "BigKeyA2"),
          id: "ganons-tower/pre-moldorm-chest",
          kind: "chest",
          name: "Ganon's Tower - Pre-Moldorm Chest",
          req: UPSTAIRS,
          source: "app/Region/Standard/GanonsTower.php:370",
        },
        {
          fill: REFUSE(384, "KeyA2", "BigKeyA2"),
          id: "ganons-tower/moldorm-chest",
          kind: "chest",
          name: "Ganon's Tower - Moldorm Chest",
          req: MOLDORM_CHEST,
          source: "app/Region/Standard/GanonsTower.php:378",
        },
        {
          // can_complete: the Moldorm Chest's canAccess, then Agahnim 2
          id: "agahnim-2",
          kind: "prize",
          name: "Agahnim 2",
          req: `${MOLDORM_CHEST} & @canBeatGanonsTowerBoss`,
          source: "app/Region/Standard/GanonsTower.php:388",
        },
      ],
      name: "Ganons Tower",
      prize: "agahnim-2",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyA2",
          "Compass",
          "CompassA2",
          "Key",
          "KeyA2",
          "Map",
          "MapA2",
        ],
        source: "app/Region/Standard/GanonsTower.php:25",
      },
    },
  ],
} as const satisfies RegionModule;
