// Norfair: Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/{West,East,
// Crocomire}.cs and NorfairLower/{West,East}.cs.
import {
  ifKeysanity,
  moduleOf,
  type RegionModule,
  regionId,
} from "../../world";

const UPPER_EAST = regionId("Norfair Upper East");

const energy = (n: number) => `count(eTank, reserveTank) >= ${n}`;

/** Norfair's way in from Brinstar, or from the Light World's portal. */
const upperNorfair =
  "((@canDestroyBombWalls | speedBooster) & super & morph | @canAccessNorfairUpperPortal)";

const upperWest = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/West.cs",
);

export const NORFAIR_UPPER_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/West.cs",
  region: {
    entrances: [upperWest.enter(50, upperNorfair)],
    id: regionId("Norfair Upper West"),
    locations: [
      upperWest.location("Missile (lava room)", 13, {
        hard: `@canHellRun & (@canOpenRedDoors & (@canFly | hiJump | speedBooster | @canSpringBallJump | varia & ice) | reach(${UPPER_EAST}) & cardNorfairL2) & morph`,
        normal: `varia & (@canOpenRedDoors & (@canFly | hiJump | speedBooster) | reach(${UPPER_EAST}) & cardNorfairL2) & morph`,
      }),
      upperWest.location("Ice Beam", 26, {
        hard: `${ifKeysanity("cardNorfairL1", "super")} & morph & (varia | ${energy(3)})`,
        normal: `${ifKeysanity("cardNorfairL1", "super")} & @canPassBombPassages & varia & speedBooster`,
      }),
      upperWest.location("Missile (below Ice Beam)", 30, {
        // Blue Gate; access to Croc's room to get spark
        hard: `${ifKeysanity("cardNorfairL1", "super")} & @canUsePowerBombs & (varia | ${energy(3)}) | (missile | super | wave) & varia & speedBooster & ${ifKeysanity("cardNorfairBoss", "super")} & cardNorfairL1`,
        normal: `${ifKeysanity("cardNorfairL1", "super")} & @canUsePowerBombs & varia & speedBooster`,
      }),
      upperWest.location(
        "Hi-Jump Boots",
        38,
        "@canOpenRedDoors & @canPassBombPassages",
      ),
      upperWest.location(
        "Missile (Hi-Jump Boots)",
        41,
        "@canOpenRedDoors & morph",
      ),
      upperWest.location("Energy Tank (Hi-Jump Boots)", 44, "@canOpenRedDoors"),
    ],
    name: "Norfair Upper West",
  },
};

const upperEast = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/East.cs",
);

/** Bubble Mountain's climb, Normal logic. */
const bubbleClimb = (grapple: string) =>
  `cardNorfairL2 & (@canFly | ${grapple} | hiJump | ice)`;

export const NORFAIR_UPPER_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/East.cs",
  region: {
    entrances: [
      upperEast.enter(82, {
        hard: [
          upperNorfair,
          "@canHellRun",
          [
            // Cathedral
            `@canOpenRedDoors & ${ifKeysanity("cardNorfairL2", "super")} & (@canFly | hiJump | speedBooster | @canSpringBallJump | varia & ice)`,
            // Frog Speedway (Blue Gate)
            "speedBooster & (cardNorfairL2 | missile | super | wave) & @canUsePowerBombs",
          ]
            .map((way) => `(${way})`)
            .join(" | "),
        ]
          .map((part) => `(${part})`)
          .join(" & "),
        normal: [
          upperNorfair,
          "varia & super",
          [
            `@canOpenRedDoors & ${ifKeysanity("cardNorfairL2", "super")} & (@canFly | hiJump | speedBooster)`,
            "speedBooster & (cardNorfairL2 | wave) & @canUsePowerBombs",
          ]
            .map((way) => `(${way})`)
            .join(" | "),
        ]
          .map((part) => `(${part})`)
          .join(" & "),
      }),
    ],
    id: UPPER_EAST,
    locations: [
      ...["Reserve Tank, Norfair", "Missile (Norfair Reserve Tank)"].map(
        (name, i) =>
          upperEast.location(name, 13 + 8 * i, {
            hard: "cardNorfairL2 & morph & super",
            normal: `${bubbleClimb("grapple & (speedBooster | @canPassBombPassages)")} & morph`,
          }),
      ),
      upperEast.location("Missile (bubble Norfair green door)", 29, {
        hard: "cardNorfairL2 & super",
        normal: bubbleClimb(
          "grapple & morph & (speedBooster | @canPassBombPassages)",
        ),
      }),
      upperEast.location("Missile (bubble Norfair)", 37, "cardNorfairL2"),
      ...["Missile (Speed Booster)", "Speed Booster"].map((name, i) =>
        upperEast.location(name, 40 + 8 * i, {
          hard: "cardNorfairL2 & super",
          normal: bubbleClimb("morph & (speedBooster | @canPassBombPassages)"),
        }),
      ),
      upperEast.location("Missile (Wave Beam)", 56, {
        hard: "cardNorfairL2 | varia",
        normal: `${bubbleClimb("morph & (speedBooster | @canPassBombPassages)")} | speedBooster & wave & morph & super`,
      }),
      upperEast.location("Wave Beam", 65, {
        hard: "@canOpenRedDoors & (cardNorfairL2 | varia) & (morph | grapple | hiJump & varia | spaceJump)",
        normal: `morph & (${bubbleClimb("morph & (speedBooster | @canPassBombPassages)")} | speedBooster & wave & morph & super)`,
      }),
    ],
    name: "Norfair Upper East",
  },
};

