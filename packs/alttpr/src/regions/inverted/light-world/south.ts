// app/Region/Inverted/LightWorld/South.php: the south of the Light World,
// from the desert to Lake Hylia, and its locations. Link's House moves to
// the Dark World (26); the Bomb Merchant, an event holding the big bomb,
// joins (27-29).
//
// Its initalize (38-245) replaces Standard's without calling it: a location
// it sets no rule for needs only its region (Location.php:96-111).
//
// Not ported here: the shops (40-80), which are not locations.
import type { RegionModule } from "../../../world";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle";

/** Link, or a bunny who takes an item in Super Bunny state by the mirror. */
const PEARL_OR_SUPER_BUNNY = `${PEARL} | setting(canSuperBunny) & magicMirror`;

/** Mini Moldorm Cave: its four chests and its NPC (104-134, 179-185). */
const MINI_MOLDORM_CAVE = `(${PEARL}) & @canBombThings & @canKillMostThings`;

export const INVERTED_LIGHT_WORLD_SOUTH = {
  file: "app/Region/Inverted/LightWorld/South.php",
  regions: [
    {
      // can_enter (240-242)
      entrances: [
        {
          from: "northEastLightWorld",
          req: "true",
          source: "app/Region/Inverted/LightWorld/South.php:241",
        },
      ],
      id: "southLightWorld",
      locations: [
        {
          id: "floodgate-chest",
          kind: "chest",
          name: "Floodgate Chest",
          req: PEARL_OR_SUPER_BUNNY,
          source: "app/Region/Inverted/LightWorld/South.php:82",
        },
        {
          id: "aginahs-cave",
          kind: "chest",
          name: "Aginah's Cave",
          req: `(${PEARL}) & @canBombThings`,
          source: "app/Region/Inverted/LightWorld/South.php:96",
        },
        {
          id: "mini-moldorm-cave/far-left",
          kind: "chest",
          name: "Mini Moldorm Cave - Far Left",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Inverted/LightWorld/South.php:104",
        },
        {
          id: "mini-moldorm-cave/left",
          kind: "chest",
          name: "Mini Moldorm Cave - Left",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Inverted/LightWorld/South.php:112",
        },
        {
          id: "mini-moldorm-cave/right",
          kind: "chest",
          name: "Mini Moldorm Cave - Right",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Inverted/LightWorld/South.php:120",
        },
        {
          id: "mini-moldorm-cave/far-right",
          kind: "chest",
          name: "Mini Moldorm Cave - Far Right",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Inverted/LightWorld/South.php:128",
        },
        {
          id: "ice-rod-cave",
          kind: "chest",
          name: "Ice Rod Cave",
          req: `(${PEARL}) & @canBombThings | bigRedBomb & setting(canSuperBunny) & magicMirror`,
          source: "app/Region/Inverted/LightWorld/South.php:136",
        },
        {
          id: "hobo",
          kind: "npc",
          name: "Hobo",
          req: `(${PEARL}) & (setting(canFakeFlipper) | flippers | setting(canWaterWalk) & pegasusBoots)`,
          source: "app/Region/Inverted/LightWorld/South.php:146",
        },
        {
          id: "bombos-tablet",
          kind: "drop",
          name: "Bombos Tablet",
          req: "bookOfMudora & (@hasSword2 | setting(swordless) & hammer)",
          source: "app/Region/Inverted/LightWorld/South.php:156",
          // Its rule without the sword: the Book reads it
          visible: { req: "bookOfMudora", source: "game" },
        },
        {
          id: "cave-45",
          kind: "standing",
          name: "Cave 45",
          req: PEARL_OR_SUPER_BUNNY,
          source: "app/Region/Inverted/LightWorld/South.php:163",
        },
        {
          id: "checkerboard-cave",
          kind: "standing",
          name: "Checkerboard Cave",
          req: `(${PEARL}) & @canLiftRocks`,
          source: "app/Region/Inverted/LightWorld/South.php:171",
        },
        {
          id: "mini-moldorm-cave/npc",
          kind: "npc",
          name: "Mini Moldorm Cave - NPC",
          req: MINI_MOLDORM_CAVE,
          source: "app/Region/Inverted/LightWorld/South.php:179",
        },
        {
          id: "library",
          kind: "dash",
          name: "Library",
          req: `(${PEARL_OR_SUPER_BUNNY}) & pegasusBoots`,
          source: "app/Region/Inverted/LightWorld/South.php:187",
        },
        {
          id: "maze-race",
          kind: "standing",
          name: "Maze Race",
          req: "moonPearl & (pegasusBoots | @canBombThings) | setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/LightWorld/South.php:196",
        },
        {
          id: "desert-ledge",
          kind: "standing",
          name: "Desert Ledge",
          req: "(moonPearl | setting(canDungeonRevive) | setting(canSuperBunny) & magicMirror | setting(canOWYBA) & @hasABottle) & reach(desertPalace) | setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Inverted/LightWorld/South.php:203",
          // Seen from the desert below the ledge
          visible: { source: "game" },
        },
        {
          id: "lake-hylia-island",
          kind: "standing",
          name: "Lake Hylia Island",
          req: `(${PEARL}) & (flippers | setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed) | setting(canOneFrameClipOW)`,
          source: "app/Region/Inverted/LightWorld/South.php:214",
          // Seen from the lake's shore
          visible: { source: "game" },
        },
        {
          id: "sunken-treasure",
          kind: "standing",
          name: "Sunken Treasure",
          req: PEARL_OR_SUPER_BUNNY,
          source: "app/Region/Inverted/LightWorld/South.php:225",
        },
        {
          id: "flute-spot",
          kind: "dig",
          name: "Flute Spot",
          req: `(${PEARL}) & shovel`,
          source: "app/Region/Inverted/LightWorld/South.php:233",
        },
        {
          id: "bomb-merchant",
          kind: "prize",
          name: "Bomb Merchant",
          req: "(moonPearl | setting(canSuperBunny)) & crystal5 & crystal6",
          source: "app/Region/Inverted/LightWorld/South.php:90",
        },
      ],
      name: "South Light World",
    },
  ],
} as const satisfies RegionModule;
