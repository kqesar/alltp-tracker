// app/Region/Standard/EasternPalace.php: Eastern Palace, its locations and
// its prize.
import { dungeonBoss } from "../../bosses";
import type { RegionModule } from "../../world";

/**
 * The boss (84-105), whose rule is the prize's too: can_complete is the
 * boss's canAccess (80-82). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss(
  "@canShootArrows & (lamp >= setting(requireLamp) | setting(advancedPlacement) & fireRod) & bigKeyP1 & @canBeatEasternPalaceBoss",
  "P1",
  {
    always: 102,
    file: "app/Region/Standard/EasternPalace.php",
    fill: 92,
    holding: 90,
  },
);

export const EASTERN_PALACE = {
  file: "app/Region/Standard/EasternPalace.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda",
          source: "app/Region/Standard/EasternPalace.php:107",
        },
      ],
      id: "easternPalace",
      locations: [
        {
          id: "eastern-palace/compass-chest",
          kind: "chest",
          name: "Eastern Palace - Compass Chest",
          req: "true",
          source: "app/Region/Standard/EasternPalace.php:51",
        },
        {
          id: "eastern-palace/big-chest",
          kind: "bigChest",
          name: "Eastern Palace - Big Chest",
          req: "bigKeyP1",
          source: "app/Region/Standard/EasternPalace.php:72",
        },
        {
          id: "eastern-palace/cannonball-chest",
          kind: "chest",
          name: "Eastern Palace - Cannonball Chest",
          req: "true",
          source: "app/Region/Standard/EasternPalace.php:53",
        },
        {
          id: "eastern-palace/big-key-chest",
          kind: "chest",
          name: "Eastern Palace - Big Key Chest",
          req: "lamp >= setting(requireLamp)",
          source: "app/Region/Standard/EasternPalace.php:76",
        },
        {
          id: "eastern-palace/map-chest",
          kind: "chest",
          name: "Eastern Palace - Map Chest",
          req: "true",
          source: "app/Region/Standard/EasternPalace.php:55",
        },
        {
          fill: BOSS.fill,
          id: "eastern-palace/boss",
          kind: "drop",
          name: "Eastern Palace - Boss",
          req: BOSS.req,
          source: "app/Region/Standard/EasternPalace.php:84",
        },
        {
          id: "eastern-palace/prize",
          kind: "prize",
          name: "Eastern Palace - Prize",
          req: BOSS.req,
          source: "app/Region/Standard/EasternPalace.php:80",
        },
      ],
      name: "Eastern Palace",
      prize: "eastern-palace/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyP1",
          "Compass",
          "CompassP1",
          "Key",
          "KeyP1",
          "Map",
          "MapP1",
          "PendantOfWisdom",
        ],
        source: "app/Region/Standard/EasternPalace.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
