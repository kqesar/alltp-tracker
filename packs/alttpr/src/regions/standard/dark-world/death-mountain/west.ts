// app/Region/Standard/DarkWorld/DeathMountain/West.php: the west of the
// Dark World's Death Mountain, entered from West Death Mountain, and its
// location.
//
// Not ported here: the Dark Death Mountain Fairy (35-37, 48-53), a shop, not
// a location. Spike Cave's glitch branch (57-62) stays behind its flags,
// which NoGlitches folds away.
import type { RegionModule } from "../../../../world";

export const DARK_WORLD_DEATH_MOUNTAIN_WEST = {
  file: "app/Region/Standard/DarkWorld/DeathMountain/West.php",
  regions: [
    {
      entrances: [
        {
          from: "westDeathMountain",
          req: "rescueZelda",
          source: "app/Region/Standard/DarkWorld/DeathMountain/West.php:68",
        },
      ],
      id: "westDarkWorldDeathMountain",
      locations: [
        {
          // The spikes are crossed under the cape or the Cane of Byrna, with
          // the magic to keep it up (or the hits to take, with Byrna)
          id: "spike-cave",
          kind: "chest",
          name: "Spike Cave",
          req: "(moonPearl | setting(canOWYBA) & @hasABottle & (pegasusBoots & setting(canBootsClip) | setting(canOneFrameClipOW)) & (cape & @canExtendMagic3 | (!setting(cantTakeDamage) | @canExtendMagic3) & caneOfByrna)) & hammer & @canLiftRocks & (@canExtendMagic & cape | (!setting(cantTakeDamage) | @canExtendMagic) & caneOfByrna)",
          source: "app/Region/Standard/DarkWorld/DeathMountain/West.php:55",
        },
      ],
      name: "West Dark World Death Mountain",
    },
  ],
} as const satisfies RegionModule;
