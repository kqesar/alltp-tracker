// Crateria: Randomizer.SMZ3/Regions/SuperMetroid/Crateria/{West,Central,East}.cs.
import {
  ifKeysanity,
  moduleOf,
  OPEN,
  type RegionModule,
  regionId,
} from "../../world";

const west = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Crateria/West.cs");

export const CRATERIA_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Crateria/West.cs",
  helpers: {
    crateriaWestGauntlet: {
      hard: "cardCrateriaL1 & (morph & (bombs | powerBomb >= 2) | screwAttack | speedBooster & @canUsePowerBombs & count(eTank, reserveTank) >= 2)",
      normal:
        "cardCrateriaL1 & morph & (@canFly | speedBooster) & (@canIbj | @canUsePowerBombs & powerBomb >= 2 | screwAttack)",
    },
  },
  region: {
    entrances: [west.enter(29, "@canDestroyBombWalls | speedBooster")],
    id: regionId("Crateria West"),
    locations: [
      west.location("Energy Tank, Terminator", 13),
      west.location("Energy Tank, Gauntlet", 14, {
        hard: "@crateriaWestGauntlet",
        normal: "@crateriaWestGauntlet & count(eTank, reserveTank) >= 1",
      }),
      ...(["right", "left"] as const).map((side, i) =>
        west.location(`Missile (Crateria gauntlet ${side})`, 18 + 4 * i, {
          hard: "@crateriaWestGauntlet & @canPassBombPassages",
          normal:
            "@crateriaWestGauntlet & @canPassBombPassages & count(eTank, reserveTank) >= 2",
        }),
      ),
    ],
    name: "Crateria West",
  },
};

const central = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/Crateria/Central.cs",
);

export const CRATERIA_CENTRAL: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Crateria/Central.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Crateria Central"),
    locations: [
      central.location(
        "Power Bomb (Crateria surface)",
        13,
        `${ifKeysanity("cardCrateriaL1", "@canUsePowerBombs")} & (speedBooster | @canFly)`,
      ),
      central.location("Missile (Crateria middle)", 16, "@canPassBombPassages"),
      central.location("Missile (Crateria bottom)", 19, "@canDestroyBombWalls"),
      central.location(
        "Super Missile (Crateria)",
        22,
        "@canUsePowerBombs & count(eTank, reserveTank) >= 2 & speedBooster",
      ),
      central.location("Bombs", 25, {
        hard: `${ifKeysanity("cardCrateriaBoss", "@canOpenRedDoors")} & morph`,
        normal: `${ifKeysanity("cardCrateriaBoss", "@canOpenRedDoors")} & @canPassBombPassages`,
      }),
    ],
    name: "Crateria Central",
  },
};

const east = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Crateria/East.cs");

/** `Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()`. */
const moatDoor = ifKeysanity("cardCrateriaL2", "@canUsePowerBombs");

export const CRATERIA_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Crateria/East.cs",
  region: {
    entrances: [
      east.enter(33, {
        hard: [
          // Ship -> Moat
          `${moatDoor} & super`,
          // UN Portal -> Red Tower -> Moat
          `${moatDoor} & @canAccessNorfairUpperPortal & (ice | hiJump | @canFly | @canSpringBallJump)`,
          // Through Maridia from Portal: Oasis -> Forgotten Highway
          "@canAccessMaridiaPortal & cardMaridiaL2 & super & (hiJump & @canPassBombPassages | gravity & @canDestroyBombWalls)",
          // Through Maridia from Pipe
          "@canUsePowerBombs & super & (gravity | hiJump & (ice | @canSpringBallJump) & grapple & cardMaridiaL1)",
        ].join(" | "),
        normal: [
          `${moatDoor} & super`,
          `${moatDoor} & @canAccessNorfairUpperPortal & (ice | hiJump | spaceJump)`,
          "@canAccessMaridiaPortal & gravity & super & cardMaridiaL2 & @canDestroyBombWalls",
          "@canUsePowerBombs & super & gravity",
        ].join(" | "),
      }),
      // Through Maridia from Portal: Draygon -> Cactus Alley -> Forgotten
      // Highway (World.GetLocation("Space Jump").Available)
      east.enter(
        33,
        {
          hard: "@canAccessMaridiaPortal & gravity & @maridiaInnerDraygon",
          normal:
            "@canAccessMaridiaPortal & gravity & super & @maridiaInnerDraygon",
        },
        regionId("Maridia Inner"),
      ),
    ],
    id: regionId("Crateria East"),
    locations: [
      east.location("Missile (outside Wrecked Ship bottom)", 13, {
        hard: "morph",
        normal: `morph & (speedBooster | grapple | spaceJump | gravity & (@canIbj | hiJump) | reach(${regionId("Wrecked Ship")}))`,
      }),
      ...(["top", "middle"] as const).map((part, i) =>
        east.location(
          `Missile (outside Wrecked Ship ${part})`,
          21 + 3 * i,
          `reach(${regionId("Wrecked Ship")}) & cardWreckedShipBoss & @canPassBombPassages`,
        ),
      ),
      east.location("Missile (Crateria moat)", 27),
    ],
    name: "Crateria East",
  },
};
