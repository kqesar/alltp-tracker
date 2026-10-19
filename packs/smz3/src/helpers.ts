// The helpers every region reads: upstream's ProgressionExtensions
// (Randomizer.SMZ3/Item.cs:819-926), and World.CanAcquire for the rewards
// (World.cs:102-113).
//
// A helper the engine names `@canFly`; one that takes an argument upstream
// takes it in its name (CanExtendMagic(4) is @canExtendMagic4), since
// helpers have none. HasEnergyReserves(n) is written in place:
// `count(eTank, reserveTank) >= n`.

import type { Rule } from "./world";

export const HELPERS = {
  agahnim:
    // World.CanAcquire(items, Agahnim): Castle Tower holds it, so its
    // CanComplete (CastleTower.cs:22-28), CanEnter included
    "@canKillManyEnemies & (cape | sword >= 2) & lamp & keyCT >= 2 & sword",
  allPendants:
    // CanAcquireAll(AnyPendant), or no boss holds them (the logic tests)
    "!setting(rewardsPlaced) | pendantGreen & pendantNonGreen >= 2",
  canAccessDarkWorldPortal: {
    hard: "cardMaridiaL1 & cardMaridiaL2 & @canUsePowerBombs & super & (charge | super & missile) & (gravity | hiJump & ice & grapple) & (ice | gravity & speedBooster)",
    normal:
      "cardMaridiaL1 & cardMaridiaL2 & @canUsePowerBombs & super & gravity & speedBooster",
  },
  canAccessDeathMountainPortal:
    "(@canDestroyBombWalls | speedBooster) & super & morph",
  canAccessMaridiaPortal: {
    hard: "moonPearl & flippers & (@canSpringBallJump | hiJump | gravity) & morph & (@agahnim | hammer & @canLiftLight | @canLiftHeavy)",
    normal:
      "moonPearl & flippers & gravity & morph & (@agahnim | hammer & @canLiftLight | @canLiftHeavy)",
  },
  canAccessMiseryMirePortal: {
    hard: "(cardNorfairL2 | speedBooster) & varia & super & (@canFly | hiJump | speedBooster | @canSpringBallJump | ice) & (gravity | hiJump) & @canUsePowerBombs",
    normal:
      "(cardNorfairL2 | speedBooster & wave) & varia & super & gravity & spaceJump & @canUsePowerBombs",
  },
  canAccessNorfairLowerPortal: "flute & @canLiftHeavy",
  canAccessNorfairUpperPortal: "flute | @canLiftLight & lamp",
  canBlockLasers: "shield >= 3",
  canDestroyBombWalls: "@canPassBombPassages | screwAttack",
  // (HalfMagic ? 2 : 1) * (Bottle ? 2 : 1) >= 2, then >= 4
  canExtendMagic: "halfMagic | bottle",
  canExtendMagic4: "halfMagic & bottle",
  canFly: "spaceJump | @canIbj",
  canHellRun: "varia | count(eTank, reserveTank) >= 5",
  canIbj: "morph & bombs",
  canKillManyEnemies:
    "sword | hammer | bow | firerod | somaria | byrna & @canExtendMagic",
  canLiftHeavy: "glove >= 2",
  canLiftLight: "glove",
  canLightTorches: "firerod | lamp",
  canMeltFreezors: "firerod | bombos & sword",
  canOpenRedDoors: "missile | super",
  canPassBombPassages: "morph & (bombs | powerBomb)",
  canSpringBallJump: "morph & springBall",
  canUsePowerBombs: "morph & powerBomb",
  greenPendant:
    // CanAcquire(PendantGreen), or no boss holds it (the logic tests)
    "!setting(rewardsPlaced) | pendantGreen",
  redCrystals:
    // CanAcquireAll(CrystalRed), or no boss holds them (the logic tests)
    "!setting(rewardsPlaced) | crystalRed >= 2",
} as const satisfies Readonly<Record<string, Rule>>;
