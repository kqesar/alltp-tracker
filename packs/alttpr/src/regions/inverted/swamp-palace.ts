// app/Region/Inverted/SwampPalace.php: Swamp Palace, whose door is in the
// Light World in Inverted. It keeps Standard's rules (parent::initalize(),
// 21) and sets every location's again, with new ways to clip in (`$mire`,
// 23-31; `$hera`, 33-38), and a new can_enter.
//
// The glitched branch of can_enter (147-153) needs Misery Mire (`$mire`),
// the Old Man's location (West Death Mountain) and South Light World at
// once: a way from Misery Mire, every location guarded by the others
// (`enteredAlsoFrom`).
import { dungeonBoss } from "../../bosses";
import { enteredAlsoFrom, extendModule } from "../../world";
import { SWAMP_PALACE } from "../standard/swamp-palace";

const FILE = "app/Region/Inverted/SwampPalace.php";

/**
 * `$mire` (23-31): one-frame clipping in from Misery Mire, with its keys.
 * Two do if its big key sits in its Compass or Big Key Chest
 * (`itemInLocations`), which a tracker cannot know: `maybe`.
 */
const MIRE =
  "setting(canOneFrameClipUW) & (keyD6 >= 3 | maybe & keyD6 >= 2) & reach(miseryMire)";

/** `$hera` (33-38): one-frame clipping in from Tower of Hera. */
const HERA = `setting(canOneFrameClipUW) & reach(towerOfHera) & (bigKeyP3 | ${MIRE} & bigKeyD6)`;

/** The first key door, then the hammer's pegs, as most chests want them. */
const PAST_PEGS = `(keyD2 | ${MIRE}) & (hammer | ${MIRE} | ${HERA})`;

/**
 * The boss (102-126), whose rule is the prize's too: Standard's
 * can_complete reads the boss's canAccess. It sets its fill rules again, as
 * Standard writes them.
 */
const BOSS = dungeonBoss(
  `hookshot & ${PAST_PEGS} & @canBeatSwampPalaceBoss`,
  "D2",
  { always: 123, file: FILE, fill: 113, holding: 108 },
);

const RULES = extendModule(SWAMP_PALACE, FILE, {
  swampPalace: {
    entrances: [
      {
        // can_enter (132-155): the flippers, the basic placement's gate
        // (hasBottle(), one bottle), Link or a Super Bunny, and the mirror
        from: "southLightWorld",
        req: "flippers & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & (moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive | setting(canSuperBunny) & magicMirror) & magicMirror",
        source: `${FILE}:133`,
      },
    ],
    locations: {
      "swamp-palace/big-chest": {
        // The big key may lock itself in here, unless every location must
        // be reachable: nothing else needs it
        fill: {
          always: {
            items: ["BigKeyD2"],
            req: "!setting(locationsAccessibility)",
            source: `${FILE}:52`,
          },
          refuse: [
            {
              refuse: { items: ["BigKeyD2"] },
              source: `${FILE}:54`,
              when: "setting(locationsAccessibility)",
            },
          ],
        },
        req: `${PAST_PEGS} & (bigKeyD2 | ${MIRE} & bigKeyD6 | ${HERA} & bigKeyP3)`,
        source: `${FILE}:45`,
      },
      "swamp-palace/big-key-chest": { req: PAST_PEGS, source: `${FILE}:58` },
      "swamp-palace/boss": {
        fill: BOSS.fill,
        req: BOSS.req,
        source: `${FILE}:102`,
      },
      "swamp-palace/compass-chest": { req: PAST_PEGS, source: `${FILE}:75` },
      // The palace's key and nothing else, unless keys are wild: the first
      // door needs it (40-43). `$mire` lifts that only under the one-frame
      // clip, which NoGlitches never has: the clip lifts it, as in Standard
      "swamp-palace/entrance": {
        fill: {
          refuse: [
            {
              refuse: { allBut: ["KeyD2"] },
              source: `${FILE}:40`,
              when: "!setting(canOneFrameClipUW) & !setting(wildKeys)",
            },
          ],
        },
        // Standard's, without Standard's glitched way's guard: Inverted's own
        // follows (`enteredAlsoFrom`)
        req: "true",
        source: "app/Region/Standard/SwampPalace.php:50",
      },
      "swamp-palace/flooded-room/left": {
        req: `hookshot & ${PAST_PEGS}`,
        source: `${FILE}:81`,
      },
      "swamp-palace/flooded-room/right": {
        req: `hookshot & ${PAST_PEGS}`,
        source: `${FILE}:88`,
      },
      "swamp-palace/map-chest": {
        req: `@canBombThings & (keyD2 | ${MIRE})`,
        source: `${FILE}:64`,
      },
      "swamp-palace/prize": { req: BOSS.req },
      "swamp-palace/waterfall-room": {
        req: `hookshot & ${PAST_PEGS}`,
        source: `${FILE}:95`,
      },
      "swamp-palace/west-chest": { req: PAST_PEGS, source: `${FILE}:69` },
    },
  },
});

/**
 * The glitched branch's clip and run (151-153): the boots clip, a spin speed
 * or a one-frame clip overworld.
 */
const CLIP_IN =
  "(pegasusBoots & setting(canBootsClip) | setting(canSuperSpeed) & @canSpinSpeed | setting(canOneFrameClipOW))";

/** The Old Man's location reached (West.php:36): `$locations["Old Man"]->canAccess`. */
const OLD_MAN = "reach(westDeathMountain) & lamp >= setting(requireLamp)";

/** The bunny's way through, as can_enter's first part (137-145) reads it. */
const LINK =
  "(moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive | setting(canSuperBunny) & magicMirror)";

export const INVERTED_SWAMP_PALACE = enteredAlsoFrom(
  RULES,
  "swampPalace",
  {
    // can_enter (132-155), the mirror's alternative: one-frame clipping in
    // from Misery Mire with its keys (`$mire`) and either big key
    from: "miseryMire",
    req: `flippers & (!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle) & ${LINK} & setting(canOneFrameClipUW) & moonPearl & (bigKeyP3 | bigKeyD6) & (keyD6 >= 3 | maybe & keyD6 >= 2) & ${CLIP_IN}`,
    source: `${FILE}:147`,
  },
  `!setting(canOneFrameClipUW) | reach(southLightWorld) & (magicMirror | ${OLD_MAN})`,
);
