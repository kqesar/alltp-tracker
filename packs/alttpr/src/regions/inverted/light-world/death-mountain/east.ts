// app/Region/Inverted/LightWorld/DeathMountain/East.php: East Death
// Mountain and its locations, with Ether Tablet and Spectacle Rock, which
// move here from West Death Mountain's file (25-26).
//
// Its initalize (35-206) replaces Standard's without calling it: Floating
// Island, which it sets no rule for, needs only the region
// (Location.php:96-111). hasABottle(2), which several rules call, takes no
// argument (ItemCollection.php:709): one bottle does.
//
// Not ported here: the Light World Death Mountain Shop's rule (37-48), as
// shops are not locations.
import type { RegionModule } from "../../../../world";

/** Into the Paradox Cave as Link, not a bunny (75-158). */
const PARADOX_CAVE =
  "moonPearl | setting(canOWYBA) & @hasABottle & (hookshot | setting(canSuperSpeed) & @canSpinSpeed) | setting(canOWYBA) & @hasABottle & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))";

/** Onto the upper ledge of Ether Tablet and Spectacle Rock (161-188). */
const UPPER_LEDGE =
  "moonPearl & (hammer | setting(canSuperSpeed) & @canSpinSpeed | setting(canBootsClip) & pegasusBoots) | setting(canOWYBA) & @hasABottle & setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)";

export const INVERTED_LIGHT_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Inverted/LightWorld/DeathMountain/East.php",
  regions: [
    {
      // can_enter (190-203)
      entrances: [
        {
          from: "eastDarkWorldDeathMountain",
          req: "@canLiftDarkRocks",
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:191",
        },
        {
          from: "westDeathMountain",
          req: "(moonPearl | setting(canOWYBA) & @hasABottle) & (hookshot | setting(canBootsClip) & pegasusBoots | setting(canSuperSpeed) & @canSpinSpeed) | setting(canMirrorWrap) & magicMirror | setting(canOneFrameClipOW)",
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:192",
        },
      ],
      id: "eastDeathMountain",
      locations: [
        {
          id: "spiral-cave",
          kind: "chest",
          name: "Spiral Cave",
          req: "moonPearl | setting(canOWYBA) & @hasABottle & (hookshot | setting(canSuperSpeed) & @canSpinSpeed) | setting(canSuperBunny) & magicMirror & @hasSword | setting(canOWYBA) & @hasABottle & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))",
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:51",
        },
        {
          id: "mimic-cave",
          kind: "chest",
          name: "Mimic Cave",
          req: "hammer & (moonPearl | setting(canOWYBA) & @hasABottle & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)))",
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:65",
        },
        {
          id: "paradox-cave-lower/far-left",
          kind: "chest",
          name: "Paradox Cave Lower - Far Left",
          req: PARADOX_CAVE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:75",
        },
        {
          id: "paradox-cave-lower/left",
          kind: "chest",
          name: "Paradox Cave Lower - Left",
          req: PARADOX_CAVE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:87",
        },
        {
          id: "paradox-cave-lower/right",
          kind: "chest",
          name: "Paradox Cave Lower - Right",
          req: PARADOX_CAVE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:99",
        },
        {
          id: "paradox-cave-lower/far-right",
          kind: "chest",
          name: "Paradox Cave Lower - Far Right",
          req: PARADOX_CAVE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:111",
        },
        {
          id: "paradox-cave-lower/middle",
          kind: "chest",
          name: "Paradox Cave Lower - Middle",
          req: PARADOX_CAVE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:123",
        },
        {
          id: "paradox-cave-upper/left",
          kind: "chest",
          name: "Paradox Cave Upper - Left",
          req: `@canBombThings & (${PARADOX_CAVE})`,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:135",
        },
        {
          id: "paradox-cave-upper/right",
          kind: "chest",
          name: "Paradox Cave Upper - Right",
          req: `@canBombThings & (${PARADOX_CAVE})`,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:148",
        },
        {
          id: "floating-island",
          kind: "standing",
          name: "Floating Island",
          req: "true",
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:35",
        },
        {
          id: "ether-tablet",
          kind: "drop",
          name: "Ether Tablet",
          req: `bookOfMudora & (setting(swordless) & hammer | @hasSword2) & (${UPPER_LEDGE})`,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:161",
          // Its rule without the sword: on the ledge with the Book
          visible: { req: `bookOfMudora & (${UPPER_LEDGE})`, source: "game" },
        },
        {
          id: "spectacle-rock",
          kind: "standing",
          name: "Spectacle Rock",
          req: UPPER_LEDGE,
          source: "app/Region/Inverted/LightWorld/DeathMountain/East.php:178",
          // Seen on its rock from the path below, in West Death Mountain
          visible: { from: "westDeathMountain", source: "game" },
        },
      ],
      name: "East Death Mountain",
    },
  ],
} as const satisfies RegionModule;
