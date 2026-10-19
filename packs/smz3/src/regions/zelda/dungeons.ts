// A Link to the Past's dungeons but Ganon's Tower: Randomizer.SMZ3/Regions/
// Zelda/{EasternPalace,DesertPalace,TowerOfHera,PalaceOfDarkness,SwampPalace,
// SkullWoods,ThievesTown,IcePalace,MiseryMire,TurtleRock}.cs.
//
// A rule that asks what sits at a location (`ItemIs`) reads its placement
// setting (settings.ts, PLACEMENTS); one whose key count falls once Link
// holds more items reads a derived fact (derived.ts).
import { moduleOf, OPEN, type RegionModule, regionId } from "../../world";

const eastern = moduleOf("Randomizer.SMZ3/Regions/Zelda/EasternPalace.cs");

export const EASTERN_PALACE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/EasternPalace.cs",
  region: {
    entrances: [OPEN],
    id: regionId("Eastern Palace"),
    locations: [
      eastern.location("Eastern Palace - Cannonball Chest", 16),
      eastern.location("Eastern Palace - Map Chest", 17),
      eastern.location("Eastern Palace - Compass Chest", 18),
      eastern.location("Eastern Palace - Big Chest", 19, "bigKeyEP"),
      eastern.location("Eastern Palace - Big Key Chest", 21, "lamp"),
      eastern.location(
        "Eastern Palace - Armos Knights",
        23,
        "bigKeyEP & bow & lamp",
      ),
    ],
    name: "Eastern Palace",
  },
};

const desert = moduleOf("Randomizer.SMZ3/Regions/Zelda/DesertPalace.cs");

export const DESERT_PALACE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/DesertPalace.cs",
  region: {
    entrances: [
      desert.enter(
        39,
        "book | mirror & @canLiftHeavy & flute | @canAccessMiseryMirePortal & mirror",
      ),
    ],
    id: regionId("Desert Palace"),
    locations: [
      desert.location("Desert Palace - Big Chest", 16, "bigKeyDP"),
      desert.location("Desert Palace - Torch", 18, "boots"),
      desert.location("Desert Palace - Map Chest", 20),
      desert.location("Desert Palace - Big Key Chest", 21, "keyDP"),
      desert.location("Desert Palace - Compass Chest", 23, "keyDP"),
      desert.location(
        "Desert Palace - Lanmolas",
        25,
        // CanBeatBoss (:33-37)
        "(@canLiftLight | @canAccessMiseryMirePortal & mirror) & bigKeyDP & keyDP & @canLightTorches & (sword | hammer | bow | firerod | icerod | byrna | somaria)",
      ),
    ],
    name: "Desert Palace",
  },
};

const hera = moduleOf("Randomizer.SMZ3/Regions/Zelda/TowerOfHera.cs");

export const TOWER_OF_HERA: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/TowerOfHera.cs",
  region: {
    entrances: [
      hera.enter(
        34,
        "mirror | hookshot & hammer",
        regionId("Light World Death Mountain West"),
      ),
    ],
    id: regionId("Tower of Hera"),
    locations: [
      hera.location("Tower of Hera - Basement Cage", 16),
      hera.location("Tower of Hera - Map Chest", 17),
      hera.location(
        "Tower of Hera - Big Key Chest",
        18,
        "keyTH & @canLightTorches",
      ),
      hera.location("Tower of Hera - Compass Chest", 21, "bigKeyTH"),
      hera.location("Tower of Hera - Big Chest", 23, "bigKeyTH"),
      // CanBeatBoss (:30-32)
      hera.location(
        "Tower of Hera - Moldorm",
        25,
        "bigKeyTH & (sword | hammer)",
      ),
    ],
    name: "Tower of Hera",
  },
};

const pod = moduleOf("Randomizer.SMZ3/Regions/Zelda/PalaceOfDarkness.cs");

/**
 * `items.KeyPD >= (cond || config.Keysanity ? high : high - 1)`: the lower
 * count while `fact` holds (the condition surely fails) outside keysanity.
 */
const podKeys = (high: number, fact: string) =>
  `(keyPD >= ${high} | !setting(keysanity) & ${fact} & keyPD >= ${high - 1})`;