const croc = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/Crocomire.cs",
);

export const NORFAIR_UPPER_CROCOMIRE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/NorfairUpper/Crocomire.cs",
  helpers: {
    // CanAccessCrocomire
    crocomireAccess: ifKeysanity("cardNorfairBoss", "super"),
  },
  region: {
    entrances: [
      croc.enter(48, {
        hard: [
          `${upperNorfair} & (${[
            // Ice Beam -> Croc Speedway
            `${ifKeysanity("cardNorfairL1", "super")} & @canUsePowerBombs & speedBooster & (${energy(3)} | varia)`,
            // Frog Speedway (Blue Gate)
            `speedBooster & (${energy(2)} | varia) & (missile | super | wave)`,
            // Cathedral -> through the floor or Vulcano
            `@canHellRun & @canOpenRedDoors & ${ifKeysanity("cardNorfairL2", "super")} & (@canFly | hiJump | speedBooster | @canSpringBallJump | varia & ice) & (@canPassBombPassages | varia & morph) & (missile | super | wave)`,
          ]
            .map((way) => `(${way})`)
            .join(" | ")})`,
          // Reverse Lava Dive
          `varia & @canAccessNorfairLowerPortal & screwAttack & spaceJump & super & ${energy(2)} & (cardNorfairL2 | morph)`,
        ].join(" | "),
        normal: [
          `${upperNorfair} & varia & (${[
            `${ifKeysanity("cardNorfairL1", "super")} & @canUsePowerBombs & speedBooster`,
            "speedBooster & wave",
            `@canOpenRedDoors & ${ifKeysanity("cardNorfairL2", "super")} & (@canFly | hiJump | speedBooster) & (@canPassBombPassages | gravity & morph) & wave`,
          ]
            .map((way) => `(${way})`)
            .join(" | ")})`,
          "varia & @canAccessNorfairLowerPortal & screwAttack & spaceJump & super & gravity & wave & (cardNorfairL2 | morph)",
        ].join(" | "),
      }),
    ],
    id: regionId("Norfair Upper Crocomire"),
    locations: [
      croc.location("Energy Tank, Crocomire", 13, {
        hard: "@crocomireAccess",
        normal: `@crocomireAccess & (${energy(1)} | spaceJump | grapple)`,
      }),
      croc.location("Missile (above Crocomire)", 17, {
        hard: "(@canFly | grapple | hiJump & (speedBooster | @canSpringBallJump | varia & ice)) & @canHellRun",
        normal: "@canFly | grapple | hiJump & speedBooster",
      }),
      croc.location("Power Bomb (Crocomire)", 24, {
        hard: "@crocomireAccess",
        normal: "@crocomireAccess & (@canFly | hiJump | grapple)",
      }),
      croc.location(
        "Missile (below Crocomire)",
        28,
        "@crocomireAccess & morph",
      ),
      croc.location("Missile (Grappling Beam)", 31, {
        hard: "@crocomireAccess & (speedBooster | morph & (@canFly | grapple))",
        normal:
          "@crocomireAccess & morph & (@canFly | speedBooster & @canUsePowerBombs)",
      }),
      croc.location("Grappling Beam", 35, {
        hard: "@crocomireAccess & (spaceJump | morph | grapple | hiJump & speedBooster)",
        normal:
          "@crocomireAccess & morph & (@canFly | speedBooster & @canUsePowerBombs)",
      }),
    ],
    name: "Norfair Upper Crocomire",
  },
};

const lowerWest = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/NorfairLower/West.cs",
);

