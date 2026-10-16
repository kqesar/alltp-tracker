// app/Region/Standard/SkullWoods.php: Skull Woods, its locations and its
// prize.
//
// Not ported here: the fill rules and always-allow of the Pinball Room
// (106-108, the key basic placement forces there), the Big Chest (112-116)
// and the boss (138-151), which Location::canFill reads when the randomizer
// places an item; they wait for src/fill.ts. canPlaceBoss (81-96) is boss
// shuffle's, which the pack does not model (bosses.ts).
import type { RegionModule } from "../../world";

/**
 * The back of the dungeon, which the Fire Rod burns open (119-121, 130-132):
 * as Link, with the Moon Pearl, or by a dungeon revive.
 */
const BACK =
  "fireRod & (moonPearl | setting(canDungeonRevive) & pegasusBoots & (magicMirror | @hasABottle))";

/**
 * The boss (128-137), whose rule is the prize's too: can_complete is the
 * boss's canAccess (124-126). With wild maps or compasses the boss wants its
 * dungeon's, unless it holds that item itself (`hasItem`), which a tracker
 * cannot know: `maybe`.
 */
const BOSS = `${BACK} & (setting(swordless) | @hasSword) & keyD3 >= 3 & @canBeatSkullWoodsBoss & (!setting(wildCompasses) | compassD3 | maybe) & (!setting(wildMaps) | mapD3 | maybe)`;

export const SKULL_WOODS = {
  file: "app/Region/Standard/SkullWoods.php",
  regions: [
    {
      entrances: [
        {
          from: "northWestDarkWorld",
          req: "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & (setting(canDungeonRevive) | moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canBunnyRevive)",
          source: "app/Region/Standard/SkullWoods.php:153",
        },
      ],
      id: "skullWoods",
      locations: [
        {
          id: "skull-woods/big-chest",
          kind: "bigChest",
          name: "Skull Woods - Big Chest",
          req: "bigKeyD3",
          source: "app/Region/Standard/SkullWoods.php:110",
        },
        {
          id: "skull-woods/big-key-chest",
          kind: "chest",
          name: "Skull Woods - Big Key Chest",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:58",
        },
        {
          id: "skull-woods/compass-chest",
          kind: "chest",
          name: "Skull Woods - Compass Chest",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:59",
        },
        {
          id: "skull-woods/map-chest",
          kind: "chest",
          name: "Skull Woods - Map Chest",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:60",
        },
        {
          id: "skull-woods/bridge-room",
          kind: "chest",
          name: "Skull Woods - Bridge Room",
          req: BACK,
          source: "app/Region/Standard/SkullWoods.php:118",
        },
        {
          id: "skull-woods/pot-prison",
          kind: "chest",
          name: "Skull Woods - Pot Prison",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:62",
        },
        {
          id: "skull-woods/pinball-room",
          kind: "chest",
          name: "Skull Woods - Pinball Room",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:63",
        },
        {
          id: "skull-woods/boss",
          kind: "drop",
          name: "Skull Woods - Boss",
          req: BOSS,
          source: "app/Region/Standard/SkullWoods.php:128",
        },
        {
          id: "skull-woods/prize",
          kind: "prize",
          name: "Skull Woods - Prize",
          req: BOSS,
          source: "app/Region/Standard/SkullWoods.php:124",
        },
      ],
      name: "Skull Woods",
      prize: "skull-woods/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD3",
          "Compass",
          "CompassD3",
          "Key",
          "KeyD3",
          "Map",
          "MapD3",
          "Crystal3",
        ],
        source: "app/Region/Standard/SkullWoods.php:31",
      },
    },
  ],
} as const satisfies RegionModule;
