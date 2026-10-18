// app/Region/Inverted/DarkWorld/NorthEast.php: North East Dark World, the
// pyramid and its fairy. Ganon moves to the Light World (24).
//
// Its initalize (33-105) replaces Standard's without calling it: a location
// it sets no rule for needs only its region (Location.php:96-111).
//
// Not ported here: the Dark World Potion Shop's rule (35-50), as shops are
// not locations; the fixed items of the fairy's sword and bow, which the
// fill reads.
import type { RegionModule } from "../../../world";

export const INVERTED_DARK_WORLD_NORTH_EAST = {
  file: "app/Region/Inverted/DarkWorld/NorthEast.php",
  regions: [
    {
      // can_enter (89-102)
      entrances: [
        {
          from: "start",
          req: "@canFly",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:90",
        },
        {
          from: "start",
          req: "hammer",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:91",
        },
        {
          from: "start",
          req: "flippers",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:92",
        },
        {
          from: "northEastLightWorld",
          req: "magicMirror",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:93",
        },
        {
          from: "start",
          req: "setting(canOWYBA) & @hasABottle",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:94",
        },
        {
          from: "start",
          req: "setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:95",
        },
        {
          from: "start",
          req: "setting(canWaterWalk) & pegasusBoots",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:96",
        },
        {
          from: "start",
          req: "setting(canSuperSpeed) & @canSpinSpeed",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:97",
        },
        {
          from: "start",
          req: "!setting(cantTakeDamage) & setting(canFakeFlipper)",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:98",
        },
        {
          from: "start",
          req: "setting(canBunnyRevive) & @canBunnyRevive",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:99",
        },
        {
          from: "start",
          req: "setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:101",
        },
      ],
      id: "northEastDarkWorld",
      locations: [
        {
          id: "catfish",
          kind: "standing",
          name: "Catfish",
          req: "@canLiftRocks | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW) | magicMirror & reach(southLightWorld) & (moonPearl | setting(canOWYBA) & @hasABottle) & (flippers | setting(canFakeFlipper) | setting(canWaterWalk) & pegasusBoots)",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:52",
        },
        {
          id: "pyramid",
          kind: "standing",
          name: "Pyramid",
          req: "true",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:33",
        },
        {
          id: "pyramid-fairy/sword",
          kind: "trade",
          name: "Pyramid Fairy - Sword",
          req: "@hasSword & bigRedBomb & magicMirror",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:64",
        },
        {
          id: "pyramid-fairy/bow",
          kind: "trade",
          name: "Pyramid Fairy - Bow",
          req: "@canShootArrows & bigRedBomb & magicMirror",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:70",
        },
        // The fairy's two chests exist only with swords in the pool
        // (Standard/DarkWorld/NorthEast.php:39-42, here 77): without, they
        // are never in logic
        {
          id: "pyramid-fairy/left",
          kind: "chest",
          name: "Pyramid Fairy - Left",
          req: "setting(swordsInPool) & bigRedBomb & magicMirror",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:78",
        },
        {
          id: "pyramid-fairy/right",
          kind: "chest",
          name: "Pyramid Fairy - Right",
          req: "setting(swordsInPool) & bigRedBomb & magicMirror",
          source: "app/Region/Inverted/DarkWorld/NorthEast.php:83",
        },
      ],
      name: "North East Dark World",
    },
  ],
} as const satisfies RegionModule;
