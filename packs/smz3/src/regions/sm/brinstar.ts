// Brinstar: Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/{Blue,Green,Pink,Red,Kraid}.cs.
import { moduleOf, OPEN, type RegionModule, regionId } from "../../world";

const blue = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Blue.cs");

export const BRINSTAR_BLUE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Blue.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Brinstar Blue"),
    locations: [
      blue.location("Morphing Ball", 13),
      blue.location("Power Bomb (blue Brinstar)", 14, "@canUsePowerBombs"),
      blue.location(
        "Missile (blue Brinstar middle)",
        17,
        "cardBrinstarL1 & morph",
      ),
      blue.location("Energy Tank, Brinstar Ceiling", 20, {
        hard: "cardBrinstarL1",
        normal: "cardBrinstarL1 & (@canFly | hiJump | speedBooster | ice)",
      }),
      blue.location("Missile (blue Brinstar bottom)", 24, "morph"),
      blue.location(
        "Missile (blue Brinstar top)",
        27,
        "cardBrinstarL1 & @canUsePowerBombs",
      ),
      blue.location(
        "Missile (blue Brinstar behind missile)",
        30,
        "cardBrinstarL1 & @canUsePowerBombs",
      ),
    ],
    name: "Brinstar Blue",
  },
};

const green = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Green.cs",
);

export const BRINSTAR_GREEN: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Green.cs",
  region: {
    entrances: [green.enter(46, "@canDestroyBombWalls | speedBooster")],
    id: regionId("Brinstar Green"),
    locations: [
      green.location(
        "Power Bomb (green Brinstar bottom)",
        15,
        "cardBrinstarL2 & @canUsePowerBombs",
      ),
      green.location(
        "Missile (green Brinstar below super missile)",
        18,
        "@canPassBombPassages & @canOpenRedDoors",
      ),
      green.location("Super Missile (green Brinstar top)", 21, {
        hard: "@canOpenRedDoors & (morph | speedBooster)",
        normal: "@canOpenRedDoors & speedBooster",
      }),
      green.location("Reserve Tank, Brinstar", 25, {
        hard: "@canOpenRedDoors & (morph | speedBooster)",
        normal: "@canOpenRedDoors & speedBooster",
      }),
      green.location("Missile (green Brinstar behind missile)", 29, {
        hard: "(@canPassBombPassages | morph & screwAttack) & @canOpenRedDoors",
        normal: "speedBooster & @canPassBombPassages & @canOpenRedDoors",
      }),
      green.location("Missile (green Brinstar behind reserve tank)", 33, {
        hard: "@canOpenRedDoors & morph",
        normal: "speedBooster & @canOpenRedDoors & morph",
      }),
      green.location(
        "Energy Tank, Etecoons",
        37,
        "cardBrinstarL2 & @canUsePowerBombs",
      ),
      green.location(
        "Super Missile (green Brinstar bottom)",
        40,
        "cardBrinstarL2 & @canUsePowerBombs & super",
      ),
    ],
    name: "Brinstar Green",
  },
};

const pink = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Pink.cs");

export const BRINSTAR_PINK: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Pink.cs",
  region: {
    entrances: [
      pink.enter(43, {
        hard: [
          "@canOpenRedDoors & (@canDestroyBombWalls | speedBooster)",
          "@canUsePowerBombs",
          // Blue Gate
          "@canAccessNorfairUpperPortal & morph & (missile | super | wave) & (ice | hiJump | @canSpringBallJump | @canFly)",
        ].join(" | "),
        normal: [
          "@canOpenRedDoors & (@canDestroyBombWalls | speedBooster)",
          "@canUsePowerBombs",
          "@canAccessNorfairUpperPortal & morph & wave & (ice | hiJump | spaceJump)",
        ].join(" | "),
      }),
    ],
    id: regionId("Brinstar Pink"),
    locations: [
      pink.location("Super Missile (pink Brinstar)", 15, {
        hard: "(cardBrinstarBoss | cardBrinstarL2) & @canPassBombPassages & super",
        normal: "cardBrinstarBoss & @canPassBombPassages & super",
      }),
      pink.location("Missile (pink Brinstar top)", 19),
      pink.location("Missile (pink Brinstar bottom)", 20),
      pink.location("Charge Beam", 21, "@canPassBombPassages"),
      pink.location("Power Bomb (pink Brinstar)", 24, {
        hard: "@canUsePowerBombs & super",
        normal: "@canUsePowerBombs & super & count(eTank, reserveTank) >= 1",
      }),
      pink.location(
        "Missile (green Brinstar pipe)",
        28,
        "morph & (powerBomb | super | @canAccessNorfairUpperPortal)",
      ),
      pink.location(
        "Energy Tank, Waterway",
        32,
        "@canUsePowerBombs & @canOpenRedDoors & speedBooster & (count(eTank, reserveTank) >= 1 | gravity)",
      ),
      pink.location("Energy Tank, Brinstar Gate", 36, {
        hard: "cardBrinstarL2 & @canUsePowerBombs & (wave | super)",
        normal:
          "cardBrinstarL2 & @canUsePowerBombs & wave & count(eTank, reserveTank) >= 1",
      }),
    ],
    name: "Brinstar Pink",
  },
};

const red = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Red.cs");

export const BRINSTAR_RED: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Red.cs",
  region: {
    entrances: [
      red.enter(36, {
        hard: "(@canDestroyBombWalls | speedBooster) & super & morph | @canAccessNorfairUpperPortal & (ice | @canSpringBallJump | hiJump | @canFly)",
        normal:
          "(@canDestroyBombWalls | speedBooster) & super & morph | @canAccessNorfairUpperPortal & (ice | hiJump | spaceJump)",
      }),
    ],
    id: regionId("Brinstar Red"),
    locations: [
      red.location("X-Ray Scope", 13, {
        hard: "@canUsePowerBombs & @canOpenRedDoors & (grapple | spaceJump | (@canIbj | hiJump & speedBooster | @canSpringBallJump) & (varia & count(eTank, reserveTank) >= 3 | count(eTank, reserveTank) >= 5))",
        normal: "@canUsePowerBombs & @canOpenRedDoors & (grapple | spaceJump)",
      }),
      red.location(
        "Power Bomb (red Brinstar sidehopper room)",
        20,
        "@canUsePowerBombs & super",
      ),
      red.location("Power Bomb (red Brinstar spike room)", 23, {
        hard: "super",
        normal: "(@canUsePowerBombs | ice) & super",
      }),
      red.location(
        "Missile (red Brinstar spike room)",
        27,
        "@canUsePowerBombs & super",
      ),
      red.location("Spazer", 30, "@canPassBombPassages & super"),
    ],
    name: "Brinstar Red",
  },
};

const kraid = moduleOf(
  "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Kraid.cs",
);

export const BRINSTAR_KRAID: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Brinstar/Kraid.cs",
  region: {
    entrances: [
      kraid.enter(
        24,
        "(@canDestroyBombWalls | speedBooster | @canAccessNorfairUpperPortal) & super & @canPassBombPassages",
      ),
    ],
    id: regionId("Brinstar Kraid"),
    locations: [
      kraid.location("Energy Tank, Kraid", 14, "cardBrinstarBoss"),
      kraid.location("Varia Suit", 16, "cardBrinstarBoss"),
      kraid.location("Missile (Kraid)", 18, "@canUsePowerBombs"),
    ],
    name: "Brinstar Kraid",
  },
};
