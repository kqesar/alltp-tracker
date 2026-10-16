// app/Region/Standard/SkullWoods.php: Skull Woods, its locations and its
// prize.
//
// Not ported here: canPlaceBoss (81-96), boss shuffle's, which the pack does
// not model (bosses.ts).
import { dungeonBoss } from "../../bosses";
import type { RegionModule } from "../../world";

/**
 * The back of the dungeon, which the Fire Rod burns open (119-121, 130-132):
 * as Link, with the Moon Pearl, or by a dungeon revive.
 */
const BACK =
  "fireRod & (moonPearl | setting(canDungeonRevive) & pegasusBoots & (magicMirror | @hasABottle))";

/**
 * The boss (128-151), whose rule is the prize's too: can_complete is the
 * boss's canAccess (124-126). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss(
  `${BACK} & (setting(swordless) | @hasSword) & keyD3 >= 3 & @canBeatSkullWoodsBoss`,
  "D3",
  {
    always: 148,
    file: "app/Region/Standard/SkullWoods.php",
    fill: 138,
    holding: 136,
  },
);

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
          // The big key may lock itself in here, unless every location must
          // be reachable: nothing else needs it
          fill: {
            always: {
              items: ["BigKeyD3"],
              req: "!setting(locationsAccessibility)",
              source: "app/Region/Standard/SkullWoods.php:112",
            },
            refuse: [
              {
                refuse: { items: ["BigKeyD3"] },
                source: "app/Region/Standard/SkullWoods.php:114",
                when: "setting(locationsAccessibility)",
              },
            ],
          },
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
          // The basic placement forces a key here (106-108)
          fill: {
            refuse: [
              {
                refuse: { allBut: ["KeyD3"] },
                source: "app/Region/Standard/SkullWoods.php:106",
                when: "setting(forceSkullWoodsKey)",
              },
            ],
          },
          id: "skull-woods/pinball-room",
          kind: "chest",
          name: "Skull Woods - Pinball Room",
          req: "true",
          source: "app/Region/Standard/SkullWoods.php:63",
        },
        {
          fill: BOSS.fill,
          id: "skull-woods/boss",
          kind: "drop",
          name: "Skull Woods - Boss",
          req: BOSS.req,
          source: "app/Region/Standard/SkullWoods.php:128",
        },
        {
          id: "skull-woods/prize",
          kind: "prize",
          name: "Skull Woods - Prize",
          req: BOSS.req,
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
