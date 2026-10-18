// app/Region/Inverted/GanonsTower.php: Ganon's Tower, whose door is at
// Hyrule Castle in Inverted. It keeps Standard's rules (parent::initalize(),
// 21): Bob's Torch and the Hope Room stay Standard's. It sets every other
// location's again, each with Link not a bunny in the Light World (PEARL),
// Agahnim 2's, and a new can_enter.
import type { LocationFill } from "../../location";
import { extendModule } from "../../world";
import { GANONS_TOWER } from "../standard/ganons-tower";

const FILE = "app/Region/Inverted/GanonsTower.php";

/** A setFillRules that refuses these items here. */
const REFUSE = (line: number, ...items: string[]) =>
  ({
    refuse: [{ refuse: { items }, source: `${FILE}:${line}` }],
  }) as const satisfies LocationFill;

/** Link and not a bunny, which every rule here asks (23-456). */
const PEARL =
  "(moonPearl | setting(canDungeonRevive) | (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots) & (setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle))";

/** The way to the Map Chest, before its keys (183-186). */
const MAP_CHEST_WAY = `hammer & (hookshot | !setting(basicPlacement) & pegasusBoots) & ${PEARL}`;

/** The four chests of the DMs room (23-73). */
const DMS_ROOM = `hammer & hookshot & ${PEARL}`;

/**
 * The four chests of the randomizer room (75-157): four keys, or three
 * when the big key sits in one of the three others (`itemInLocations`),
 * which a tracker cannot know: `maybe`.
 */
const RANDOMIZER_ROOM = `hammer & hookshot & (keyA2 >= 4 | maybe & keyA2 >= 3) & ${PEARL}`;

/** The four chests of the compass room (256-335), as the randomizer room. */
const COMPASS_ROOM = `fireRod & caneOfSomaria & (keyA2 >= 4 | maybe & keyA2 >= 3) & ${PEARL}`;

/** The big key chest and room, past the bottom boss (337-381). */
const BIG_KEY_ROOM = `(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & @canBeatGanonsTowerBottomBoss & ${PEARL}`;

/** The chests past the big key door and the middle boss (383-435). */
const UPSTAIRS = `@canShootArrows & @canLightTorches & bigKeyA2 & keyA2 >= 3 & @canBeatGanonsTowerMiddleBoss & ${PEARL}`;

/**
 * The Moldorm Chest (437-456), past the top boss; Agahnim 2 wants it too
 * (458-464).
 */
const MOLDORM_CHEST = `hookshot & @canShootArrows & @canLightTorches & bigKeyA2 & keyA2 >= 4 & @canBeatGanonsTowerMiddleBoss & @canBeatGanonsTowerTopBoss & ${PEARL}`;

