// app/Region/Standard/LightWorld/South.php: the south of the Light World,
// from Link's House to the desert and Lake Hylia, and its locations.
//
// Not ported here: the shops (Lake Hylia Shop, Capacity Upgrade and the
// take-any caves, 53-75, and their rules, 86-105), which are not locations.
import type { RegionModule } from "../../../world";

/** Mini Moldorm Cave: its four chests and its NPC (111-129). */
const MINI_MOLDORM_CAVE = "@canBombThings & @canKillMostThings";

/**
 * Onto a ledge mirrored from the South Dark World: the Bombos tablet's
 * (139-141) and Cave 45's (145-147).
 */
const MIRRORED_LEDGE =
  "setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots | magicMirror & reach(southDarkWorld)";

export const LIGHT_WORLD_SOUTH = {
  file: "app/Region/Standard/LightWorld/South.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: "rescueZelda",
          source: "app/Region/Standard/LightWorld/South.php:181",
        },
      ],
      id: "southLightWorld",
      locations: [
        {
          id: "floodgate-chest",
          kind: "chest",
          name: "Floodgate Chest",
          req: "true",
          source: "app/Region/Standard/LightWorld/South.php:32",
        },
        {
          id: "links-house",
          kind: "chest",
          name: "Link's House",
          req: "true",
          source: "app/Region/Standard/LightWorld/South.php:33",
        },
        {
          id: "aginahs-cave",
          kind: "chest",
          name: "Aginah's Cave",
          req: "@canBombThings",
          source: "app/Region/Standard/LightWorld/South.php:107",
        },
        {
          id: "mini-moldorm-cave/far-left",
          kind: "chest",
          name: "Mini Moldorm Cave - Far Left",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Standard/LightWorld/South.php:111",
        },
        {
          id: "mini-moldorm-cave/left",
          kind: "chest",
          name: "Mini Moldorm Cave - Left",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Standard/LightWorld/South.php:115",
        },
        {
          id: "mini-moldorm-cave/right",
          kind: "chest",
          name: "Mini Moldorm Cave - Right",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Standard/LightWorld/South.php:119",
        },
        {
          id: "mini-moldorm-cave/far-right",
          kind: "chest",
          name: "Mini Moldorm Cave - Far Right",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Standard/LightWorld/South.php:123",
        },
        {
          id: "ice-rod-cave",
          kind: "chest",
          name: "Ice Rod Cave",
          req: "true",
          source: "app/Region/Standard/LightWorld/South.php:39",
        },
        {
          id: "hobo",
          kind: "npc",
          name: "Hobo",
          req: "setting(canWaterWalk) & pegasusBoots | setting(canFakeFlipper) | flippers",
          source: "app/Region/Standard/LightWorld/South.php:131",
        },
        {
          id: "bombos-tablet",
          kind: "drop",
          name: "Bombos Tablet",
          req: `bookOfMudora & (@hasSword2 | setting(swordless) & hammer) & (${MIRRORED_LEDGE})`,
          source: "app/Region/Standard/LightWorld/South.php:136",
          // Its rule without the sword: on the ledge with the Book
          visible: {
            req: `bookOfMudora & (${MIRRORED_LEDGE})`,
            source: "game",
          },
        },
        {
          id: "cave-45",
          kind: "standing",
          name: "Cave 45",
          req: MIRRORED_LEDGE,
          source: "app/Region/Standard/LightWorld/South.php:144",
        },
        {
          id: "checkerboard-cave",
          kind: "standing",
          name: "Checkerboard Cave",
          req: "@canLiftRocks & (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots | magicMirror & reach(mire))",
          source: "app/Region/Standard/LightWorld/South.php:150",
        },
        {
          id: "mini-moldorm-cave/npc",
          kind: "npc",
          name: "Mini Moldorm Cave - NPC",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Standard/LightWorld/South.php:127",
        },
        {
          id: "library",
          kind: "dash",
          name: "Library",
          req: "pegasusBoots",
          source: "app/Region/Standard/LightWorld/South.php:157",
        },
        {
          id: "maze-race",
          kind: "standing",
          name: "Maze Race",
          req: "true",
          source: "app/Region/Standard/LightWorld/South.php:46",
        },
        {
          id: "desert-ledge",
          kind: "standing",
          name: "Desert Ledge",
          req: "reach(desertPalace)",
          source: "app/Region/Standard/LightWorld/South.php:161",
          // Seen from the desert below the ledge
          visible: { source: "game" },
        },
        {
          id: "lake-hylia-island",
          kind: "standing",
          name: "Lake Hylia Island",
          req: "setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots | magicMirror & setting(canWaterWalk) & pegasusBoots & (moonPearl | setting(canOWYBA) & @hasABottle) & reach(northWestDarkWorld) | flippers & magicMirror & (setting(canBunnySurf) | moonPearl | setting(canOWYBA) & @hasABottle) & reach(northEastDarkWorld)",
          source: "app/Region/Standard/LightWorld/South.php:165",
          // Seen from the lake's shore
          visible: { source: "game" },
        },
        {
          id: "sunken-treasure",
          kind: "standing",
          name: "Sunken Treasure",
          req: "true",
          source: "app/Region/Standard/LightWorld/South.php:49",
        },
        {
          id: "flute-spot",
          kind: "dig",
          name: "Flute Spot",
          req: "shovel",
          source: "app/Region/Standard/LightWorld/South.php:177",
        },
      ],
      name: "South Light World",
    },
  ],
} as const satisfies RegionModule;
