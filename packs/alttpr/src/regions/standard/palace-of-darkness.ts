// app/Region/Standard/PalaceOfDarkness.php: Palace of Darkness, its
// locations and its prize.
//
// Its key doors want one key more once Link holds the hammer, a bow and the
// lamp (88, 102, 108, 113, 116, 131, 137, 145, 151), which no monotone rule
// can say: the rules read `podFewerKeysSuffice`, a fact the state derives
// from the items (src/derived.ts).
//
// Not ported here: the fill rules and always-allow of the Big Key Chest
// (89-93), Harmless Hellway (117-121), Big Chest (103-105), the Dark Maze
// (146-148, 152-154) and the boss (167-180), which Location::canFill reads
// when the randomizer places an item; they wait for src/fill.ts.
import type { RegionModule } from "../../world";

/**
 * `(Hammer && canShootArrows && Lamp) || wildKeys ? KeyD1 >= 6 : KeyD1 >= 5`
 * (88): six keys, or five while the fact says the fewer suffice.
 */
const SIX_KEYS =
  "keyD1 >= 6 | !setting(wildKeys) & podFewerKeysSuffice & keyD1 >= 5";

/** The same condition, with 4 keys against 3 (108). */
const FOUR_KEYS =
  "keyD1 >= 4 | !setting(wildKeys) & podFewerKeysSuffice & keyD1 >= 3";

const LAMP = "lamp >= setting(requireLamp)";

/**
 * Both chests of the Dark Basement (128-132, 134-138): the lamp, or the Fire
 * Rod in the advanced placement.
 */
const DARK_BASEMENT = `(${LAMP} | setting(advancedPlacement) & fireRod) & (${FOUR_KEYS})`;

/**
 * Both chests of the Dark Maze (144-145, 150-151). Upstream's condition has
 * no lamp here, as at the Big Chest (102): the maze wants it anyway, so the
 * fact is the same condition.
 */
const DARK_MAZE = `${LAMP} & (${SIX_KEYS})`;

/**
 * The boss (160-166), whose rule is the prize's too: can_complete is the
 * boss's canAccess (156-158). With wild maps or compasses the boss wants its
 * dungeon's, unless it holds that item itself (`hasItem`), which a tracker
 * cannot know: `maybe`.
 */
const BOSS = `@canBeatPalaceOfDarknessBoss & hammer & ${LAMP} & @canShootArrows & bigKeyD1 & keyD1 >= 6 & (!setting(wildCompasses) | compassD1 | maybe) & (!setting(wildMaps) | mapD1 | maybe)`;

/**
 * can_enter's gate before its branches (183-185): Zelda rescued, and with
 * the basic placement a sword (or swordless), 7 hearts and a bottle.
 */
const GATE =
  "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle)";