export const NORFAIR_LOWER_WEST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/NorfairLower/West.cs",
  region: {
    entrances: [
      lowerWest.enter(
        55,
        {
          // Bubble Mountain, or Frog Speedway -> UN Farming Room gate (Blue Gate)
          hard: "@canUsePowerBombs & varia & (hiJump | gravity) & (cardNorfairL2 | speedBooster & (missile | super | wave))",
          normal:
            "varia & @canUsePowerBombs & spaceJump & gravity & (cardNorfairL2 | speedBooster & wave)",
        },
        UPPER_EAST,
      ),
      lowerWest.enter(55, {
        hard: "@canAccessNorfairLowerPortal & @canDestroyBombWalls",
        normal: "varia & @canAccessNorfairLowerPortal & @canDestroyBombWalls",
      }),
    ],
    id: regionId("Norfair Lower West"),
    locations: [
      lowerWest.location("Missile (Gold Torizo)", 13, {
        hard: "@canUsePowerBombs & spaceJump & varia & (hiJump | gravity | @canAccessNorfairLowerPortal & (@canFly | @canSpringBallJump | speedBooster) & super)",
        normal: "@canUsePowerBombs & spaceJump & super",
      }),
      lowerWest.location("Super Missile (Gold Torizo)", 20, {
        hard: "@canDestroyBombWalls & varia & (super | charge)",
        normal:
          "@canDestroyBombWalls & (super | charge) & (@canAccessNorfairLowerPortal | @canUsePowerBombs & spaceJump)",
      }),
      lowerWest.location("Screw Attack", 25, {
        hard: "@canDestroyBombWalls & (@canAccessNorfairLowerPortal | varia)",
        normal:
          "@canDestroyBombWalls & (@canAccessNorfairLowerPortal | @canUsePowerBombs & spaceJump)",
      }),
      lowerWest.location("Missile (Mickey Mouse room)", 29, {
        // Climb worst room; exit to Upper Norfair, or the portal (with GGG)
        hard: "varia & morph & super & (@canFly | hiJump | @canSpringBallJump | ice & charge) & (@canPassBombPassages | screwAttack & spaceJump) & (cardNorfairL2 | speedBooster | @canFly | grapple | hiJump & (@canSpringBallJump | ice) | @canUsePowerBombs)",
        // Climb worst room; exit to Upper Norfair (intended, or reverse lava
        // dive), or Volcano Room and Blue Gate, or the GT fight to the portal
        normal:
          "morph & super & @canFly & @canUsePowerBombs & ((cardLowerNorfairL1 | gravity) & cardNorfairL2 | gravity & wave & (grapple | spaceJump) | @canUsePowerBombs & spaceJump & (super | charge))",
      }),
    ],
    name: "Norfair Lower West",
  },
};

const lowerEast = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/NorfairLower/East.cs",
);

export const NORFAIR_LOWER_EAST: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/NorfairLower/East.cs",
  helpers: {
    // CanExit: the intended Lower Norfair escape, or the reverse amphitheater
    norfairLowerEastExit: {
      hard: `morph & (cardNorfairL2 | (missile | super | wave) & (speedBooster | @canFly | grapple | hiJump & (@canSpringBallJump | ice))) | ${energy(5)}`,
      normal:
        "morph & (cardNorfairL2 | gravity & wave & (grapple | spaceJump))",
    },
  },
  region: {
    entrances: [
      lowerEast.enter(
        59,
        {
          hard: "varia & cardLowerNorfairL1 & @canUsePowerBombs & (hiJump | gravity) & (@canFly | hiJump | @canSpringBallJump | ice & charge) & (@canPassBombPassages | screwAttack & spaceJump)",
          normal:
            "varia & cardLowerNorfairL1 & @canUsePowerBombs & spaceJump & gravity",
        },
        UPPER_EAST,
      ),
      lowerEast.enter(59, {
        hard: "varia & cardLowerNorfairL1 & @canAccessNorfairLowerPortal & @canDestroyBombWalls & super & (@canFly | @canSpringBallJump | speedBooster) & (@canFly | hiJump | @canSpringBallJump | ice & charge) & (@canPassBombPassages | screwAttack & spaceJump)",
        normal:
          "varia & cardLowerNorfairL1 & @canAccessNorfairLowerPortal & @canDestroyBombWalls & super & @canUsePowerBombs & @canFly",
      }),
    ],
    id: regionId("Norfair Lower East"),
    locations: [
      lowerEast.location(
        "Missile (lower Norfair above fire flea room)",
        15,
        "@norfairLowerEastExit",
      ),
      lowerEast.location(
        "Power Bomb (lower Norfair above fire flea room)",
        18,
        {
          hard: "@norfairLowerEastExit & @canPassBombPassages",
          normal: "@norfairLowerEastExit",
        },
      ),
      lowerEast.location(
        "Power Bomb (Power Bombs of shame)",
        22,
        "@norfairLowerEastExit & @canUsePowerBombs",
      ),
      lowerEast.location("Missile (lower Norfair near Wave Beam)", 25, {
        hard: "@norfairLowerEastExit & morph & @canDestroyBombWalls",
        normal: "@norfairLowerEastExit",
      }),
      lowerEast.location(
        "Energy Tank, Ridley",
        29,
        "@norfairLowerEastExit & cardLowerNorfairBoss & @canUsePowerBombs & super",
      ),
      lowerEast.location("Energy Tank, Firefleas", 32, "@norfairLowerEastExit"),
    ],
    name: "Norfair Lower East",
  },
};
