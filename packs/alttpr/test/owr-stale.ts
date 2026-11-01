// The cases of the Overworld Randomizer's own tests the pack answers
// otherwise, each with why (owr-contract.spec.ts holds every other case of
// a ported file, and each case below to its reasons). Read at OWR 0.8.0.2
// (owr: paths, upstream.json's doorRandomizer.overworld), never by running
// it.
//
// - test/dungeons: OWR keeps DR's dungeon tests and its harness's way of
//   starting in a lobby without sweeping (test/dungeons/TestDungeon.py:
//   13-34); the 181 cases DR's own world answers otherwise (dr-stale.ts)
//   are the same 181 here. A true case lists every reason it falls short
//   for, and holds once each reason's want is given (owr-contract.spec.ts
//   FIXES: the pearl, every key, the events swept…); a false case holds
//   its one reason's check.
// - test/inverted: OWR's tests are DR's vt-style Inverted tests, but OWR's
//   Inverted is every screen flipped (is_tile_swapped, BaseClasses.py:
//   331-332) with no swap table (link_entrances_new, source/overworld/
//   EntranceShuffle2.py:48-185): caves stay where they stand, and the pool's
//   flute is the activated one (ItemList.py:291). OWR's own answer is shown
//   from its rules: a false case the pack answers yes by a route, a true
//   case by the set it reaches and every exit out of it (owr-proof.ts),
//   each exit's rule reviewed against OWR's lines (owr-edges.ts).

/** Why OWR's own world answers a case otherwise than the test says. */
export const WHY = {
  activatedFlute:
    "OWR's Inverted pool holds the flute activated (get_pool_core's flute_activated, ItemList.py:291, :1129-1131): the case takes the plain Ocarina out, or none, and keeps a flute that flies (can_flute, BaseClasses.py:1431-1434), to the dark world's spots (FluteShuffle.py:36-42); the test reads vt's Inverted pool, whose flute is plain",
  atgtNames:
    "OWR names an entrance by its place: the castle's is Agahnims Tower, which leads into Ganon's Tower once both screens flip (is_atgt_swapped, BaseClasses.py:347-348; EntranceShuffle2.py:69-71); the test reads vt's Inverted names",
  beetles:
    "Hera's beetles die to a sword, the hammer, the bow or a cane only (the kill room's rule, source/enemizer/EnemyLogic.py)",
  bigBomb:
    "OWR's Inverted keeps the Big Bomb Shop and the pyramid's crack in the dark world, where Link starts (is_bombshop_start, OverworldShuffle.py:183-186): the big bomb walks to the crack without the mirror (Rules.py:385, 523-524); the test reads vt's Inverted, whose bomb shop is in the light world",
  bombs:
    "bombs kill the room's enemies: the harness overrides the bomb check (TestBase.py:102), so can_use_bombs holds without the bomb bag (BaseClasses.py:1366-1367)",
  bumperCave:
    "OWR's Inverted keeps Bumper Cave a dark world cave, Link's world: its ledge is the cape's way up (Rules.py:417) or the mirror's from the light world's ledge (mirror_connections, OverworldShuffle.py:1989), with no pearl; the test reads vt's Inverted, whose Bumper Cave door is Old Man Cave's",
  bunny:
    "no Moon Pearl: a dark world dungeon's location asks it (set_bunny_rules, Rules.py:2031-2036)",
  byrna:
    "the Cane of Byrna kills Mire 2's wizzrobes with the pool's magic (the kill room's rule, source/enemizer/EnemyLogic.py)",
  deathMountain:
    "OWR's Inverted keeps Old Man Cave on the light world's Mountain Pass (Regions.py:41, no swap table): from the dark world Link reaches it by the Kakariko portal (Rules.py:1191), whose ledge's rocks ask the Titan's Mitt or the hammer, then the pass's rock, each with the pearl (Rules.py:428, 434-435, 1280, 1286-1287), and Death Mountain's east side asks the hookshot or the mirror (Rules.py:423); the case falls short; the test reads vt's Inverted, whose Bumper Cave door is Old Man Cave's",
  events:
    "TestDungeon never sweeps events: the Convenient Block, Maiden Unmasked or a trench's flood is no item of the case",
  flute:
    "the case's Ocarina is not activated: can_flute asks Ocarina (Activated) (BaseClasses.py:1431-1434), and an Inverted world has no Flute Activation spot (ItemList.py:256-266, Rules.py:100-105); with it activated the case holds",
  iceberg:
    "no water exit lands on Ice Palace's iceberg: the ledge drop or the bomb jump, which No Glitches forbids (Rules.py:1490)",
  keys: "OWR's own key rule (its partial analysis, KeyDoorShuffle.py) counts the dungeon's drop keys, which TestDungeon never sweeps: the case holds fewer keys than the door asks",
  linksHouse:
    "OWR's Inverted starts Link at the Big Bomb Shop (is_bombshop_start, OverworldShuffle.py:183-186) and keeps Link's House in the light world, a bunny's: its chest asks the pearl and a way across (set_bunny_rules, Rules.py:2031-2036)",
  mirror:
    "with the swamp unpatched, Swamp's moat asks the mirror (Rules.py:108-109)",
  overworld:
    "the harness's Menu reaches the overworld (save-and-quit exits), whence the pool reaches another way in",
  pinball:
    "the Pinball Room's chest asks nothing in OWR but the pearl of a dark world dungeon (Regions.py:690, no rule of Rules.py but set_bunny_rules, :2031-2036), and the case starts in its room with the pool's pearl; the test reads an older rule that asked a small key",
  tileRoom:
    "the tile room's anti-fairy dies to the powder only (damage table row 0x15, source/enemizer/EnemyLogic.py)",
  wizzrobes:
    "Mire 2's wizzrobes: the fire rod needs magic for 9 shots, the ice rod kills none (the kill room's rule, source/enemizer/EnemyLogic.py)",
} as const;

