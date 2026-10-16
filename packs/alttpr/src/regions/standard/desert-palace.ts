// app/Region/Standard/DesertPalace.php: Desert Palace, its locations and its
// prize.
//
// Not ported here: the boss's fill rules and always-allow (108-120), which
// Location::canFill reads when the randomizer places an item; they wait for
// src/fill.ts.
import type { RegionModule } from "../../world";

/**
 * The boss (96-107), whose rule is the prize's too: can_complete is the
 * boss's canAccess (92-94). Its room is past the palace's back door, on the
 * ledge above the desert: a glove for the rocks there, or the mirror from
 * the Mire. With wild maps or compasses the boss wants its dungeon's, unless
 * it holds that item itself (`hasItem`), which a tracker cannot know:
 * `maybe`.
 */
const BOSS =
  "(@canLiftRocks | setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW) | magicMirror & reach(mire)) & @canLightTorches & bigKeyP2 & keyP2 & @canBeatDesertPalaceBoss & (!setting(wildCompasses) | compassP2 | maybe) & (!setting(wildMaps) | mapP2 | maybe)";

export const DESERT_PALACE = {
  file: "app/Region/Standard/DesertPalace.php",
  regions: [
    {
      // can_enter (122-128): its branches, RescueZelda in each
      entrances: [
        {
          from: "start",
          req: "rescueZelda & bookOfMudora",
          source: "app/Region/Standard/DesertPalace.php:124",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canBootsClip) & pegasusBoots",
          source: "app/Region/Standard/DesertPalace.php:125",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/DesertPalace.php:126",
        },
        {
          from: "mire",
          req: "rescueZelda & magicMirror",
          source: "app/Region/Standard/DesertPalace.php:127",
        },
      ],
      id: "desertPalace",
      locations: [
        {
          id: "desert-palace/big-chest",
          kind: "bigChest",
          name: "Desert Palace - Big Chest",
          req: "bigKeyP2",
          source: "app/Region/Standard/DesertPalace.php:76",
        },
        {
          id: "desert-palace/map-chest",
          kind: "chest",
          name: "Desert Palace - Map Chest",
          req: "true",
          source: "app/Region/Standard/DesertPalace.php:56",
        },
        {
          id: "desert-palace/torch",
          kind: "dash",
          name: "Desert Palace - Torch",
          req: "pegasusBoots",
          source: "app/Region/Standard/DesertPalace.php:88",
        },
        {
          id: "desert-palace/big-key-chest",
          kind: "chest",
          name: "Desert Palace - Big Key Chest",
          req: "keyP2 & @canKillMostThings",
          source: "app/Region/Standard/DesertPalace.php:80",
        },
        {
          id: "desert-palace/compass-chest",
          kind: "chest",
          name: "Desert Palace - Compass Chest",
          req: "keyP2",
          source: "app/Region/Standard/DesertPalace.php:84",
        },
        {
          id: "desert-palace/boss",
          kind: "drop",
          name: "Desert Palace - Boss",
          req: BOSS,
          source: "app/Region/Standard/DesertPalace.php:96",
        },
        {
          id: "desert-palace/prize",
          kind: "prize",
          name: "Desert Palace - Prize",
          req: BOSS,
          source: "app/Region/Standard/DesertPalace.php:92",
        },
      ],
      name: "Desert Palace",
      prize: "desert-palace/prize",
      // As upstream lists them, MapP2 twice
      regionItems: {
        items: [
          "BigKey",
          "BigKeyP2",
          "Compass",
          "CompassP2",
          "Key",
          "KeyP2",
          "Map",
          "MapP2",
          "MapP2",
          "PendantOfPower",
        ],
        source: "app/Region/Standard/DesertPalace.php:27",
      },
    },
  ],
} as const satisfies RegionModule;
