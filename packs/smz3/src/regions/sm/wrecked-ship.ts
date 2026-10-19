// The Wrecked Ship: Randomizer.SMZ3/Regions/SuperMetroid/WreckedShip.cs.
import {
  ifKeysanity,
  moduleOf,
  type RegionModule,
  regionId,
} from "../../world";

const ship = moduleOf("Randomizer.SMZ3/Regions/SuperMetroid/WreckedShip.cs");

/** `Config.Keysanity ? items.CardCrateriaL2 : items.CanUsePowerBombs()`. */
const moatDoor = ifKeysanity("cardCrateriaL2", "@canUsePowerBombs");

const energy = (n: number) => `count(eTank, reserveTank) >= ${n}`;

export const WRECKED_SHIP: RegionModule = {
  file: "Randomizer.SMZ3/Regions/SuperMetroid/WreckedShip.cs",
  helpers: {
    // CanUnlockShip
    wreckedShipUnlocked: "cardWreckedShipBoss & @canPassBombPassages",
  },
  region: {
    entrances: [
      ship.enter(57, {
        hard: [
          // Over the Moat
          `super & ${moatDoor}`,
          // Through Maridia -> Forgotten Highway, or climb Mt. Everest
          "super & @canUsePowerBombs & (gravity | hiJump & (ice | @canSpringBallJump) & grapple & cardMaridiaL1)",
          // From Maridia portal -> Forgotten Highway
          "super & @canAccessMaridiaPortal & (hiJump & @canPassBombPassages & cardMaridiaL2 | gravity & @canDestroyBombWalls & cardMaridiaL2)",
        ].join(" | "),
        normal: [
          `super & ${moatDoor} & (speedBooster | grapple | spaceJump | gravity & (@canIbj | hiJump))`,
          "super & @canUsePowerBombs & gravity",
          "super & @canAccessMaridiaPortal & gravity & @canDestroyBombWalls & cardMaridiaL2",
        ].join(" | "),
      }),
      // From Maridia portal -> Forgotten Highway, through Draygon
      // (World.GetLocation("Space Jump").Available)
      ship.enter(
        57,
        "super & @canAccessMaridiaPortal & gravity & @maridiaInnerDraygon",
        regionId("Maridia Inner"),
      ),
    ],
    id: regionId("Wrecked Ship"),
    locations: [
      ship.location(
        "Missile (Wrecked Ship middle)",
        17,
        "@canPassBombPassages",
      ),
      ship.location("Reserve Tank, Wrecked Ship", 20, {
        hard: `@wreckedShipUnlocked & cardWreckedShipL1 & @canUsePowerBombs & speedBooster & (varia | ${energy(2)})`,
        normal: `@wreckedShipUnlocked & cardWreckedShipL1 & @canUsePowerBombs & speedBooster & (grapple | spaceJump | varia & ${energy(2)} | ${energy(3)})`,
      }),
      ship.location("Missile (Gravity Suit)", 26, {
        hard: `@wreckedShipUnlocked & cardWreckedShipL1 & (varia | ${energy(1)})`,
        normal: `@wreckedShipUnlocked & cardWreckedShipL1 & (grapple | spaceJump | varia & ${energy(2)} | ${energy(3)})`,
      }),
      ship.location("Missile (Wrecked Ship top)", 31, "@wreckedShipUnlocked"),
      ship.location("Energy Tank, Wrecked Ship", 33, {
        // "OnceBJ": a morph ball and bombs or power bombs
        hard: "@wreckedShipUnlocked & (morph & (bombs | powerBomb) | @canSpringBallJump | hiJump | spaceJump | speedBooster | gravity)",
        normal:
          "@wreckedShipUnlocked & (hiJump | spaceJump | speedBooster | gravity)",
      }),
      ship.location(
        "Super Missile (Wrecked Ship left)",
        41,
        "@wreckedShipUnlocked",
      ),
      ship.location("Right Super, Wrecked Ship", 43, "@wreckedShipUnlocked"),
      ship.location("Gravity Suit", 45, {
        hard: `@wreckedShipUnlocked & cardWreckedShipL1 & (varia | ${energy(1)})`,
        normal: `@wreckedShipUnlocked & cardWreckedShipL1 & (grapple | spaceJump | varia & ${energy(2)} | ${energy(3)})`,
      }),
    ],
    name: "Wrecked Ship",
  },
};
