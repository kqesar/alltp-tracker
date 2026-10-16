// app/Region/Standard/TowerOfHera.php: Tower of Hera, its locations and its
// prize.
//
// Its two ways in, `$main` (103-109) and `$mire` (111-119), are shared by
// can_enter and by three rules, and each needs another region, so each is a
// part of the module: `towerOfHeraMain`, from West Death Mountain, and
// `towerOfHeraMire`, from Misery Mire with the one-frame clip, which
// NoGlitches folds away. The tower is entered from either.
import { dungeonBoss } from "../../bosses";
import type { RegionModule } from "../../world";

/**
 * The boss (143-162), whose rule is the prize's too: can_complete is the
 * boss's canAccess (139-141). With wild maps or compasses it wants its
 * dungeon's (dungeonBoss).
 */
const BOSS = dungeonBoss(
  "reach(towerOfHeraMain) & @canBeatTowerOfHeraBoss & (bigKeyP3 | reach(towerOfHeraMire) & bigKeyD6)",
  "P3",
  {
    always: 159,
    file: "app/Region/Standard/TowerOfHera.php",
    fill: 149,
    holding: 147,
  },
);

export const TOWER_OF_HERA = {
  file: "app/Region/Standard/TowerOfHera.php",
  regions: [
    {
      entrances: [
        {
          from: "towerOfHeraMain",
          req: "rescueZelda",
          source: "app/Region/Standard/TowerOfHera.php:166",
        },
        {
          from: "towerOfHeraMire",
          req: "rescueZelda",
          source: "app/Region/Standard/TowerOfHera.php:167",
        },
      ],
      id: "towerOfHera",
      locations: [
        {
          // The tower's key may lock itself in here, unless every location
          // must be reachable: nothing else needs it
          fill: {
            always: {
              items: ["KeyP3"],
              req: "!setting(locationsAccessibility)",
              source: "app/Region/Standard/TowerOfHera.php:123",
            },
            refuse: [
              {
                refuse: { items: ["KeyP3"] },
                source: "app/Region/Standard/TowerOfHera.php:125",
                when: "setting(locationsAccessibility)",
              },
            ],
          },
          id: "tower-of-hera/big-key-chest",
          kind: "chest",
          name: "Tower of Hera - Big Key Chest",
          req: "@canLightTorches & keyP3",
          source: "app/Region/Standard/TowerOfHera.php:121",
        },
        {
          id: "tower-of-hera/basement-cage",
          kind: "standing",
          name: "Tower of Hera - Basement Cage",
          req: "true",
          source: "app/Region/Standard/TowerOfHera.php:54",
        },
        {
          id: "tower-of-hera/map-chest",
          kind: "chest",
          name: "Tower of Hera - Map Chest",
          req: "true",
          source: "app/Region/Standard/TowerOfHera.php:55",
        },
        {
          id: "tower-of-hera/compass-chest",
          kind: "chest",
          name: "Tower of Hera - Compass Chest",
          req: "reach(towerOfHeraMain) & bigKeyP3 | reach(towerOfHeraMire)",
          source: "app/Region/Standard/TowerOfHera.php:129",
        },
        {
          id: "tower-of-hera/big-chest",
          kind: "bigChest",
          name: "Tower of Hera - Big Chest",
          req: "reach(towerOfHeraMain) & bigKeyP3 | reach(towerOfHeraMire) & (bigKeyP3 | bigKeyD6)",
          source: "app/Region/Standard/TowerOfHera.php:134",
        },
        {
          fill: BOSS.fill,
          id: "tower-of-hera/boss",
          kind: "drop",
          name: "Tower of Hera - Boss",
          req: BOSS.req,
          source: "app/Region/Standard/TowerOfHera.php:143",
        },
        {
          id: "tower-of-hera/prize",
          kind: "prize",
          name: "Tower of Hera - Prize",
          req: BOSS.req,
          source: "app/Region/Standard/TowerOfHera.php:139",
        },
      ],
      name: "Tower of Hera",
      prize: "tower-of-hera/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyP3",
          "Compass",
          "CompassP3",
          "Key",
          "KeyP3",
          "Map",
          "MapP3",
          "PendantOfWisdom",
        ],
        source: "app/Region/Standard/TowerOfHera.php:26",
      },
    },
    {
      // `$main`: the mirror, or the hookshot and the hammer, from West Death
      // Mountain; the glitch branches from anywhere
      entrances: [
        {
          from: "start",
          req: "pegasusBoots & setting(canBootsClip)",
          source: "app/Region/Standard/TowerOfHera.php:104",
        },
        {
          from: "start",
          req: "setting(canSuperSpeed) & @canSpinSpeed",
          source: "app/Region/Standard/TowerOfHera.php:105",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Standard/TowerOfHera.php:106",
        },
        {
          from: "westDeathMountain",
          req: "magicMirror | hookshot & hammer",
          source: "app/Region/Standard/TowerOfHera.php:107",
        },
      ],
      id: "towerOfHeraMain",
      locations: [],
    },
    {
      // `$mire`: through Misery Mire with the one-frame clip, and its keys.
      // Two do if its big key sits in its Compass or Big Key Chest
      // (`itemInLocations`), which a tracker cannot know: `maybe`
      entrances: [
        {
          from: "miseryMire",
          req: "setting(canOneFrameClipUW) & (keyD6 >= 3 | maybe & keyD6 >= 2)",
          source: "app/Region/Standard/TowerOfHera.php:111",
        },
      ],
      id: "towerOfHeraMire",
      locations: [],
    },
  ],
} as const satisfies RegionModule;
