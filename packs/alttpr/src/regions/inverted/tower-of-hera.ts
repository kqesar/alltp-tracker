// app/Region/Inverted/TowerOfHera.php: Tower of Hera. It keeps Standard's
// rules (parent::initalize(), 21), and sets its ways in (`$main`, 23-38;
// `$mire`, 40-49), four locations' rules and can_enter again. As in
// Standard, each way in is a part of the module: `towerOfHeraMain` and
// `towerOfHeraMire`, which the tower is entered from (101-104).
import { dungeonBoss } from "../../bosses";
import { extendModule } from "../../world";
import { TOWER_OF_HERA } from "../standard/tower-of-hera";

const FILE = "app/Region/Inverted/TowerOfHera.php";

/**
 * The boss (77-99), whose rule is the prize's too: Standard's can_complete
 * reads the boss's canAccess. It sets its fill rules again, as Standard
 * writes them.
 */
const BOSS = dungeonBoss(
  "reach(towerOfHeraMain) & @canBeatTowerOfHeraBoss & (bigKeyP3 | reach(towerOfHeraMire) & bigKeyD6)",
  "P3",
  { always: 96, file: FILE, fill: 86, holding: 81 },
);

export const INVERTED_TOWER_OF_HERA = extendModule(TOWER_OF_HERA, FILE, {
  towerOfHera: {
    entrances: [
      { from: "towerOfHeraMain", req: "true", source: `${FILE}:102` },
      { from: "towerOfHeraMire", req: "true", source: `${FILE}:103` },
    ],
    locations: {
      "tower-of-hera/big-chest": {
        req: "reach(towerOfHeraMain) & bigKeyP3 | reach(towerOfHeraMire) & (bigKeyP3 | bigKeyD6)",
        source: `${FILE}:70`,
      },
      // The tower's key may lock itself in here, unless every location must
      // be reachable: nothing else needs it (58-62)
      "tower-of-hera/big-key-chest": {
        fill: {
          always: {
            items: ["KeyP3"],
            req: "!setting(locationsAccessibility)",
            source: `${FILE}:58`,
          },
          refuse: [
            {
              refuse: { items: ["KeyP3"] },
              source: `${FILE}:60`,
              when: "setting(locationsAccessibility)",
            },
          ],
        },
        req: "@canLightTorches & (keyP3 & (moonPearl | setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive) | reach(towerOfHeraMire))",
        source: `${FILE}:52`,
      },
      "tower-of-hera/boss": {
        fill: BOSS.fill,
        req: BOSS.req,
        source: `${FILE}:77`,
      },
      "tower-of-hera/compass-chest": {
        req: "reach(towerOfHeraMain) & bigKeyP3 | reach(towerOfHeraMire)",
        source: `${FILE}:64`,
      },
      "tower-of-hera/prize": { req: BOSS.req },
    },
  },
  towerOfHeraMain: {
    // `$main`: the pearl and the hammer from East Death Mountain; from West
    // Death Mountain, glitches only
    entrances: [
      {
        from: "eastDeathMountain",
        req: "moonPearl & hammer",
        source: `${FILE}:24`,
      },
      {
        from: "westDeathMountain",
        req: "(moonPearl | setting(canOWYBA) & @hasBottle2 | (setting(canOWYBA) & @hasABottle | setting(canBunnyRevive) & @canBunnyRevive) & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))) & (setting(canOneFrameClipOW) | setting(canSuperSpeed) & @canSpinSpeed | setting(canBootsClip) & pegasusBoots) | setting(canOneFrameClipOW) & @hasSword & setting(canSuperBunny) & magicMirror",
        source: `${FILE}:26`,
      },
    ],
  },
  towerOfHeraMire: {
    // `$mire`, as Standard's: through Misery Mire with the one-frame clip,
    // and its keys. Two do if its big key sits in its Compass or Big Key
    // Chest (`itemInLocations`), which a tracker cannot know: `maybe`
    entrances: [
      {
        from: "miseryMire",
        req: "setting(canOneFrameClipUW) & (keyD6 >= 3 | maybe & keyD6 >= 2)",
        source: `${FILE}:41`,
      },
    ],
  },
});
