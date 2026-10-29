// app/Region/Standard/SwampPalace.php: Swamp Palace, its locations and its
// prize. The glitched branch of can_enter (185-192: canOneFrameClipUW with
// canBootsClip, canSuperSpeed or canOneFrameClipOW) needs Misery Mire
// (`$mire`), the Old Man's location (West Death Mountain) and South Dark
// World at once: a way from Misery Mire, every location guarded by the
// others (`enteredAlsoFrom`).
import { dungeonBoss } from "../../bosses";
import { enteredAlsoFrom, type RegionModule } from "../../world";

/** `$mire` (75-79): one-frame clipping in from Misery Mire, with its keys. */
const MIRE = "setting(canOneFrameClipUW) & keyD6 >= 3 & reach(miseryMire)";

/** `$hera` (81-85): one-frame clipping in from Tower of Hera. */
const HERA = "setting(canOneFrameClipUW) & reach(towerOfHera) & bigKeyP3";

/** The first key door, then the hammer's pegs, as most chests want them. */
const PAST_PEGS = `(keyD2 | ${MIRE}) & (hammer | ${MIRE} | ${HERA})`;

/**
 * The boss (154-175), whose rule is the prize's too: can_complete is the
 * boss's canAccess (150-152). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss(
  `hookshot & ${PAST_PEGS} & @canBeatSwampPalaceBoss`,
  "D2",
  {
    always: 172,
    file: "app/Region/Standard/SwampPalace.php",
    fill: 162,
    holding: 160,
  },
);

/** The palace's rules as can_enter's first branch reads them. */
const RULES = {
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
          // The palace's key and nothing else, unless keys are wild: the
          // first door needs it (87-91)
          fill: {
            refuse: [
              {
                refuse: { allBut: ["KeyD2"] },
                source: "app/Region/Standard/SwampPalace.php:87",
                when: "!setting(canOneFrameClipUW) & !setting(wildKeys)",
              },
            ],
          },
          id: "swamp-palace/entrance",
          kind: "chest",
          name: "Swamp Palace - Entrance",
          req: "true",
          source: "app/Region/Standard/SwampPalace.php:50",
        },
        {
          // The big key may lock itself in here, unless every location must
          // be reachable: nothing else needs it
          fill: {
            always: {
              items: ["BigKeyD2"],
              req: "!setting(locationsAccessibility)",
              source: "app/Region/Standard/SwampPalace.php:100",
            },
            refuse: [
              {
                refuse: { items: ["BigKeyD2"] },
                source: "app/Region/Standard/SwampPalace.php:102",
                when: "setting(locationsAccessibility)",
              },
            ],
          },
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
          fill: BOSS.fill,
          id: "swamp-palace/boss",
          kind: "drop",
          name: "Swamp Palace - Boss",
          req: BOSS.req,
          source: "app/Region/Standard/SwampPalace.php:154",
        },
        {
          id: "swamp-palace/prize",
          kind: "prize",
          name: "Swamp Palace - Prize",
          req: BOSS.req,
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

/**
 * The glitched branch's clip and run (189-192): the boots clip, a spin speed
 * or a one-frame clip overworld.
 */
const CLIP_IN =
  "(pegasusBoots & setting(canBootsClip) | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW))";

/** The Old Man's location reached (West.php:46): `$locations["Old Man"]->canAccess`. */
const OLD_MAN = "reach(westDeathMountain) & lamp >= setting(requireLamp)";

export const SWAMP_PALACE = enteredAlsoFrom(
  RULES,
  "swampPalace",
  {
    // can_enter (177-193), its second branch: one-frame clipping in from
    // Misery Mire with its keys (`$mire`) and either big key
    from: "miseryMire",
    req: `rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & flippers & setting(canOneFrameClipUW) & (bigKeyP3 | bigKeyD6) & keyD6 >= 3 & ${CLIP_IN}`,
    source: "app/Region/Standard/SwampPalace.php:185",
  },
  `!setting(canOneFrameClipUW) | reach(southDarkWorld) & (moonPearl & magicMirror | ${OLD_MAN})`,
);
