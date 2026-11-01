// The cases of DR's own tests the pack answers otherwise, each with why
// (dr-contract.spec.ts holds every other case of a ported file). Upstream
// itself fails 181 cases of test/dungeons and 52 of test/inverted at the
// harness commit (626691a's message); in dungeons the 181 below, in
// inverted 51 (1 upstream fails the pack holds: which, only running DR
// would tell),
// each with what upstream's own rules ask that the case does not hold. A
// dungeon case is held to its reasons (dr-contract.spec.ts): a true case
// lists every reason it falls short for and holds once each reason's want
// is given (the pearl, every key, the events swept…), a false case holds
// its one reason's check. The Inverted cases keep their reason as read.

/** Why upstream's own world answers a case otherwise than the test says. */
export const WHY = {
  atgtNames:
    "DR names an entrance by its place: the castle's is Agahnims Tower, Ganon's Tower's in Inverted (is_atgt_swapped); the test reads the old names",
  beetles:
    "Hera's beetles die to a sword, the hammer, the bow or a cane only (the kill room's rule, EnemyLogic.py)",
  bombs:
    "bombs kill the room's enemies: can_use_bombs holds without the bomb bag (BaseClasses.py:1208)",
  bunny:
    "no Moon Pearl: a dark world dungeon's location asks it (set_bunny_rules, Rules.py:2195-2200)",
  byrna:
    "the Cane of Byrna kills Mire 2's wizzrobes with the pool's magic (the kill room's rule, EnemyLogic.py)",
  events:
    "TestDungeon never sweeps events: the Convenient Block, Maiden Unmasked or a trench's flood is no item of the case",
  iceberg:
    "no water exit lands on Ice Palace's iceberg: the ledge drop or the bomb jump, which No Glitches forbids (Rules.py:1287)",
  keys: "DR's own key rule (its partial analysis, KeyDoorShuffle.py) counts the dungeon's drop keys, which TestDungeon never sweeps: the case holds fewer keys than the door asks",
  mirror:
    "with the swamp unpatched, Swamp's moat asks the mirror (Rules.py:88-89)",
  overworld:
    "the harness's Menu reaches the overworld (save-and-quit exits), whence the pool reaches another way in",
  pinball:
    "the Pinball Room's chest asks nothing in DR but the pearl of a dark world dungeon (Regions.py:677, no rule of Rules.py but set_bunny_rules, :2195-2200), and the case starts in its room with the pool's pearl; the test reads an older rule that asked a small key",
  tileRoom:
    "the tile room's anti-fairy dies to the powder only (damage table row 0x15, EnemyLogic.py)",
  wizzrobes:
    "Mire 2's wizzrobes: the fire rod needs magic for 9 shots, the ice rod kills none (Rules.py:1405 kill room)",
} as const;

/** A reason a case is listed for. */
export type Reason = keyof typeof WHY;

/**
 * Cases a ported file holds otherwise, by `file:line#index name access`
 * (the test's line, the case's index in its list), each with why.
 */