export const PALACE_OF_DARKNESS: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/PalaceOfDarkness.cs",
  region: {
    entrances: [pod.enter(52, "moonPearl", regionId("Dark World North East"))],
    id: regionId("Palace of Darkness"),
    locations: [
      pod.location("Palace of Darkness - Shooter Room", 17),
      pod.location(
        "Palace of Darkness - Big Key Chest",
        18,
        `setting(podBigKeyChestKeyPD) & keyPD >= 1 | ${podKeys(6, "podNoHammerBowLamp")}`,
      ),
      pod.location(
        "Palace of Darkness - Stalfos Basement",
        22,
        "keyPD >= 1 | bow & hammer",
      ),
      pod.location(
        "Palace of Darkness - The Arena - Bridge",
        24,
        "keyPD >= 1 | bow & hammer",
      ),
      pod.location("Palace of Darkness - The Arena - Ledge", 26, "bow"),
      pod.location("Palace of Darkness - Map Chest", 28, "bow"),
      pod.location(
        "Palace of Darkness - Compass Chest",
        30,
        podKeys(4, "podNoHammerBowLamp"),
      ),
      pod.location(
        "Palace of Darkness - Harmless Hellway",
        32,
        `setting(podHarmlessHellwayKeyPD) & ${podKeys(4, "podNoHammerBowLamp")} | ${podKeys(6, "podNoHammerBowLamp")}`,
      ),
      ...["Dark Basement - Left", "Dark Basement - Right"].map((name, i) =>
        pod.location(
          `Palace of Darkness - ${name}`,
          37 + 2 * i,
          `lamp & ${podKeys(4, "podNoHammerBow")}`,
        ),
      ),
      ...["Dark Maze - Top", "Dark Maze - Bottom"].map((name, i) =>
        pod.location(
          `Palace of Darkness - ${name}`,
          41 + 2 * i,
          `lamp & ${podKeys(6, "podNoHammerBow")}`,
        ),
      ),
      pod.location(
        "Palace of Darkness - Big Chest",
        45,
        `bigKeyPD & lamp & ${podKeys(6, "podNoHammerBow")}`,
      ),
      pod.location(
        "Palace of Darkness - Helmasaur King",
        47,
        "lamp & hammer & bow & bigKeyPD & keyPD >= 6",
      ),
    ],
    name: "Palace of Darkness",
  },
};

const swamp = moduleOf("Randomizer.SMZ3/Regions/Zelda/SwampPalace.cs");

export const SWAMP_PALACE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/SwampPalace.cs",
  region: {
    entrances: [
      swamp.enter(
        41,
        "moonPearl & mirror & flippers",
        regionId("Dark World South"),
      ),
    ],
    id: regionId("Swamp Palace"),
    locations: [
      swamp.location("Swamp Palace - Entrance", 17),
      swamp.location("Swamp Palace - Map Chest", 19, "keySP"),
      swamp.location(
        "Swamp Palace - Big Chest",
        21,
        "bigKeySP & keySP & hammer",
      ),
      ...["Compass Chest", "West Chest", "Big Key Chest"].map((name, i) =>
        swamp.location(`Swamp Palace - ${name}`, 24 + 2 * i, "keySP & hammer"),
      ),
      ...[
        "Flooded Room - Left",
        "Flooded Room - Right",
        "Waterfall Room",
        "Arrghus",
      ].map((name, i) =>
        swamp.location(
          `Swamp Palace - ${name}`,
          30 + 2 * i,
          "keySP & hammer & hookshot",
        ),
      ),
    ],
    name: "Swamp Palace",
  },
};

const skull = moduleOf("Randomizer.SMZ3/Regions/Zelda/SkullWoods.cs");

export const SKULL_WOODS: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/SkullWoods.cs",
  region: {
    entrances: [
      skull.enter(32, "moonPearl", regionId("Dark World North West")),
    ],
    id: regionId("Skull Woods"),
    locations: [
      skull.location("Skull Woods - Pot Prison", 16),
      skull.location("Skull Woods - Compass Chest", 17),
      skull.location("Skull Woods - Big Chest", 18, "bigKeySW"),
      skull.location("Skull Woods - Map Chest", 21),
      skull.location("Skull Woods - Pinball Room", 22),
      skull.location("Skull Woods - Big Key Chest", 24),
      skull.location("Skull Woods - Bridge Room", 25, "firerod"),
      skull.location(
        "Skull Woods - Mothula",
        27,
        "firerod & sword & keySW >= 3",
      ),
    ],
    name: "Skull Woods",
  },
};

const thieves = moduleOf("Randomizer.SMZ3/Regions/Zelda/ThievesTown.cs");

export const THIEVES_TOWN: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/ThievesTown.cs",
  region: {
    entrances: [
      thieves.enter(38, "moonPearl", regionId("Dark World North West")),
    ],
    id: regionId("Thieves' Town"),
    locations: [
      ...["Map Chest", "Ambush Chest", "Compass Chest", "Big Key Chest"].map(
        (name, i) => thieves.location(`Thieves' Town - ${name}`, 16 + i),
      ),
      thieves.location("Thieves' Town - Attic", 20, "bigKeyTT & keyTT"),
      thieves.location("Thieves' Town - Blind's Cell", 22, "bigKeyTT"),
      thieves.location(
        "Thieves' Town - Big Chest",
        24,
        "bigKeyTT & hammer & (setting(ttBigChestKeyTT) | keyTT)",
      ),
      thieves.location(
        "Thieves' Town - Blind",
        28,
        // CanBeatBoss (:33-36)
        "bigKeyTT & keyTT & (sword | hammer | somaria | byrna)",
      ),
    ],
    name: "Thieves' Town",
  },
};

const ice = moduleOf("Randomizer.SMZ3/Regions/Zelda/IcePalace.cs");

/**
 * `items.KeyIP >= 1 && CanNotWasteKeysBeforeAccessible(items, others)`:
 * World.ForwardSearch, false in logic, or no big key held yet, or the big
 * key at one of the others.
 */