export const PALACE_OF_DARKNESS = {
  file: "app/Region/Standard/PalaceOfDarkness.php",
  regions: [
    {
      entrances: [
        {
          from: "northEastDarkWorld",
          req: `${GATE} & (moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive)`,
          source: "app/Region/Standard/PalaceOfDarkness.php:186",
        },
        {
          from: "westDeathMountain",
          req: `${GATE} & setting(canOneFrameClipUW) & setting(canDungeonRevive)`,
          source: "app/Region/Standard/PalaceOfDarkness.php:190",
        },
      ],
      id: "palaceOfDarkness",
      locations: [
        {
          id: "palace-of-darkness/shooter-room",
          kind: "chest",
          name: "Palace of Darkness - Shooter Room",
          req: "true",
          source: "app/Region/Standard/PalaceOfDarkness.php:50",
        },
        {
          id: "palace-of-darkness/big-key-chest",
          kind: "chest",
          name: "Palace of Darkness - Big Key Chest",
          // A key placed in the chest itself opens it with one key (84-86):
          // where the keys sit is not known, so that is `maybe`
          req: `${SIX_KEYS} | maybe & keyD1`,
          source: "app/Region/Standard/PalaceOfDarkness.php:83",
        },
        {
          id: "palace-of-darkness/the-arena/ledge",
          kind: "chest",
          name: "Palace of Darkness - The Arena - Ledge",
          req: "@canShootArrows",
          source: "app/Region/Standard/PalaceOfDarkness.php:79",
        },
        {
          id: "palace-of-darkness/the-arena/bridge",
          kind: "chest",
          name: "Palace of Darkness - The Arena - Bridge",
          req: "keyD1 | @canShootArrows & hammer",
          source: "app/Region/Standard/PalaceOfDarkness.php:95",
        },
        {
          id: "palace-of-darkness/stalfos-basement",
          kind: "chest",
          name: "Palace of Darkness - Stalfos Basement",
          req: "keyD1 | @canShootArrows & hammer",
          source: "app/Region/Standard/PalaceOfDarkness.php:123",
        },
        {
          id: "palace-of-darkness/map-chest",
          kind: "chest",
          name: "Palace of Darkness - Map Chest",
          req: "@canShootArrows",
          source: "app/Region/Standard/PalaceOfDarkness.php:140",
        },
        {
          id: "palace-of-darkness/big-chest",
          kind: "bigChest",
          name: "Palace of Darkness - Big Chest",
          // Upstream's condition here has no lamp (102): the chest wants it
          // anyway, so the fact is the same condition
          req: `${LAMP} & bigKeyD1 & (${SIX_KEYS})`,
          source: "app/Region/Standard/PalaceOfDarkness.php:100",
        },
        {
          id: "palace-of-darkness/compass-chest",
          kind: "chest",
          name: "Palace of Darkness - Compass Chest",
          req: FOUR_KEYS,
          source: "app/Region/Standard/PalaceOfDarkness.php:107",
        },
        {
          id: "palace-of-darkness/harmless-hellway",
          kind: "chest",
          name: "Palace of Darkness - Harmless Hellway",
          // A key placed here wants the lower counts (112-114): `maybe`
          req: `${SIX_KEYS} | maybe & (${FOUR_KEYS})`,
          source: "app/Region/Standard/PalaceOfDarkness.php:111",
        },
        {
          id: "palace-of-darkness/dark-basement/left",
          kind: "chest",
          name: "Palace of Darkness - Dark Basement - Left",
          req: DARK_BASEMENT,
          source: "app/Region/Standard/PalaceOfDarkness.php:128",
        },
        {
          id: "palace-of-darkness/dark-basement/right",
          kind: "chest",
          name: "Palace of Darkness - Dark Basement - Right",
          req: DARK_BASEMENT,
          source: "app/Region/Standard/PalaceOfDarkness.php:134",
        },
        {
          id: "palace-of-darkness/dark-maze/top",
          kind: "chest",
          name: "Palace of Darkness - Dark Maze - Top",
          req: DARK_MAZE,
          source: "app/Region/Standard/PalaceOfDarkness.php:144",
        },
        {
          id: "palace-of-darkness/dark-maze/bottom",
          kind: "chest",
          name: "Palace of Darkness - Dark Maze - Bottom",
          req: DARK_MAZE,
          source: "app/Region/Standard/PalaceOfDarkness.php:150",
        },
        {
          id: "palace-of-darkness/boss",
          kind: "drop",
          name: "Palace of Darkness - Boss",
          req: BOSS,
          source: "app/Region/Standard/PalaceOfDarkness.php:160",
        },
        {
          id: "palace-of-darkness/prize",
          kind: "prize",
          name: "Palace of Darkness - Prize",
          req: BOSS,
          source: "app/Region/Standard/PalaceOfDarkness.php:156",
        },
      ],
      name: "Palace of Darkness",
      prize: "palace-of-darkness/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD1",
          "Compass",
          "CompassD1",
          "Key",
          "KeyD1",
          "Map",
          "MapD1",
          "Crystal1",
        ],
        source: "app/Region/Standard/PalaceOfDarkness.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
