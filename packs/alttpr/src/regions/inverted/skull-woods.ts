// app/Region/Inverted/SkullWoods.php: Skull Woods. It keeps Standard's
// rules (parent::initalize(), 21), and sets the Bridge Room's, the boss's
// and can_enter again: Link is no bunny in the Dark World, so the pearl
// leaves them.
import { bossRule } from "../../bosses";
import { extendModule } from "../../world";
import { SKULL_WOODS } from "../standard/skull-woods";

const FILE = "app/Region/Inverted/SkullWoods.php";

/**
 * The boss (28-40), whose rule is the prize's too: Standard's can_complete
 * reads the boss's canAccess. Its own region's canEnter (29) is the graph's.
 */
const BOSS = bossRule(
  "fireRod & (setting(swordless) | @hasSword) & keyD3 >= 3 & @canBeatSkullWoodsBoss",
  "D3",
  `${FILE}:35`,
);

export const INVERTED_SKULL_WOODS = extendModule(SKULL_WOODS, FILE, {
  skullWoods: {
    entrances: [
      {
        // The basic placement's gate: a sword (or swordless), 7 hearts and
        // a bottle
        from: "northWestDarkWorld",
        req: "!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle",
        source: `${FILE}:43`,
      },
    ],
    locations: {
      "skull-woods/boss": {
        fill: { holding: BOSS.holding },
        req: BOSS.req,
        source: `${FILE}:28`,
      },
      "skull-woods/bridge-room": { req: "fireRod", source: `${FILE}:24` },
      "skull-woods/prize": { req: BOSS.req },
    },
  },
});