const ipKey = (...others: string[]) =>
  `keyIP >= 1 & (ipNoBigKey | ${others.map((o) => `setting(ip${o}BigKeyIP)`).join(" | ")})`;

export const ICE_PALACE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/IcePalace.cs",
  region: {
    entrances: [
      ice.enter(52, "moonPearl & flippers & @canLiftHeavy & @canMeltFreezors"),
    ],
    id: regionId("Ice Palace"),
    locations: [
      ice.location("Ice Palace - Compass Chest", 18),
      ice.location(
        "Ice Palace - Spike Room",
        19,
        `hookshot | ${ipKey("MapChest", "BigKeyChest")}`,
      ),
      ice.location(
        "Ice Palace - Map Chest",
        24,
        `hammer & @canLiftLight & (hookshot | ${ipKey("SpikeRoom", "BigKeyChest")})`,
      ),
      ice.location(
        "Ice Palace - Big Key Chest",
        31,
        `hammer & @canLiftLight & (hookshot | ${ipKey("SpikeRoom", "MapChest")})`,
      ),
      ice.location("Ice Palace - Iced T Room", 38),
      ice.location("Ice Palace - Freezor Chest", 39),
      ice.location("Ice Palace - Big Chest", 40, "bigKeyIP"),
      ice.location(
        "Ice Palace - Kholdstare",
        42,
        "bigKeyIP & hammer & @canLiftLight & (keyIP >= 2 | somaria & keyIP >= 1)",
      ),
    ],
    name: "Ice Palace",
  },
};

const mire = moduleOf("Randomizer.SMZ3/Regions/Zelda/MiseryMire.cs");

export const MISERY_MIRE: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/MiseryMire.cs",
  region: {
    entrances: [
      mire.enter(
        39,
        "@hasMireMedallion & sword & moonPearl & (boots | hookshot)",
        regionId("Dark World Mire"),
      ),
    ],
    id: regionId("Misery Mire"),
    locations: [
      mire.location("Misery Mire - Main Lobby", 19, "bigKeyMM | keyMM >= 1"),
      mire.location("Misery Mire - Map Chest", 21, "bigKeyMM | keyMM >= 1"),
      mire.location("Misery Mire - Bridge Chest", 23),
      mire.location("Misery Mire - Spike Chest", 24),
      mire.location(
        "Misery Mire - Compass Chest",
        25,
        "@canLightTorches & (keyMM >= 3 | setting(mmBigKeyChestBigKeyMM) & keyMM >= 2)",
      ),
      mire.location(
        "Misery Mire - Big Key Chest",
        28,
        "@canLightTorches & (keyMM >= 3 | setting(mmCompassChestBigKeyMM) & keyMM >= 2)",
      ),
      mire.location("Misery Mire - Big Chest", 31, "bigKeyMM"),
      mire.location("Misery Mire - Vitreous", 33, "bigKeyMM & lamp & somaria"),
    ],
    name: "Misery Mire",
  },
};

const turtle = moduleOf("Randomizer.SMZ3/Regions/Zelda/TurtleRock.cs");

export const TURTLE_ROCK: RegionModule = {
  file: "Randomizer.SMZ3/Regions/Zelda/TurtleRock.cs",
  helpers: {
    // LaserBridge (:45-47)
    trLaserBridge:
      "bigKeyTR & keyTR >= 3 & lamp & (cape | byrna | @canBlockLasers)",
  },
  region: {
    entrances: [
      turtle.enter(
        53,
        "@hasTurtleRockMedallion & sword & moonPearl & @canLiftHeavy & hammer & somaria",
        regionId("Light World Death Mountain East"),
      ),
    ],
    id: regionId("Turtle Rock"),
    locations: [
      turtle.location("Turtle Rock - Compass Chest", 19),
      turtle.location("Turtle Rock - Roller Room - Left", 20, "firerod"),
      turtle.location("Turtle Rock - Roller Room - Right", 22, "firerod"),
      turtle.location("Turtle Rock - Chain Chomps", 24, "keyTR >= 1"),
      turtle.location(
        "Turtle Rock - Big Key Chest",
        26,
        "keyTR >= 2 & (!setting(keysanity) | setting(trBigKeyChestBigKeyTR)) | keyTR >= 3 & setting(trBigKeyChestKeyTR) | keyTR >= 4",
      ),
      turtle.location("Turtle Rock - Big Chest", 31, "bigKeyTR & keyTR >= 2"),
      turtle.location(
        "Turtle Rock - Crystaroller Room",
        34,
        "bigKeyTR & keyTR >= 2",
      ),
      ...["Top Right", "Top Left", "Bottom Right", "Bottom Left"].map(
        (spot, i) =>
          turtle.location(
            `Turtle Rock - Eye Bridge - ${spot}`,
            36 + i,
            "@trLaserBridge",
          ),
      ),
      turtle.location(
        "Turtle Rock - Trinexx",
        40,
        // CanBeatBoss (:49-51)
        "bigKeyTR & keyTR >= 4 & lamp & firerod & icerod",
      ),
    ],
    name: "Turtle Rock",
  },
};
