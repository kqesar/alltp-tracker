// Maridia: Randomizer.SMZ3/Regions/SuperMetroid/Maridia/{Outer,Inner}.cs.
import { moduleOf, type RegionModule, regionId } from "../../world";

const NORFAIR_UPPER_WEST = regionId("Norfair Upper West");

const outer = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Maridia/Outer.cs");

export const MARIDIA_OUTER: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Maridia/Outer.cs",
  region: {
    entrances: [
      outer.enter(
        31,
        {
          hard: "@canUsePowerBombs & (gravity | hiJump & (@canSpringBallJump | ice))",
          normal: "gravity & @canUsePowerBombs",
        },
        NORFAIR_UPPER_WEST,
      ),
      outer.enter(31, {
        hard: "@canAccessMaridiaPortal & cardMaridiaL1 & cardMaridiaL2 & (@canPassBombPassages | gravity & screwAttack | super & (gravity | hiJump & (@canSpringBallJump | ice)))",
        normal:
          "gravity & @canAccessMaridiaPortal & cardMaridiaL1 & cardMaridiaL2 & (@canPassBombPassages | screwAttack)",
      }),
    ],
    id: regionId("Maridia Outer"),
    locations: [
      outer.location("Missile (green Maridia shinespark)", 13, {
        hard: "gravity & speedBooster",
        normal: "speedBooster",
      }),
      outer.location("Super Missile (green Maridia)", 17),
      outer.location("Energy Tank, Mama turtle", 18, {
        hard: "@canOpenRedDoors & (@canFly | speedBooster | grapple | @canSpringBallJump & (gravity | hiJump))",
        normal: "@canOpenRedDoors & (@canFly | speedBooster | grapple)",
      }),
      outer.location("Missile (green Maridia tatori)", 25, "@canOpenRedDoors"),
    ],
    name: "Maridia Outer",
  },
};

const inner = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/Maridia/Inner.cs");

const yellow =
  "cardMaridiaL1 & @canPassBombPassages & @maridiaInnerAqueduct & (gravity | ice | hiJump & springBall)";

/** Botwoon's way to Draygon, or the portal behind it. */
const draygonWay =
  "(cardMaridiaL1 & cardMaridiaL2 & @maridiaInnerBotwoon | @canAccessMaridiaPortal)";

export const MARIDIA_INNER: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/Maridia/Inner.cs",
  helpers: {
    // CanReachAqueduct
    maridiaInnerAqueduct: {
      hard: "cardMaridiaL1 & (gravity | hiJump & (ice | @canSpringBallJump) & grapple) | cardMaridiaL2 & @canAccessMaridiaPortal",
      normal:
        "cardMaridiaL1 & (@canFly | speedBooster | grapple) | cardMaridiaL2 & @canAccessMaridiaPortal",
    },
    // CanDefeatBotwoon
    maridiaInnerBotwoon: {
      hard: "ice | speedBooster & gravity | @canAccessMaridiaPortal",
      normal: "speedBooster | @canAccessMaridiaPortal",
    },
    // CanDefeatDraygon
    maridiaInnerDraygon: {
      hard: `${draygonWay} & cardMaridiaBoss & gravity`,
      normal: `${draygonWay} & cardMaridiaBoss & gravity & (speedBooster & hiJump | @canFly)`,
    },
  },
  region: {
    entrances: [
      inner.enter(
        115,
        {
          hard: "super & @canUsePowerBombs & (gravity | hiJump & (ice | @canSpringBallJump) & grapple)",
          normal:
            "gravity & super & @canUsePowerBombs & (@canFly | speedBooster | grapple)",
        },
        NORFAIR_UPPER_WEST,
      ),
      inner.enter(115, {
        hard: "@canAccessMaridiaPortal",
        normal: "gravity & @canAccessMaridiaPortal",
      }),
    ],
    id: regionId("Maridia Inner"),
    locations: [
      inner.location("Super Missile (yellow Maridia)", 15, yellow),
      inner.location("Missile (yellow Maridia super missile)", 19, yellow),
      inner.location("Missile (yellow Maridia false wall)", 23, yellow),
      inner.location("Plasma Beam", 27, {
        hard: "@maridiaInnerDraygon & (charge & count(eTank, reserveTank) >= 3 | screwAttack | plasma | speedBooster) & (hiJump | @canSpringBallJump | @canFly | speedBooster)",
        normal:
          "@maridiaInnerDraygon & (screwAttack | plasma) & (hiJump | @canFly)",
      }),
      ...["Missile (left Maridia sand pit room)", "Reserve Tank, Maridia"].map(
        (name, i) =>
          inner.location(name, 33 + 5 * i, {
            hard: "@maridiaInnerAqueduct & super & (gravity | hiJump & (spaceJump | @canSpringBallJump))",
            normal: "@maridiaInnerAqueduct & super & @canPassBombPassages",
          }),
      ),
      inner.location("Missile (right Maridia sand pit room)", 43, {
        hard: "@maridiaInnerAqueduct & super & (hiJump | gravity)",
        normal: "@maridiaInnerAqueduct & super",
      }),
      inner.location("Power Bomb (right Maridia sand pit room)", 47, {
        hard: "@maridiaInnerAqueduct & super & (gravity | hiJump & @canSpringBallJump)",
        normal: "@maridiaInnerAqueduct & super",
      }),
      ...["Missile (pink Maridia)", "Super Missile (pink Maridia)"].map(
        (name, i) =>
          inner.location(name, 51 + 4 * i, {
            hard: "@maridiaInnerAqueduct & gravity",
            normal: "@maridiaInnerAqueduct & speedBooster",
          }),
      ),
      inner.location("Spring Ball", 59, {
        hard: "super & grapple & @canUsePowerBombs & (gravity & (@canFly | hiJump) | ice & hiJump & @canSpringBallJump & spaceJump)",
        normal: "super & grapple & @canUsePowerBombs & (spaceJump | hiJump)",
      }),
      inner.location("Missile (Draygon)", 66, {
        hard: `${draygonWay} & gravity`,
        normal: draygonWay,
      }),
      inner.location(
        "Energy Tank, Botwoon",
        75,
        "cardMaridiaL1 & cardMaridiaL2 & @maridiaInnerBotwoon | @canAccessMaridiaPortal & cardMaridiaL2",
      ),
      inner.location("Space Jump", 80, "@maridiaInnerDraygon"),
    ],
    name: "Maridia Inner",
  },
};
