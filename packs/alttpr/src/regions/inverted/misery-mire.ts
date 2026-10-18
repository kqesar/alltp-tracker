// app/Region/Inverted/MiseryMire.php: Misery Mire. It keeps Standard's
// rules (parent::initalize(), 21) and sets a new can_enter (23-39): Link is
// no bunny in the Mire, so the pearl leaves the rule.
import { extendModule } from "../../world";
import { MISERY_MIRE } from "../standard/misery-mire";

export const INVERTED_MISERY_MIRE = extendModule(
  MISERY_MIRE,
  "app/Region/Inverted/MiseryMire.php",
  {
    miseryMire: {
      entrances: [
        {
          // The basic placement's health gate, the pad's medallion and a
          // sword, the boots or the hookshot over the gap, and a weapon for
          // the lobby. The pad is knowledge in the state (medallions.ts)
          from: "mire",
          req: "(!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & @hasMireMedallion & (setting(swordless) | @hasSword) & (pegasusBoots | hookshot) & @canKillMostThings8",
          source: "app/Region/Inverted/MiseryMire.php:24",
        },
      ],
    },
  },
);
