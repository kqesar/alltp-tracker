// app/Region/Standard/ThievesTown.php: Thieves' Town, its locations and its
// prize.
import { dungeonBoss } from "../../bosses";
import type { RegionModule } from "../../world";

/**
 * The boss (97-116), whose rule is the prize's too: can_complete is the
 * boss's canAccess (93-95). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss("keyD4 & bigKeyD4 & @canBeatThievesTownBoss", "D4", {
  always: 113,
  file: "app/Region/Standard/ThievesTown.php",
  fill: 103,
  holding: 101,
});

export const THIEVES_TOWN = {
  file: "app/Region/Standard/ThievesTown.php",
  regions: [
    {
      entrances: [
        {
          from: "northWestDarkWorld",
          req: "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & (moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canSpinSpeed)",
          source: "app/Region/Standard/ThievesTown.php:118",
        },
      ],
      id: "thievesTown",
      locations: [
        {
          id: "thieves-town/attic",
          kind: "chest",
          name: "Thieves' Town - Attic",
          req: "keyD4 & bigKeyD4",
          source: "app/Region/Standard/ThievesTown.php:73",
        },
        {
          id: "thieves-town/big-key-chest",
          kind: "chest",
          name: "Thieves' Town - Big Key Chest",
          req: "true",
          source: "app/Region/Standard/ThievesTown.php:51",
        },
        {
          id: "thieves-town/map-chest",
          kind: "chest",
          name: "Thieves' Town - Map Chest",
          req: "true",
          source: "app/Region/Standard/ThievesTown.php:52",
        },
        {
          id: "thieves-town/compass-chest",
          kind: "chest",
          name: "Thieves' Town - Compass Chest",
          req: "true",
          source: "app/Region/Standard/ThievesTown.php:53",
        },
        {
          id: "thieves-town/ambush-chest",
          kind: "chest",
          name: "Thieves' Town - Ambush Chest",
          req: "true",
          source: "app/Region/Standard/ThievesTown.php:54",
        },
        {
          // The key may sit here once the hammer is assumed, unless every
          // location must be reachable
          fill: {
            always: {
              items: ["KeyD4"],
              req: "!setting(locationsAccessibility) & hammer",
              source: "app/Region/Standard/ThievesTown.php:83",
            },
            holding: {
              items: { KeyD4: "hammer & bigKeyD4" },
              otherwise: "hammer & keyD4 & bigKeyD4",
              source: "app/Region/Standard/ThievesTown.php:78",
            },
            refuse: [
              {
                refuse: { items: ["KeyD4"] },
                source: "app/Region/Standard/ThievesTown.php:85",
                when: "setting(locationsAccessibility)",
              },
            ],
          },
          id: "thieves-town/big-chest",
          kind: "bigChest",
          name: "Thieves' Town - Big Chest",
          // The dungeon's key placed in the chest itself opens it without
          // that key (78-80): where it sits is not known, so that is `maybe`
          req: "hammer & keyD4 & bigKeyD4 | maybe & hammer & bigKeyD4",
          source: "app/Region/Standard/ThievesTown.php:77",
        },
        {
          id: "thieves-town/blinds-cell",
          kind: "chest",
          name: "Thieves' Town - Blind's Cell",
          req: "bigKeyD4",
          source: "app/Region/Standard/ThievesTown.php:89",
        },
        {
          fill: BOSS.fill,
          id: "thieves-town/boss",
          kind: "drop",
          name: "Thieves' Town - Boss",
          req: BOSS.req,
          source: "app/Region/Standard/ThievesTown.php:97",
        },
        {
          id: "thieves-town/prize",
          kind: "prize",
          name: "Thieves' Town - Prize",
          req: BOSS.req,
          source: "app/Region/Standard/ThievesTown.php:93",
        },
      ],
      name: "Thieves Town",
      prize: "thieves-town/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD4",
          "Compass",
          "CompassD4",
          "Key",
          "KeyD4",
          "Map",
          "MapD4",
          "Crystal4",
        ],
        source: "app/Region/Standard/ThievesTown.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