/** A reason a case is listed for. */
export type Reason = keyof typeof WHY;

/**
 * Cases a ported file holds otherwise, by `file:line#index name access`
 * (the test's line, the case's index in its list), each with why.
 */
export const OWR_STALE: Readonly<Record<string, Reason | readonly Reason[]>> = {
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
    "overworld",
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
  "test/inverted/TestInvertedDarkWorld.py:6#10 Bumper Cave Ledge false":
    "bumperCave",
  "test/inverted/TestInvertedDarkWorld.py:6#11 Bumper Cave Ledge false":
    "bumperCave",
  "test/inverted/TestInvertedDarkWorld.py:6#12 Bumper Cave Ledge false":
    "activatedFlute",
  "test/inverted/TestInvertedDarkWorld.py:6#13 Bumper Cave Ledge false":
    "bumperCave",
  "test/inverted/TestInvertedDarkWorld.py:47#15 Pyramid Fairy - Left false":
    "bigBomb",
  "test/inverted/TestInvertedDarkWorld.py:47#22 Pyramid Fairy - Right false":
    "bigBomb",
  "test/inverted/TestInvertedDarkWorld.py:82#7 Link's House true": "linksHouse",
  "test/inverted/TestInvertedDarkWorld.py:97#1 Mire Shed - Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDarkWorld.py:97#2 Mire Shed - Left true": "flute",
  "test/inverted/TestInvertedDarkWorld.py:97#3 Mire Shed - Left true": "flute",
  "test/inverted/TestInvertedDarkWorld.py:97#4 Mire Shed - Left true": "flute",
  "test/inverted/TestInvertedDarkWorld.py:97#7 Mire Shed - Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDarkWorld.py:97#8 Mire Shed - Right true": "flute",
  "test/inverted/TestInvertedDarkWorld.py:97#9 Mire Shed - Right true": "flute",
  "test/inverted/TestInvertedDarkWorld.py:97#10 Mire Shed - Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:6#1 Old Man false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:6#3 Old Man true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:6#6 Spectacle Rock Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:6#7 Spectacle Rock Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:6#11 Spectacle Rock Cave true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:6#12 Spectacle Rock Cave true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:6#13 Spectacle Rock Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#2 Spiral Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#3 Spiral Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#9 Spiral Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#10 Spiral Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#11 Spiral Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#12 Spiral Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#15 Paradox Cave Lower - Far Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#16 Paradox Cave Lower - Far Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#20 Paradox Cave Lower - Far Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#21 Paradox Cave Lower - Far Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#22 Paradox Cave Lower - Far Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#23 Paradox Cave Lower - Far Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#26 Paradox Cave Lower - Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#27 Paradox Cave Lower - Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#31 Paradox Cave Lower - Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#32 Paradox Cave Lower - Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#33 Paradox Cave Lower - Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#34 Paradox Cave Lower - Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#37 Paradox Cave Lower - Middle false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#38 Paradox Cave Lower - Middle false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#42 Paradox Cave Lower - Middle true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#43 Paradox Cave Lower - Middle true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#44 Paradox Cave Lower - Middle true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#45 Paradox Cave Lower - Middle true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#48 Paradox Cave Lower - Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#49 Paradox Cave Lower - Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#53 Paradox Cave Lower - Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#54 Paradox Cave Lower - Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#55 Paradox Cave Lower - Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#56 Paradox Cave Lower - Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#59 Paradox Cave Lower - Far Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#60 Paradox Cave Lower - Far Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#64 Paradox Cave Lower - Far Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#65 Paradox Cave Lower - Far Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#66 Paradox Cave Lower - Far Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#67 Paradox Cave Lower - Far Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#70 Paradox Cave Upper - Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#71 Paradox Cave Upper - Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#75 Paradox Cave Upper - Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#76 Paradox Cave Upper - Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#77 Paradox Cave Upper - Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#78 Paradox Cave Upper - Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#81 Paradox Cave Upper - Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#82 Paradox Cave Upper - Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#86 Paradox Cave Upper - Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#87 Paradox Cave Upper - Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#88 Paradox Cave Upper - Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#89 Paradox Cave Upper - Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#93 Mimic Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#94 Mimic Cave false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#95 Mimic Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#96 Mimic Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#98 Mimic Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#101 Ether Tablet false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#102 Ether Tablet false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#107 Ether Tablet true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#108 Ether Tablet true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#110 Ether Tablet true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:25#113 Spectacle Rock false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#114 Spectacle Rock false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:25#117 Spectacle Rock true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#118 Spectacle Rock true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:25#120 Spectacle Rock true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#1 Superbunny Cave - Top false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#2 Superbunny Cave - Top true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#3 Superbunny Cave - Top true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#4 Superbunny Cave - Top true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#6 Superbunny Cave - Bottom false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#7 Superbunny Cave - Bottom true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#8 Superbunny Cave - Bottom true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#9 Superbunny Cave - Bottom true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#11 Hookshot Cave - Bottom Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#13 Hookshot Cave - Bottom Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#14 Hookshot Cave - Bottom Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#15 Hookshot Cave - Bottom Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#16 Hookshot Cave - Bottom Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#17 Hookshot Cave - Bottom Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#18 Hookshot Cave - Bottom Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#20 Hookshot Cave - Bottom Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#22 Hookshot Cave - Bottom Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#23 Hookshot Cave - Bottom Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#24 Hookshot Cave - Bottom Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#26 Hookshot Cave - Top Left false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#28 Hookshot Cave - Top Left true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#29 Hookshot Cave - Top Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#30 Hookshot Cave - Top Left true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#32 Hookshot Cave - Top Right false":
    "activatedFlute",
  "test/inverted/TestInvertedDeathMountain.py:160#34 Hookshot Cave - Top Right true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:160#35 Hookshot Cave - Top Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:160#36 Hookshot Cave - Top Right true":
    "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#6 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#7 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#8 Spike Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#9 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#10 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#11 Spike Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#12 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#13 Spike Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#14 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#15 Spike Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#16 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#17 Spike Cave true": "flute",
  "test/inverted/TestInvertedDeathMountain.py:206#18 Spike Cave true":
    "deathMountain",
  "test/inverted/TestInvertedDeathMountain.py:206#19 Spike Cave true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#1 Hyrule Castle Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#2 Hyrule Castle Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#3 Hyrule Castle Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#8 Eastern Palace false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#9 Eastern Palace false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#10 Eastern Palace false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#16 Desert Palace Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#17 Desert Palace Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#18 Desert Palace Entrance (South) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#26 Desert Palace Entrance (North) false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#34 Tower of Hera false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#35 Tower of Hera false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#36 Tower of Hera true":
    "deathMountain",
  "test/inverted/TestInvertedEntrances.py:6#38 Tower of Hera true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#39 Tower of Hera true": "flute",
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
  "test/inverted/TestInvertedEntrances.py:6#50 Palace of Darkness false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#53 Palace of Darkness true":
    "flute",
  "test/inverted/TestInvertedEntrances.py:6#55 Palace of Darkness true":
    "flute",
  "test/inverted/TestInvertedEntrances.py:6#65 Ice Palace true": "iceberg",
  "test/inverted/TestInvertedEntrances.py:6#67 Misery Mire false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#68 Misery Mire false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#72 Misery Mire true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#74 Misery Mire true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#76 Misery Mire true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#80 Turtle Rock false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#81 Turtle Rock false":
    "activatedFlute",
  "test/inverted/TestInvertedEntrances.py:6#82 Turtle Rock true":
    "deathMountain",
  "test/inverted/TestInvertedEntrances.py:6#83 Turtle Rock true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#84 Turtle Rock true": "flute",
  "test/inverted/TestInvertedEntrances.py:6#85 Turtle Rock true": "flute",
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
  "test/inverted/TestInvertedLightWorld.py:173#20 Bombos Tablet false":
    "activatedFlute",
};
