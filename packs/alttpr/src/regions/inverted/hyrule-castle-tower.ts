// app/Region/Inverted/HyruleCastleTower.php: Castle Tower, whose door is on
// the Dark World's Death Mountain in Inverted. It keeps Standard's rules
// (parent::initalize(), 20) and sets a new can_enter (22-25): no barrier to
// cut, as Link comes from the Dark World.
import { extendModule } from "../../world";
import { HYRULE_CASTLE_TOWER } from "../standard/hyrule-castle-tower";

export const INVERTED_HYRULE_CASTLE_TOWER = extendModule(
  HYRULE_CASTLE_TOWER,
  "app/Region/Inverted/HyruleCastleTower.php",
  {
    hyruleCastleTower: {
      entrances: [
        {
          from: "westDarkWorldDeathMountain",
          req: "@canKillMostThings8",
          source: "app/Region/Inverted/HyruleCastleTower.php:23",
        },
      ],
    },
  },
);
