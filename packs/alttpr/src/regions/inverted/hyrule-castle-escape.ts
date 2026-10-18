// app/Region/Inverted/HyruleCastleEscape.php: the escape of an Inverted
// world. It extends Open's (11) and keeps its rules (parent::initalize(),
// 21): the Dark Cross, the Map Chest and Zelda stay Open's. It sets the
// others again for Link, who is a bunny in the Light World without the
// pearl, and a new can_enter.
import { extendModule, refuseKeptDungeonItems } from "../../world";
import { OPEN_HYRULE_CASTLE_ESCAPE } from "../open/hyrule-castle-escape";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle";

/** Fighting in the castle: Link, a sword, or a revive (56-68). */
const FIGHT = `setting(canDungeonRevive) | @hasSword | ${PEARL}`;

/** The sewers' secret room (23-54): a rock to lift, or the dark sewers. */
const SECRET_ROOM = `@canLiftRocks & (${PEARL}) | lamp >= setting(requireLamp) & keyH2 & (${FIGHT})`;

/**
 * A mirror clip down from West Death Mountain into the passage to Link's
 * Uncle (84-92, 106-113). Its boots branch reads 'PegasusBoot' (89, 110),
 * which names no item: has() is false.
 */
const CLIP =
  "(setting(canBootsClip) & false | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW)) & reach(westDeathMountain)";

const FILE = "app/Region/Inverted/HyruleCastleEscape.php";

export const INVERTED_HYRULE_CASTLE_ESCAPE = extendModule(
  OPEN_HYRULE_CASTLE_ESCAPE,
  FILE,
  {
    escape: {
      // can_enter (127-135)
      entrances: [
        {
          from: "northEastLightWorld",
          req: `setting(canDungeonRevive) | setting(canSuperBunny) & magicMirror | ${PEARL}`,
          source: `${FILE}:128`,
        },
      ],
      locations: {
        "hyrule-castle/boomerang-chest": {
          req: `keyH2 & (${FIGHT})`,
          source: `${FILE}:56`,
        },
        "hyrule-castle/zeldas-cell": {
          req: `keyH2 & (${FIGHT})`,
          source: `${FILE}:63`,
        },
        // No dungeon item that is not wild, and the Sanctuary reachable with
        // what the world already holds (118-123), as in Open
        "links-uncle": {
          fill: {
            refuse: refuseKeptDungeonItems(`${FILE}:120`),
            requires: { req: "maybe", source: `${FILE}:119` },
          },
          req: `(setting(canMirrorClip) & magicMirror & ${CLIP} | ${PEARL}) & reach(northEastLightWorld)`,
          source: `${FILE}:104`,
        },
        sanctuary: {
          req: `keyH2 & lamp >= setting(requireLamp) | (moonPearl | setting(canSuperBunny) & magicMirror | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive) & reach(northWestLightWorld)`,
          source: `${FILE}:70`,
        },
        // No dungeon item that is not wild (97-102), as in Open
        "secret-passage": {
          fill: { refuse: refuseKeptDungeonItems(`${FILE}:98`) },
          req: `(setting(canMirrorClip) & setting(canSuperBunny) & magicMirror & ${CLIP} | ${PEARL}) & reach(northEastLightWorld)`,
          source: `${FILE}:82`,
        },
        "sewers/secret-room/left": { req: SECRET_ROOM, source: `${FILE}:23` },
        "sewers/secret-room/middle": { req: SECRET_ROOM, source: `${FILE}:34` },
        "sewers/secret-room/right": { req: SECRET_ROOM, source: `${FILE}:45` },
      },
    },
  },
);
