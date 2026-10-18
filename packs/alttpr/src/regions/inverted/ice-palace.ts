// app/Region/Inverted/IcePalace.php: Ice Palace. It keeps Standard's rules
// (parent::initalize(), 20) and sets a new can_enter (22-44): Link swims
// there from the Dark World, with no pearl to find.
import { extendModule } from "../../world";
import { ICE_PALACE } from "../standard/ice-palace";

/**
 * can_enter's gate before its branches (23-30): with the basic placement
 * two swords (or swordless), 12 hearts and two bottles or armor; and
 * something to melt the ice.
 */
const GATE =
  "(!setting(basicPlacement) | (setting(swordless) | @hasSword2) & @hasHealth12 & (@hasBottle2 | @hasArmor)) & (@canMeltThings | setting(canOneFrameClipUW))";

const FILE = "app/Region/Inverted/IcePalace.php";

export const INVERTED_ICE_PALACE = extendModule(ICE_PALACE, FILE, {
  icePalace: {
    entrances: [
      {
        from: "start",
        req: `${GATE} & (flippers | setting(canFakeFlipper) & (setting(canBunnyRevive) | @canFly) | setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW) | setting(canSuperSpeed) & @canSpinSpeed)`,
        source: `${FILE}:23`,
      },
      // A fake flipper from North West Dark World (33-38)
      {
        from: "northWestDarkWorld",
        req: `${GATE} & setting(canFakeFlipper) & (!setting(cantTakeDamage) | hammer | @canLiftRocks)`,
        source: `${FILE}:33`,
      },
    ],
  },
});
