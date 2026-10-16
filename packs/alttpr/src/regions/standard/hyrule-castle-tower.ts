// app/Region/Standard/HyruleCastleTower.php: Hyrule Castle Tower, its
// locations and its prize, Agahnim.
import type { RegionModule } from "../../world";

export const HYRULE_CASTLE_TOWER = {
  file: "app/Region/Standard/HyruleCastleTower.php",
  regions: [
    {
      // The barrier: the Cape, or a sword to cut it (70-76)
      entrances: [
        {
          from: "start",
          req: "@canKillMostThings8 & rescueZelda & (cape | @hasSword2 | setting(swordless) & hammer)",
          source: "app/Region/Standard/HyruleCastleTower.php:70",
        },
      ],
      id: "hyruleCastleTower",
      locations: [
        {
          id: "castle-tower/room-03",
          kind: "chest",
          name: "Castle Tower - Room 03",
          req: "true",
          source: "app/Region/Standard/HyruleCastleTower.php:41",
        },
        {
          id: "castle-tower/dark-maze",
          kind: "chest",
          name: "Castle Tower - Dark Maze",
          req: "lamp >= setting(requireLamp) & keyA1",
          source: "app/Region/Standard/HyruleCastleTower.php:58",
        },
        {
          // can_complete (62-68), less its own canEnter, which the graph applies
          id: "agahnim",
          kind: "prize",
          name: "Agahnim",
          req: "keyA1 >= 2 & lamp >= setting(requireLamp) & (@hasSword | setting(swordless) & (hammer | bugCatchingNet))",
          source: "app/Region/Standard/HyruleCastleTower.php:62",
        },
      ],
      name: "Hyrule Castle Tower",
      prize: "agahnim",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyA1",
          "Compass",
          "CompassA1",
          "Key",
          "KeyA1",
          "Map",
          "MapA1",
        ],
        source: "app/Region/Standard/HyruleCastleTower.php:18",
      },
    },
  ],
} as const satisfies RegionModule;
