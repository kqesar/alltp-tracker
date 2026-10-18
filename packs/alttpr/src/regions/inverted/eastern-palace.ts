// app/Region/Inverted/EasternPalace.php: Eastern Palace. It keeps
// Standard's rules (parent::initalize(), 21), and sets four locations' and
// can_enter again: in the Light World, Link is a bunny without the pearl.
import { bossRule } from "../../bosses";
import { extendModule } from "../../world";
import { EASTERN_PALACE } from "../standard/eastern-palace";

const FILE = "app/Region/Inverted/EasternPalace.php";

/** Link and not a bunny, or a revive inside: no sword needed (54-58). */
const LINK =
  "setting(canDungeonRevive) | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle | moonPearl";

/** A sword, which a bunny swings once revived (23-49). */
const ARMED = `@hasSword | ${LINK}`;

/**
 * The boss (52-67), whose rule is the prize's too: Standard's can_complete
 * reads the boss's canAccess.
 */
const BOSS = bossRule(
  `@canShootArrows & (${LINK}) & (lamp >= setting(requireLamp) | setting(advancedPlacement) & fireRod) & bigKeyP1 & @canBeatEasternPalaceBoss`,
  "P1",
  `${FILE}:62`,
);

export const INVERTED_EASTERN_PALACE = extendModule(EASTERN_PALACE, FILE, {
  easternPalace: {
    entrances: [
      {
        from: "northEastLightWorld",
        req: `setting(canSuperBunny) & magicMirror | ${LINK}`,
        source: `${FILE}:70`,
      },
    ],
    locations: {
      "eastern-palace/big-chest": {
        req: `(${ARMED}) & bigKeyP1`,
        source: `${FILE}:32`,
      },
      "eastern-palace/big-key-chest": {
        req: `(${ARMED}) & lamp >= setting(requireLamp)`,
        source: `${FILE}:42`,
      },
      "eastern-palace/boss": {
        fill: { holding: BOSS.holding },
        req: BOSS.req,
        source: `${FILE}:52`,
      },
      "eastern-palace/compass-chest": { req: ARMED, source: `${FILE}:23` },
      "eastern-palace/prize": { req: BOSS.req },
    },
  },
});
