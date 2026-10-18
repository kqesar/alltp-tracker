// app/Region/Inverted/PalaceOfDarkness.php: Palace of Darkness. It keeps
// Standard's rules (parent::initalize(), 20) and sets a new can_enter
// (22-32): Link is no bunny in the Dark World, so the pearl leaves the rule.
import { extendModule } from "../../world";
import { PALACE_OF_DARKNESS } from "../standard/palace-of-darkness";

/**
 * The basic placement's gate (23-28): a sword (or swordless), 7 hearts and
 * a bottle.
 */
const GATE =
  "(!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle)";

const FILE = "app/Region/Inverted/PalaceOfDarkness.php";

export const INVERTED_PALACE_OF_DARKNESS = extendModule(
  PALACE_OF_DARKNESS,
  FILE,
  {
    palaceOfDarkness: {
      entrances: [
        { from: "northEastDarkWorld", req: GATE, source: `${FILE}:29` },
        // getRegion('West Death Mountain') without canEnter (31): a region
        // object, which PHP reads as true
        {
          from: "start",
          req: `${GATE} & setting(canOneFrameClipOW)`,
          source: `${FILE}:30`,
        },
      ],
    },
  },
);
