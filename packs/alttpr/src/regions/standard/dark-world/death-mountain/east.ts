// app/Region/Standard/DarkWorld/DeathMountain/East.php: the east of the
// Dark World's Death Mountain, entered from East Death Mountain by the
// titan's mitt, and its locations.
//
// Not ported here: the Dark World Death Mountain Shop (40-47), a shop, not a
// location. The glitch branches of can_enter (104-110) and of the rules stay
// behind their flags, which NoGlitches folds away.
import type { RegionModule } from "../../../../world";

/** The Hookshot Cave's way in, past the rock, as Link and not a bunny. */
const HOOKSHOT_CAVE =
  "(moonPearl | setting(canOWYBA) & @hasABottle) & (@canLiftRocks | setting(canOneFrameClipOW) | setting(canBootsClip) & pegasusBoots)";

/** Superbunny Cave, as Link, or as a bunny with the glitch. */
const SUPERBUNNY_CAVE =
  "setting(canSuperBunny) | moonPearl | setting(canOWYBA) & @hasABottle & (setting(canBootsClip) & pegasusBoots | setting(canOneFrameClipOW))";

export const DARK_WORLD_DEATH_MOUNTAIN_EAST = {
  file: "app/Region/Standard/DarkWorld/DeathMountain/East.php",
  regions: [
    {
      entrances: [
        {
          from: "eastDeathMountain",
          req: "rescueZelda & @canLiftDarkRocks",
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:102",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canBootsClip) & pegasusBoots & (moonPearl | hammer | setting(canOWYBA) & @hasABottle)",
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:104",
        },
        {
          from: "start",
          req: "rescueZelda & setting(canOneFrameClipOW)",
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:107",
        },
        {
          from: "westDeathMountain",
          req: "rescueZelda & (setting(canMirrorClip) | setting(canMirrorWrap)) & magicMirror",
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:108",
        },
      ],
      id: "eastDarkWorldDeathMountain",
      locations: [
        {
          id: "superbunny-cave/top",
          kind: "chest",
          name: "Superbunny Cave - Top",
          req: SUPERBUNNY_CAVE,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:58",
        },
        {
          id: "superbunny-cave/bottom",
          kind: "chest",
          name: "Superbunny Cave - Bottom",
          req: SUPERBUNNY_CAVE,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:65",
        },
        {
          id: "hookshot-cave/top-right",
          kind: "chest",
          name: "Hookshot Cave - Top Right",
          req: `hookshot & ${HOOKSHOT_CAVE}`,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:72",
        },
        {
          id: "hookshot-cave/top-left",
          kind: "chest",
          name: "Hookshot Cave - Top Left",
          req: `hookshot & ${HOOKSHOT_CAVE}`,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:79",
        },
        {
          id: "hookshot-cave/bottom-left",
          kind: "chest",
          name: "Hookshot Cave - Bottom Left",
          req: `hookshot & ${HOOKSHOT_CAVE}`,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:86",
        },
        {
          // The boots cross the gap too, but for the basic placement
          id: "hookshot-cave/bottom-right",
          kind: "chest",
          name: "Hookshot Cave - Bottom Right",
          req: `(hookshot | !setting(basicPlacement) & pegasusBoots) & ${HOOKSHOT_CAVE}`,
          source: "app/Region/Standard/DarkWorld/DeathMountain/East.php:93",
        },
      ],
      name: "East Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;