export const INVERTED_GANONS_TOWER = extendModule(GANONS_TOWER, FILE, {
  ganonsTower: {
    entrances: [
      {
        // can_enter (466-491): the basic placement's health gate, Link not
        // a bunny, and the crystals crystals.tower asks for
        from: "northEastLightWorld",
        req: "(!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & (setting(canDungeonRevive) | setting(canSuperBunny) & magicMirror | moonPearl | (setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots) & (setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle)) & count(crystal) >= setting(crystalsTower)",
        source: `${FILE}:467`,
      },
    ],
    locations: {
      // can_complete: the Moldorm Chest's canAccess, then Agahnim 2
      "agahnim-2": {
        req: `${MOLDORM_CHEST} & @canBeatGanonsTowerBoss`,
        source: `${FILE}:458`,
      },
      "ganons-tower/big-chest": {
        fill: REFUSE(226, "BigKeyA2"),
        req: `bigKeyA2 & keyA2 >= 3 & (hammer & hookshot | fireRod & caneOfSomaria) & ${PEARL}`,
        source: `${FILE}:211`,
      },
      "ganons-tower/big-key-chest": {
        req: BIG_KEY_ROOM,
        source: `${FILE}:337`,
      },
      "ganons-tower/big-key-room/left": {
        req: BIG_KEY_ROOM,
        source: `${FILE}:353`,
      },
      "ganons-tower/big-key-room/right": {
        req: BIG_KEY_ROOM,
        source: `${FILE}:368`,
      },
      // Unlike Standard's (282-287), no basic placement's way past the
      // dark room
      "ganons-tower/bobs-chest": {
        req: `(hammer & hookshot | fireRod & caneOfSomaria) & keyA2 >= 3 & ${PEARL}`,
        source: `${FILE}:230`,
      },
      "ganons-tower/compass-room/bottom-left": {
        req: COMPASS_ROOM,
        source: `${FILE}:298`,
      },
      "ganons-tower/compass-room/bottom-right": {
        req: COMPASS_ROOM,
        source: `${FILE}:317`,
      },
      "ganons-tower/compass-room/top-left": {
        req: COMPASS_ROOM,
        source: `${FILE}:256`,
      },
      "ganons-tower/compass-room/top-right": {
        req: COMPASS_ROOM,
        source: `${FILE}:277`,
      },
      "ganons-tower/dms-room/bottom-left": {
        req: DMS_ROOM,
        source: `${FILE}:49`,
      },
      "ganons-tower/dms-room/bottom-right": {
        req: DMS_ROOM,
        source: `${FILE}:62`,
      },
      "ganons-tower/dms-room/top-left": { req: DMS_ROOM, source: `${FILE}:23` },
      "ganons-tower/dms-room/top-right": {
        req: DMS_ROOM,
        source: `${FILE}:36`,
      },
      // Three keys, or two when the big key sits in the randomizer room or a
      // key in this chest (`itemInLocations`, `hasItem`): `maybe`
      "ganons-tower/firesnake-room": {
        fill: {
          holding: {
            items: { KeyA2: `hammer & hookshot & keyA2 >= 2 & ${PEARL}` },
            source: `${FILE}:170`,
          },
        },
        req: `hammer & hookshot & (keyA2 >= 3 | maybe & keyA2 >= 2) & ${PEARL}`,
        source: `${FILE}:159`,
      },
      // Four keys, or three when the chest holds a key or the big key itself
      // (`getItem`), which a tracker cannot know: `maybe`. A key may sit here
      // once three others are found, unless every location must be
      // reachable
      "ganons-tower/map-chest": {
        fill: {
          always: {
            items: ["KeyA2"],
            req: "!setting(locationsAccessibility) & keyA2 >= 3",
            source: `${FILE}:202`,
          },
          holding: {
            items: {
              BigKeyA2: `${MAP_CHEST_WAY} & keyA2 >= 3`,
              KeyA2: `${MAP_CHEST_WAY} & keyA2 >= 3`,
            },
            otherwise: `${MAP_CHEST_WAY} & keyA2 >= 4`,
            source: `${FILE}:187`,
          },
          refuse: [
            {
              refuse: { items: ["KeyA2"] },
              source: `${FILE}:206`,
              when: "setting(locationsAccessibility)",
            },
          ],
        },
        req: `${MAP_CHEST_WAY} & (keyA2 >= 4 | maybe & keyA2 >= 3)`,
        source: `${FILE}:182`,
      },
      "ganons-tower/mini-helmasaur-room/left": {
        fill: REFUSE(397, "BigKeyA2"),
        req: UPSTAIRS,
        source: `${FILE}:383`,
      },
      "ganons-tower/mini-helmasaur-room/right": {
        fill: REFUSE(415, "BigKeyA2"),
        req: UPSTAIRS,
        source: `${FILE}:401`,
      },
      "ganons-tower/moldorm-chest": {
        fill: REFUSE(453, "KeyA2", "BigKeyA2"),
        req: MOLDORM_CHEST,
        source: `${FILE}:437`,
      },
      "ganons-tower/pre-moldorm-chest": {
        fill: REFUSE(433, "BigKeyA2"),
        req: UPSTAIRS,
        source: `${FILE}:419`,
      },
      "ganons-tower/randomizer-room/bottom-left": {
        req: RANDOMIZER_ROOM,
        source: `${FILE}:117`,
      },
      "ganons-tower/randomizer-room/bottom-right": {
        req: RANDOMIZER_ROOM,
        source: `${FILE}:138`,
      },
      "ganons-tower/randomizer-room/top-left": {
        req: RANDOMIZER_ROOM,
        source: `${FILE}:75`,
      },
      "ganons-tower/randomizer-room/top-right": {
        req: RANDOMIZER_ROOM,
        source: `${FILE}:96`,
      },
      "ganons-tower/tile-room": {
        req: `caneOfSomaria & ${PEARL}`,
        source: `${FILE}:244`,
      },
    },
  },
});
