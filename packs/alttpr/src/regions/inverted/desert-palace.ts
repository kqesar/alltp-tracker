// app/Region/Inverted/DesertPalace.php: Desert Palace. It keeps Standard's
// rules (parent::initalize(), 21), and sets the Big Key Chest's, the boss's
// and can_enter again: the Light World makes Link a bunny without the pearl,
// though a bunny can still read the Book at the door (81).
import { bossRule } from "../../bosses";
import { extendModule } from "../../world";
import { DESERT_PALACE } from "../standard/desert-palace";

const FILE = "app/Region/Inverted/DesertPalace.php";

/** Link and not a bunny: the pearl, or a glitch that does as much. */
const PEARL =
  "moonPearl | setting(canBunnyRevive) & @canBunnyRevive | setting(canOWYBA) & @hasABottle";

/** can_enter's gate before its three ways in (83-88). */
const GATE = `(setting(canDungeonRevive) | setting(canSuperBunny) & magicMirror | ${PEARL})`;

/**
 * The boss (59-79), whose rule is the prize's too: Standard's can_complete
 * reads the boss's canAccess. Its own region's canEnter (60) is the graph's.
 */
const BOSS = bossRule(
  `(${PEARL} | setting(canOneFrameClipOW) & setting(canDungeonRevive)) & (@canLiftRocks | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW)) & @canLightTorches & bigKeyP2 & keyP2 & @canBeatDesertPalaceBoss`,
  "P2",
  `${FILE}:73`,
);

export const INVERTED_DESERT_PALACE = extendModule(DESERT_PALACE, FILE, {
  desertPalace: {
    // can_enter (82-91): the gate, then $main (23-26), $side (28-38) or
    // $thieves (40-45). $side's one-frame clip needs no South Light World:
    // `a || b && c` is `a || (b && c)` (29-37)
    entrances: [
      {
        from: "southLightWorld",
        req: `${GATE} & (bookOfMudora | (${PEARL}) & setting(canBootsClip) & pegasusBoots)`,
        source: `${FILE}:88`,
      },
      {
        from: "start",
        req: `${GATE} & setting(canOneFrameClipOW)`,
        source: `${FILE}:89`,
      },
      {
        from: "thievesTown",
        req: `${GATE} & keyD4 & bigKeyD4 & setting(canOneFrameClipUW)`,
        source: `${FILE}:90`,
      },
    ],
    locations: {
      "desert-palace/big-key-chest": {
        req: `keyP2 & @canKillMostThings & (${PEARL} | setting(canDungeonRevive) | @hasSword)`,
        source: `${FILE}:49`,
      },
      "desert-palace/boss": {
        fill: { holding: BOSS.holding },
        req: BOSS.req,
        source: `${FILE}:59`,
      },
      "desert-palace/prize": { req: BOSS.req },
    },
  },
});
