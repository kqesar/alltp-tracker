// Hyrule Castle and Castle Tower: Randomizer.SMZ3/Regions/Zelda/
// {HyruleCastle,CastleTower}.cs.
import { moduleOf, OPEN, type RegionModule, regionId } from "../../world";

const castle = moduleOf("Randomizer.SMZ3/Regions/Zelda/HyruleCastle.cs");

export const HYRULE_CASTLE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/HyruleCastle.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Hyrule Castle"),
    locations: [
      castle.location("Sanctuary", 15),
      ...["Left", "Middle", "Right"].map((spot, i) =>
        castle.location(
          `Sewers - Secret Room - ${spot}`,
          16 + 2 * i,
          "@canLiftLight | lamp & keyHC",
        ),
      ),
      castle.location("Sewers - Dark Cross", 22, "lamp"),
      castle.location("Hyrule Castle - Map Chest", 24),
      castle.location("Hyrule Castle - Boomerang Chest", 25, "keyHC"),
      castle.location("Hyrule Castle - Zelda's Cell", 27, "keyHC"),
      castle.location("Link's Uncle", 29),
      castle.location("Secret Passage", 31),
    ],
    name: "Hyrule Castle",
  },
};

const tower = moduleOf("Randomizer.SMZ3/Regions/Zelda/CastleTower.cs");

export const CASTLE_TOWER: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/CastleTower.cs",
  region: {
    entrances: [tower.enter(22, "@canKillManyEnemies & (cape | sword >= 2)")],
    id: regionId("Castle Tower"),
    locations: [
      tower.location("Castle Tower - Foyer", 16),
      tower.location("Castle Tower - Dark Maze", 17, "lamp & keyCT >= 1"),
    ],
    name: "Castle Tower",
  },
};
