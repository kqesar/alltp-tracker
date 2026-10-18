// app/Region/Inverted/ThievesTown.php: Thieves' Town. It keeps Standard's
// rules (parent::initalize(), 20) and sets a new can_enter (22-30): Link is
// no bunny in the Dark World, so the pearl leaves the rule.
import { extendModule } from "../../world";
import { THIEVES_TOWN } from "../standard/thieves-town";

export const INVERTED_THIEVES_TOWN = extendModule(
  THIEVES_TOWN,
  "app/Region/Inverted/ThievesTown.php",
  {
    thievesTown: {
      entrances: [
        {
          // The basic placement's gate: a sword (or swordless), 7 hearts
          // and a bottle
          from: "northWestDarkWorld",
          req: "!setting(basicPlacement) | (setting(swordless) | @hasSword) & @hasHealth7 & @hasABottle",
          source: "app/Region/Inverted/ThievesTown.php:23",
        },
      ],
    },
  },
);