export const STALE: Readonly<Record<string, Reason | readonly Reason[]>> = {
  "test/dungeons/TestAgahnimsTower.py:6#0 Castle Tower - Room 03 false":
    "bombs",
  "test/dungeons/TestAgahnimsTower.py:6#1 Castle Tower - Room 03 false":
    "bombs",
  "test/dungeons/TestAgahnimsTower.py:6#6 Castle Tower - Dark Maze false":
    "bombs",
  "test/dungeons/TestAgahnimsTower.py:6#12 Agahnim 1 true": "keys",
  "test/dungeons/TestDarkPalace.py:6#0 Palace of Darkness - Shooter Room true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#3 Palace of Darkness - The Arena - Ledge true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#6 Palace of Darkness - Map Chest true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#9 Palace of Darkness - Big Key Chest true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#13 Palace of Darkness - The Arena - Bridge true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#14 Palace of Darkness - The Arena - Bridge true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#18 Palace of Darkness - Stalfos Basement true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#19 Palace of Darkness - Stalfos Basement true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#22 Palace of Darkness - Compass Chest true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#26 Palace of Darkness - Dark Basement - Left true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#30 Palace of Darkness - Dark Basement - Right true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#33 Palace of Darkness - Harmless Hellway true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#37 Palace of Darkness - Dark Maze - Top true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#41 Palace of Darkness - Dark Maze - Bottom true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#46 Palace of Darkness - Big Chest true":
    "bunny",
  "test/dungeons/TestDarkPalace.py:6#53 Palace of Darkness - Boss true":
    "bunny",
  "test/dungeons/TestDesertPalace.py:6#9 Desert Palace - Compass Chest true":
    "keys",
  "test/dungeons/TestDesertPalace.py:6#12 Desert Palace - Big Key Chest true":
    "keys",
  "test/dungeons/TestDesertPalace.py:6#18 Desert Palace - Boss true": "keys",
  "test/dungeons/TestDesertPalace.py:6#19 Desert Palace - Boss true": "keys",
  "test/dungeons/TestDesertPalace.py:6#20 Desert Palace - Boss true": "keys",
  "test/dungeons/TestDesertPalace.py:6#21 Desert Palace - Boss true": "keys",
  "test/dungeons/TestDesertPalace.py:6#22 Desert Palace - Boss true": "keys",
  "test/dungeons/TestDesertPalace.py:6#23 Desert Palace - Boss true": "keys",
  "test/dungeons/TestEasternPalace.py:6#8 Eastern Palace - Big Key Chest true":
    "keys",
  "test/dungeons/TestEasternPalace.py:6#13 Eastern Palace - Boss true": "keys",
  "test/dungeons/TestGanonsTower.py:6#2 Ganons Tower - Bob's Torch true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#6 Ganons Tower - DMs Room - Top Left true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#10 Ganons Tower - DMs Room - Top Right true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#14 Ganons Tower - DMs Room - Bottom Left true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#18 Ganons Tower - DMs Room - Bottom Right true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#22 Ganons Tower - Randomizer Room - Top Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#26 Ganons Tower - Randomizer Room - Top Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#30 Ganons Tower - Randomizer Room - Bottom Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#34 Ganons Tower - Randomizer Room - Bottom Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#38 Ganons Tower - Firesnake Room true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#42 Ganons Tower - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#43 Ganons Tower - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#46 Ganons Tower - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#47 Ganons Tower - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#48 Ganons Tower - Hope Room - Left true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#49 Ganons Tower - Hope Room - Right true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#51 Ganons Tower - Bob's Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#52 Ganons Tower - Bob's Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#55 Ganons Tower - Tile Room true": [
    "bunny",
    "tileRoom",
  ],
  "test/dungeons/TestGanonsTower.py:6#59 Ganons Tower - Compass Room - Top Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#63 Ganons Tower - Compass Room - Top Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#67 Ganons Tower - Compass Room - Bottom Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#71 Ganons Tower - Compass Room - Bottom Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#73 Ganons Tower - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#74 Ganons Tower - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestGanonsTower.py:6#76 Ganons Tower - Big Key Room - Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#77 Ganons Tower - Big Key Room - Left true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#79 Ganons Tower - Big Key Room - Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#80 Ganons Tower - Big Key Room - Right true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#85 Ganons Tower - Mini Helmasaur Room - Left true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#86 Ganons Tower - Mini Helmasaur Room - Left true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#91 Ganons Tower - Mini Helmasaur Room - Right true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#92 Ganons Tower - Mini Helmasaur Room - Right true":
    "bunny",
  "test/dungeons/TestGanonsTower.py:6#97 Ganons Tower - Pre-Moldorm Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#98 Ganons Tower - Pre-Moldorm Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#105 Ganons Tower - Validation Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#106 Ganons Tower - Validation Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#107 Ganons Tower - Validation Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestGanonsTower.py:6#108 Ganons Tower - Validation Chest true":
    ["bunny", "keys"],
  "test/dungeons/TestIcePalace.py:6#5 Ice Palace - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#6 Ice Palace - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#10 Ice Palace - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#11 Ice Palace - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#17 Ice Palace - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#18 Ice Palace - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#22 Ice Palace - Spike Room true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#23 Ice Palace - Spike Room true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#27 Ice Palace - Freezor Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#28 Ice Palace - Freezor Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#32 Ice Palace - Iced T Room true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#33 Ice Palace - Iced T Room true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#38 Ice Palace - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#39 Ice Palace - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#46 Ice Palace - Boss true": [
    "bunny",
    "keys",
    "events",
  ],
  "test/dungeons/TestIcePalace.py:6#47 Ice Palace - Boss true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestIcePalace.py:6#48 Ice Palace - Boss true": [
    "bunny",
    "keys",
    "events",
  ],
  "test/dungeons/TestIcePalace.py:6#49 Ice Palace - Boss true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#2 Misery Mire - Bridge Chest false":
    "byrna",
  "test/dungeons/TestMiseryMire.py:6#3 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#4 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#5 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#6 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#7 Misery Mire - Bridge Chest true": [
    "bunny",
    "wizzrobes",
  ],
  "test/dungeons/TestMiseryMire.py:6#8 Misery Mire - Bridge Chest true": [
    "bunny",
    "wizzrobes",
  ],
  "test/dungeons/TestMiseryMire.py:6#9 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#10 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#11 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#12 Misery Mire - Bridge Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#13 Misery Mire - Bridge Chest true": [
    "bunny",
    "wizzrobes",
  ],
  "test/dungeons/TestMiseryMire.py:6#14 Misery Mire - Bridge Chest true": [
    "bunny",
    "wizzrobes",
  ],
  "test/dungeons/TestMiseryMire.py:6#18 Misery Mire - Big Chest false": "byrna",
  "test/dungeons/TestMiseryMire.py:6#19 Misery Mire - Big Chest true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#20 Misery Mire - Big Chest true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#24 Misery Mire - Main Lobby true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#25 Misery Mire - Main Lobby true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#26 Misery Mire - Main Lobby true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#27 Misery Mire - Main Lobby true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#32 Misery Mire - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#33 Misery Mire - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#34 Misery Mire - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#35 Misery Mire - Big Key Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#40 Misery Mire - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#41 Misery Mire - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#42 Misery Mire - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#43 Misery Mire - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#47 Misery Mire - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#48 Misery Mire - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#49 Misery Mire - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestMiseryMire.py:6#50 Misery Mire - Map Chest true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#53 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#54 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#55 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#56 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#57 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#58 Misery Mire - Spike Chest true":
    "bunny",
  "test/dungeons/TestMiseryMire.py:6#65 Misery Mire - Boss true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#66 Misery Mire - Boss true": "bunny",
  "test/dungeons/TestMiseryMire.py:6#67 Misery Mire - Boss true": "bunny",
  "test/dungeons/TestSkullWoods.py:6#2 Skull Woods - Big Chest true": "bunny",
  "test/dungeons/TestSkullWoods.py:6#3 Skull Woods - Compass Chest true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:6#4 Skull Woods - Map Chest true": "bunny",
  "test/dungeons/TestSkullWoods.py:6#5 Skull Woods - Pot Prison true": "bunny",
  "test/dungeons/TestSkullWoods.py:6#6 Skull Woods - Pinball Room true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:22#1 Skull Woods - Big Chest false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:22#3 Skull Woods - Compass Chest false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:22#4 Skull Woods - Compass Chest true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:22#5 Skull Woods - Map Chest true": "bunny",
  "test/dungeons/TestSkullWoods.py:22#7 Skull Woods - Pot Prison false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:22#8 Skull Woods - Pot Prison true": "bunny",
  "test/dungeons/TestSkullWoods.py:22#10 Skull Woods - Pinball Room false":
    "pinball",
  "test/dungeons/TestSkullWoods.py:22#11 Skull Woods - Pinball Room true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:43#1 Skull Woods - Big Chest false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:43#2 Skull Woods - Compass Chest true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:43#4 Skull Woods - Map Chest false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:43#5 Skull Woods - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSkullWoods.py:43#6 Skull Woods - Pot Prison true": "bunny",
  "test/dungeons/TestSkullWoods.py:43#7 Skull Woods - Pinball Room true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:60#2 Skull Woods - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSkullWoods.py:60#4 Skull Woods - Compass Chest false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:60#5 Skull Woods - Compass Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSkullWoods.py:60#6 Skull Woods - Map Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSkullWoods.py:60#8 Skull Woods - Pot Prison false":
    "overworld",
  "test/dungeons/TestSkullWoods.py:60#9 Skull Woods - Pot Prison true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSkullWoods.py:60#11 Skull Woods - Pinball Room false":
    "pinball",
  "test/dungeons/TestSkullWoods.py:60#12 Skull Woods - Pinball Room true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:82#0 Skull Woods - Big Key Chest true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:86#0 Skull Woods - Bridge Room true":
    "bunny",
  "test/dungeons/TestSkullWoods.py:86#5 Skull Woods - Boss true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestSwampPalace.py:6#3 Swamp Palace - Entrance true": [
    "bunny",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#10 Swamp Palace - Big Chest true": [
    "bunny",
    "events",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#16 Swamp Palace - Big Key Chest true": [
    "bunny",
    "keys",
    "events",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#21 Swamp Palace - Map Chest true": [
    "bunny",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#27 Swamp Palace - West Chest true": [
    "bunny",
    "keys",
    "events",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#33 Swamp Palace - Compass Chest true": [
    "bunny",
    "events",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#40 Swamp Palace - Flooded Room - Left true":
    ["bunny", "events", "mirror"],
  "test/dungeons/TestSwampPalace.py:6#47 Swamp Palace - Flooded Room - Right true":
    ["bunny", "events", "mirror"],
  "test/dungeons/TestSwampPalace.py:6#54 Swamp Palace - Waterfall Room true": [
    "bunny",
    "events",
    "mirror",
  ],
  "test/dungeons/TestSwampPalace.py:6#61 Swamp Palace - Boss true": [
    "bunny",
    "events",
    "mirror",
  ],
  "test/dungeons/TestThievesTown.py:6#3 Thieves' Town - Attic true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestThievesTown.py:6#4 Thieves' Town - Big Key Chest true":
    "bunny",
  "test/dungeons/TestThievesTown.py:6#5 Thieves' Town - Map Chest true":
    "bunny",
  "test/dungeons/TestThievesTown.py:6#6 Thieves' Town - Compass Chest true":
    "bunny",
  "test/dungeons/TestThievesTown.py:6#7 Thieves' Town - Ambush Chest true":
    "bunny",
  "test/dungeons/TestThievesTown.py:6#12 Thieves' Town - Big Chest true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestThievesTown.py:6#15 Thieves' Town - Blind's Cell true": [
    "bunny",
    "keys",
  ],
  "test/dungeons/TestThievesTown.py:6#20 Thieves' Town - Boss true": [
    "bunny",
    "events",
  ],
  "test/dungeons/TestThievesTown.py:6#21 Thieves' Town - Boss true": [
    "bunny",
    "events",
  ],
  "test/dungeons/TestThievesTown.py:6#22 Thieves' Town - Boss true": [
    "bunny",
    "events",
  ],
  "test/dungeons/TestThievesTown.py:6#23 Thieves' Town - Boss true": [
    "bunny",
    "events",
  ],
  "test/dungeons/TestTowerOfHera.py:6#9 Tower of Hera - Compass Chest true":
    "beetles",
  "test/dungeons/TestTowerOfHera.py:6#12 Tower of Hera - Big Chest true":
    "beetles",
  "test/inverted/TestInvertedEntrances.py:6#41 Agahnims Tower false":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#42 Agahnims Tower false":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#43 Agahnims Tower false":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#44 Agahnims Tower false":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#45 Agahnims Tower true":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#46 Agahnims Tower true":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#47 Agahnims Tower true":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#48 Agahnims Tower true":
    "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#65 Ice Palace true": "iceberg",
  "test/inverted/TestInvertedEntrances.py:6#87 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#88 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#89 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#90 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#91 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#92 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#93 Ganons Tower false": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#94 Ganons Tower true": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#95 Ganons Tower true": "atgtNames",
  "test/inverted/TestInvertedEntrances.py:6#96 Ganons Tower true": "atgtNames",
};
