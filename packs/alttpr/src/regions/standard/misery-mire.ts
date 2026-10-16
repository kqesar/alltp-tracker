// app/Region/Standard/MiseryMire.php: Misery Mire, its locations and its
// prize.
//
// Not ported here: the boss's fill rules and always-allow (117-130), which
// Location::canFill reads when the randomizer places an item; they wait for
// src/fill.ts.
import type { RegionModule } from "../../world";

/**
 * The two chests behind the torches (90-104): three keys, or two when the
 * big key sits in one of them (`hasItem`), which a tracker cannot know:
 * `maybe`.
 */
const TORCH_ROOM = "@canLightTorches & (keyD6 >= 3 | maybe & keyD6 >= 2)";

/**
 * The boss (110-116), whose rule is the prize's too: can_complete is the
 * boss's canAccess (106-108). With wild maps or compasses the boss wants its
 * dungeon's, unless it holds that item itself (`hasItem`): `maybe`.
 */
const BOSS =
  "caneOfSomaria & lamp >= setting(requireLamp) & bigKeyD6 & @canBeatMiseryMireBoss & (!setting(wildCompasses) | compassD6 | maybe) & (!setting(wildMaps) | mapD6 | maybe)";

export const MISERY_MIRE = {
  file: "app/Region/Standard/MiseryMire.php",
  regions: [
    {
      entrances: [
        {
          // The basic placement's health gate, the pad's medallion and a
          // sword, the pearl (or, with glitches, a bunny revive), the boots
          // or the hookshot over the gap, and a weapon for the lobby. The
          // pad is knowledge in the state (medallions.ts)
          from: "mire",
          req: "rescueZelda & (!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & @hasMireMedallion & (setting(swordless) | @hasSword) & (moonPearl | @hasABottle & (bugCatchingNet & setting(canBunnyRevive) & (@canLiftDarkRocks & (@canFly | setting(canBootsClip) & pegasusBoots) | setting(canOWYBA) & magicMirror | setting(canOneFrameClipOW)) | setting(canOWYBA) & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW) | @hasBottle2))) & (!setting(basicPlacement) & pegasusBoots | hookshot) & @canKillMostThings8",
          source: "app/Region/Standard/MiseryMire.php:132",
        },
      ],
      id: "miseryMire",
      locations: [
        {
          id: "misery-mire/big-chest",
          kind: "bigChest",
          name: "Misery Mire - Big Chest",
          req: "bigKeyD6",
          source: "app/Region/Standard/MiseryMire.php:73",
        },
        {
          id: "misery-mire/main-lobby",
          kind: "chest",
          name: "Misery Mire - Main Lobby",
          req: "keyD6 | bigKeyD6",
          source: "app/Region/Standard/MiseryMire.php:82",
        },
        {
          id: "misery-mire/big-key-chest",
          kind: "chest",
          name: "Misery Mire - Big Key Chest",
          req: TORCH_ROOM,
          source: "app/Region/Standard/MiseryMire.php:90",
        },
        {
          id: "misery-mire/compass-chest",
          kind: "chest",
          name: "Misery Mire - Compass Chest",
          req: TORCH_ROOM,
          source: "app/Region/Standard/MiseryMire.php:98",
        },
        {
          id: "misery-mire/bridge-chest",
          kind: "chest",
          name: "Misery Mire - Bridge Chest",
          req: "true",
          source: "app/Region/Standard/MiseryMire.php:54",
        },
        {
          id: "misery-mire/map-chest",
          kind: "chest",
          name: "Misery Mire - Map Chest",
          req: "keyD6 | bigKeyD6",
          source: "app/Region/Standard/MiseryMire.php:86",
        },
        {
          id: "misery-mire/spike-chest",
          kind: "chest",
          name: "Misery Mire - Spike Chest",
          req: "!setting(cantTakeDamage) | caneOfByrna | cape",
          source: "app/Region/Standard/MiseryMire.php:77",
        },
        {
          id: "misery-mire/boss",
          kind: "drop",
          name: "Misery Mire - Boss",
          req: BOSS,
          source: "app/Region/Standard/MiseryMire.php:110",
        },
        {
          id: "misery-mire/prize",
          kind: "prize",
          name: "Misery Mire - Prize",
          req: BOSS,
          source: "app/Region/Standard/MiseryMire.php:106",
        },
      ],
      name: "Misery Mire",
      prize: "misery-mire/prize",
      regionItems: {
        items: [
          "BigKey",
          "BigKeyD6",
          "Compass",
          "CompassD6",
          "Key",
          "KeyD6",
          "Map",
          "MapD6",
          "Crystal6",
        ],
        source: "app/Region/Standard/MiseryMire.php:24",
      },
    },
  ],
} as const satisfies RegionModule;
