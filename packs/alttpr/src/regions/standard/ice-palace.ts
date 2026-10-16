// app/Region/Standard/IcePalace.php: Ice Palace, its locations and its
// prize.
//
// Not ported here: the boss's fill rules and always-allow (118-130), which
// Location::canFill reads when the randomizer places an item; they wait for
// src/fill.ts.
import type { RegionModule } from "../../world";

/** The spikes, unless Link can take damage (75-76, 82-83, 88-89). */
const SPIKES = "(!setting(cantTakeDamage) | caneOfByrna | cape | hookshot)";

/**
 * The Spike Room (87-94): the hookshot, or a key while the big key sits in
 * the Spike Room, the Big Key Chest or the Map Chest (`itemInLocations`),
 * which a tracker cannot know: `maybe`. Retro's ShopKey (90) is not
 * modeled.
 */
const SPIKE_ROOM = `${SPIKES} & (hookshot | maybe & keyD5)`;

/**
 * The boss (108-117), whose rule is the prize's too: can_complete is the
 * boss's canAccess (104-106). With wild maps or compasses the boss wants its
 * dungeon's, unless it holds that item itself (`hasItem`), which a tracker
 * cannot know: `maybe`.
 */
const BOSS =
  "hammer & @canLiftRocks & @canBeatIcePalaceBoss & bigKeyD5 & (!setting(basicPlacement) & (caneOfSomaria & keyD5 | keyD5 >= 2) | setting(basicPlacement) & keyD5 >= 2) & (!setting(wildCompasses) | compassD5 | maybe) & (!setting(wildMaps) | mapD5 | maybe)";

/**
 * can_enter's gate before its branches (133-136): Zelda rescued, with the
 * basic placement two swords (or swordless), 12 hearts and two bottles or
 * armor, and something to melt the ice.
 */
const GATE =
  "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & (@canMeltThings | setting(canOneFrameClipUW))";

/** canBootsClip with the boots, or canOneFrameClipOW (145-149). */
const CLIP =
  "(setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))";

export const ICE_PALACE = {
  file: "app/Region/Standard/IcePalace.php",
  regions: [
    {
      entrances: [
        {
          from: "start",
          req: `${GATE} & (moonPearl | setting(canDungeonRevive)) & (flippers | setting(canFakeFlipper)) & @canLiftDarkRocks`,
          source: "app/Region/Standard/IcePalace.php:137",
        },
        {
          from: "southDarkWorld",
          req: `${GATE} & ((moonPearl | @hasABottle & setting(canOWYBA) | setting(canBunnyRevive) & @canBunnyRevive) & (setting(canMirrorWrap) & magicMirror & (setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed) | flippers & setting(canTransitionWrapped) & ${CLIP}) | setting(canOneFrameClipOW) & setting(canMirrorWrap) & magicMirror)`,
          source: "app/Region/Standard/IcePalace.php:140",
        },
      ],
      id: "icePalace",
      locations: [
        {
          id: "ice-palace/big-key-chest",
          kind: "chest",
          name: "Ice Palace - Big Key Chest",
          req: `hammer & @canLiftRocks & ${SPIKES} & ${SPIKE_ROOM}`,
          source: "app/Region/Standard/IcePalace.php:73",
        },
        {
          id: "ice-palace/compass-chest",
          kind: "chest",
          name: "Ice Palace - Compass Chest",
          req: "true",
          source: "app/Region/Standard/IcePalace.php:51",
        },
        {
          id: "ice-palace/map-chest",
          kind: "chest",
          name: "Ice Palace - Map Chest",
          req: `hammer & @canLiftRocks & ${SPIKES} & ${SPIKE_ROOM}`,
          source: "app/Region/Standard/IcePalace.php:80",
        },
        {
          id: "ice-palace/spike-room",
          kind: "chest",
          name: "Ice Palace - Spike Room",
          req: SPIKE_ROOM,
          source: "app/Region/Standard/IcePalace.php:87",
        },
        {
          id: "ice-palace/freezor-chest",
          kind: "chest",
          name: "Ice Palace - Freezor Chest",
          req: "@canMeltThings",
          source: "app/Region/Standard/IcePalace.php:96",
        },
        {
          id: "ice-palace/iced-t-room",
          kind: "chest",
          name: "Ice Palace - Iced T Room",
          req: "true",
          source: "app/Region/Standard/IcePalace.php:55",
        },
        {
          id: "ice-palace/big-chest",
          kind: "bigChest",
          name: "Ice Palace - Big Chest",
          req: "bigKeyD5",
          source: "app/Region/Standard/IcePalace.php:100",
        },
        {
          id: "ice-palace/boss",
          kind: "drop",
          name: "Ice Palace - Boss",
          req: BOSS,
          source: "app/Region/Standard/IcePalace.php:108",
        },
        {
          id: "ice-palace/prize",
          kind: "prize",
          name: "Ice Palace - Prize",
          req: BOSS,
          source: "app/Region/Standard/IcePalace.php:104",
        },
      ],
      name: "Ice Palace",
      prize: "ice-palace/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD5",
          "Compass",
          "CompassD5",
          "Key",
          "KeyD5",
          "Map",
          "MapD5",
          "Crystal5",
        ],
        source: "app/Region/Standard/IcePalace.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
