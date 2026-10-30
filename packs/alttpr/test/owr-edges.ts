// The exits and locations the proofs of owr-contract.spec.ts read (owr-
// proof.ts: a witness route or a cut), each with the rule the world built
// on OWR's data gives it (settings folded, as print writes it) and where
// that rule is read in OWR 0.8.0.2's source (owr: paths; "no rule" names
// the line that links it). Each was reviewed against the cited lines,
// bunny rules included (add_bunny_rule and set_bunny_rules give the pearl
// in the light world of Inverted, BaseClasses.py:1703-1707); a rule that
// moves fails the spec until reviewed again. Mirror exits are
// create_dynamic_mirror_exits' (OverworldShuffle.py:1196-1205), flute exits
// create_dynamic_flute_exits' (FluteShuffle.py:668-675).

/** By exit (`a | b` for parallel ones), `exit:` probe or `location` name. */
export const OWR_EDGES: Readonly<
  Record<string, readonly [rule: string, source: string]>
> = {
  "20 Rupee Cave": ["@drCanLiftRocks & moonPearl", "Rules.py:520, :1256"],
  "50 Rupee Cave": ["@drCanLiftRocks & moonPearl", "Rules.py:521, :1257"],
  "Agahnims Tower": [
    "count(crystal) >= 7",
    "Rules.py:1164-1165 (Ganon's Tower's crystals when ATGT is swapped)",
  ],
  "Big Bomb Shop ES": ["true", "no rule (OverworldShuffle.py:2352)"],
  "Big Bomb Shop Exit": ["true", "no rule (EntranceShuffle2.py:194-196)"],
  "Blacksmith Ledge Peg (West)": ["hammer & moonPearl", "Rules.py:449, :1317"],
  "Blinds Hideout N": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Bonk Fairy (Dark)": ["@drHasBoots", "Rules.py:528, :1265"],
  "Bonk Fairy (Light)": ["@drHasBoots & moonPearl", "Rules.py:518, :1254"],
  "Bonk Rock Cave": ["@drHasBoots & moonPearl", "Rules.py:515, :1249"],
  "Broken Bridge Northeast Water Drop": ["flippers", "Rules.py:487, :1375"],
  "Broken Bridge Water Drop": ["flippers", "Rules.py:486, :1374"],
  "Broken Bridge West Water Drop": ["flippers", "Rules.py:488, :1376"],
  "Bumper Cave (Bottom)": ["true", "no rule (EntranceShuffle2.py:2863)"],
  "Bumper Cave Bottom to Top": ["cape", "Rules.py:417"],
  "Bumper Cave Exit (Top)": ["true", "no rule (EntranceShuffle2.py:3183)"],
  "Bumper Cave Rock (Outer)": ["@drCanLiftRocks", "Rules.py:472, :1350"],
  "Bush Yard Pegs (Outer)": ["hammer", "Rules.py:481, :1369"],
  "C Whirlpool EN | C Whirlpool ES": [
    "true",
    "no rule (OverworldShuffle.py:2273), no rule (OverworldShuffle.py:2275)",
  ],
  "C Whirlpool Pegs (Inner)": ["hammer & moonPearl", "Rules.py:457, :1328"],
  "C Whirlpool Pegs (Outer)": ["hammer & moonPearl", "Rules.py:456, :1327"],
  "C Whirlpool Water Entry": [
    "flippers & moonPearl",
    "Rules.py:1324, :1437, :1470",
  ],
  "Catfish Approach Water Drop": ["flippers", "Rules.py:1366, :1445, :1478"],
  "Checkerboard Cave": ["@drCanLiftRocks & moonPearl", "Rules.py:519, :1255"],
  "Dam NC": ["true", "no rule (OWEdges.py:173)"],
  "Dam WC": ["true", "no rule (OWEdges.py:174)"],
  "Dark C Whirlpool Pegs (Outer)": ["hammer", "Rules.py:501, :1392"],
  "Dark C Whirlpool Water Entry": ["flippers", "Rules.py:1389, :1446, :1479"],
  "Dark Chapel WN | Dark Chapel WS": [
    "true",
    "no rule (OWEdges.py:214), no rule (OWEdges.py:215)",
  ],
  "Dark Death Mountain Teleporter (West)": [
    "true",
    "no rule (OverworldShuffle.py:1777)",
  ],
  "Dark Dunes WN": ["true", "no rule (OWEdges.py:253)"],
  "Dark Lake Hylia Ledge Spike Cave": [
    "@drCanLiftRocks",
    "Rules.py:529, :1267",
  ],
  "Dark Sanctuary Hint Exit": ["true", "no rule (EntranceShuffle2.py:197-199)"],
  "Dark Witch Northeast Water Drop": [
    "flippers",
    "Rules.py:1363, :1444, :1477",
  ],
  "Dark Witch Rock (South)": ["@drCanLiftRocks", "Rules.py:478, :1365"],
  "Dark Witch Water Drop": ["flippers", "Rules.py:1362, :1443, :1476"],
  "Death Mountain Return Cave (East)": [
    "true",
    "no rule (EntranceShuffle2.py:2857)",
  ],
  "Death Mountain Return Cave Exit (West)": [
    "lamp",
    "Rules.py:1541, :1557-1558 (dark room)",
  ],
  "Death Mountain Return Cave W": [
    "lamp & moonPearl",
    "Rules.py:1542, :1557-1558 (dark room), :2002-2008 (bunny)",
  ],
  "Desert ES": ["true", "no rule (OverworldShuffle.py:2288)"],
  "Desert Ledge Rocks (Outer)": [
    "@drCanLiftRocks & moonPearl",
    "Rules.py:452, :1320",
  ],
  "Desert Main Lobby Left Path": [
    "moonPearl",
    "Rules.py:2098, :2014-2017 (bunny_impassible_doors)",
  ],
  "Desert Main Lobby NW Edge": ["true", "no rule (Doors.py:195)"],
  "Desert North Hall W Edge": ["true", "no rule (Doors.py:219)"],
  "Desert Palace Entrance (South)": [
    "true",
    "no rule (EntranceShuffle2.py:2808)",
  ],
  "Desert Palace Exit (West)": ["true", "no rule (EntranceShuffle2.py:3225)"],
  "Desert Pass EC": ["true", "no rule (OverworldShuffle.py:2289)"],
  "Desert Pass Ladder (South)": ["true", "Rules.py:1230"],
  "Desert Pass WC": ["true", "no rule (OWEdges.py:169)"],
  "Desert Pass WS": ["true", "no rule (OWEdges.py:170)"],
  "Desert Sandworm Corner S Edge": ["true", "no rule (Doors.py:225)"],
  "Desert Statue Move": ["bookOfMudora", "Rules.py:451"],
  "Desert Teleporter Drop": ["true", "no rule (OverworldShuffle.py:1643)"],
  "Desert West S": ["true", "no rule (Doors.py:235)"],
  "Desert West Wing WS": ["true", "no rule (Doors.py:234)"],
  "DM Broken Bridge (West)": ["hookshot & moonPearl", "Rules.py:423, :1274"],
  "DM Hammer Bridge (East)": ["hammer & moonPearl", "Rules.py:422, :1273"],
  "East Dark Death Mountain Drop": [
    "true",
    "no rule (OverworldShuffle.py:1683)",
  ],
  "East Dark Death Mountain EN": ["true", "no rule (OverworldShuffle.py:2369)"],
  "East Dark Death Mountain Teleporter": [
    "@drCanLiftHeavyRocks",
    "Rules.py:1178",
  ],
  "East Dark World Teleporter": [
    "hammer & @drCanLiftRocks & moonPearl",
    "Rules.py:1204",
  ],
  "East Death Mountain WN": ["true", "no rule (OWEdges.py:50)"],
  "EDM To Mimic Ledge Drop": ["true", "no rule (OverworldShuffle.py:1785)"],
  "EDM To Spiral Ledge Drop": ["true", "no rule (OverworldShuffle.py:1573)"],
  "Enter Desert (South)": ["true", "no rule (DoorShuffle.py:4704)"],
  "exit:Agahnims Tower": [
    "count(crystal) >= 7",
    "Rules.py:1164-1165 (Ganon's Tower's crystals when ATGT is swapped)",
  ],
  "exit:Desert Palace Entrance (North)": [
    "true",
    "no rule (EntranceShuffle2.py:2810)",
  ],
  "exit:Desert Palace Entrance (South)": [
    "true",
    "no rule (EntranceShuffle2.py:2808)",
  ],
  "exit:Eastern Palace": ["true", "no rule (EntranceShuffle2.py:2813)"],
  "exit:Ganons Tower": [
    "true",
    "no rule: Rules.py:538-540 put Ganon's Tower's on Agahnims Tower when ATGT is swapped",
  ],
  "exit:Hyrule Castle Entrance (South)": [
    "true",
    "no rule (EntranceShuffle2.py:486)",
  ],
  "exit:Misery Mire": ["@drHasSword & @hasMireMedallion", "Rules.py:533"],
  "exit:Palace of Darkness": [
    "darkPalaceOpened | darkPalaceOpened__maybe & maybe",
    "Rules.py:531 (Dark Palace Opened: Kiki Assistance's event, Regions.py:1423)",
  ],
  "exit:Tower of Hera": ["true", "no rule (EntranceShuffle2.py:2814)"],
  "exit:Turtle Rock": [
    "turtleOpened | turtleOpened__maybe & maybe",
    "Rules.py:534 (Turtle Opened: Turtle Medallion Pad's event)",
  ],
  "Floating Island Bridge (East)": [
    "true",
    "no rule (OverworldShuffle.py:1784)",
  ],
  "Flute Boy Bush (South)": ["moonPearl", "Rules.py:1323"],
  "Flute From Big Bomb Shop Area": ["true", "FluteShuffle.py:668-675"],
  "Flute Spot 1": ["@drCanFlute", "Rules.py:358"],
  "Flute Spot 2": ["@drCanFlute", "Rules.py:359"],
  "Flute Spot 5": ["@drCanFlute", "Rules.py:362"],
  "Flute Spot 6": ["@drCanFlute", "Rules.py:363"],
  "Flute Spot 8": ["@drCanFlute", "Rules.py:365"],
  "Forgotten Forest ES": ["true", "no rule (OverworldShuffle.py:2245)"],
  "Frog Rock (Outer)": ["@drCanLiftHeavyRocks", "Rules.py:493, :1381"],
  "Good Bee Cave Front to Back": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Graveyard Ladder (Bottom)": ["moonPearl", "Rules.py:1293"],
  "GT Approach": [
    "true",
    "no rule: Rules.py:1168 holds only while ATGT stands (:1164-1169)",
  ],
  "Hammer Bridge NC": ["true", "no rule (OWEdges.py:274)"],
  "Hammer Bridge Pegs (South)": ["hammer", "Rules.py:497, :1385"],
  "Hammer Bridge Water Drop": ["flippers", "Rules.py:498, :1386"],
  "Hammer Peg Cave": ["hammer", "Rules.py:527, :1264"],
  "Hookshot Cave Back Entrance": ["true", "no rule (EntranceShuffle2.py:2866)"],
  "Hookshot Cave Back to Middle": [
    "@drCanUseBombs",
    "Rules.py:995, :1004-1006",
  ],
  "Hookshot Cave Bonk Path": ["hookshot | pegasusBoots", "Rules.py:415"],
  "Hookshot Cave Hook Path": ["hookshot", "Rules.py:416"],
  "Hookshot Cave Middle to Front": [
    "@drCanUseBombs",
    "Rules.py:995, :1004-1006",
  ],
  "Hype Cave Water Entry": ["flippers", "Rules.py:1394, :1447, :1480"],
  "Hyrule Castle Courtyard Bush (South)": ["moonPearl", "Rules.py:1310"],
  "Hyrule Castle Main Gate (South)": [
    "true",
    "no rule: Rules.py:1193-1194 hold only while 0x1b stands",
  ],
  "Hyrule Castle Secret Entrance Drop": ["moonPearl", "Rules.py:1253"],
  "Ice Cave Water Drop": ["flippers & moonPearl", "Rules.py:463, :1336"],
  "Ice Lake Iceberg Bomb Jump": ["false", "Rules.py:507, :1400, :1490"],
  "Ice Lake Northeast Water Drop": ["flippers", "Rules.py:504, :1396"],
  "Ice Lake Southwest Water Drop": ["flippers", "Rules.py:505, :1397"],
  "Ice Lake Water Drop": ["flippers", "Rules.py:503, :1395"],
  "Ice Rod Cave": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Kakariko Pond SW | Kakariko Pond SE": [
    "true",
    "no rule (OverworldShuffle.py:2241), no rule (OverworldShuffle.py:2242)",
  ],
  "Kakariko Pond Whirlpool": ["flippers & moonPearl", "Rules.py:437, :1289"],
  "Kakariko Southwest Bush (North)": ["moonPearl", "Rules.py:1303"],
  "Kakariko Well (top to back)": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Kakariko Yard Bush (South)": ["moonPearl", "Rules.py:1306"],
  "Kiki Assistance": ["true", "no rule (OverworldShuffle.py:1722)"],
  "Kings Grave": ["@drHasBoots & moonPearl", "Rules.py:517, :1251"],
  "Kings Grave Rocks (Outer)": [
    "@drCanLiftHeavyRocks & moonPearl",
    "Rules.py:438, :1290",
  ],
  "Lake Hylia East Pier": ["true", "no rule (OverworldShuffle.py:1662)"],
  "Lake Hylia NE": ["true", "no rule (OWEdges.py:163)"],
  "Lake Hylia Northeast Water Drop": [
    "flippers & moonPearl",
    "Rules.py:459, :1332",
  ],
  "Lake Hylia South Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1331, :1439, :1472",
  ],
  "Lake Hylia Water Drop": ["flippers & moonPearl", "Rules.py:458, :1330"],
  "Lake Hylia WS": ["true", "no rule (OWEdges.py:164)"],
  "Light Hype Fairy": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Links House ES": ["true", "no rule: Rules.py:1766-1768 are Standard's"],
  "Links House NE": ["true", "no rule (OverworldShuffle.py:1558)"],
  "Links House S&Q": ["true", "no rule: Rules.py:1696 is Standard's"],
  "Lost Woods Hideout Drop": ["moonPearl", "Rules.py:1246"],
  "Lost Woods Pass Hammer (North)": [
    "hammer & moonPearl",
    "Rules.py:433, :1285",
  ],
  "Lost Woods Pass Hammer (South)": [
    "hammer & moonPearl",
    "Rules.py:434, :1286",
  ],
  "Lost Woods Pass Rock (North)": [
    "@drCanLiftHeavyRocks & moonPearl",
    "Rules.py:435, :1287",
  ],
  "Lost Woods Pass Rock (South)": [
    "@drCanLiftHeavyRocks & moonPearl",
    "Rules.py:436, :1288",
  ],
  "Lumberjack Tree Tree": [
    "@drHasBoots & @drHasBeatenAga & moonPearl",
    "Rules.py:514, :1247",
  ],
  "location Big Bomb": ["crystal5 & crystal6", "Rules.py:385"],
  "location Bombos Tablet": ["bookOfMudora & @drHasBeamSword", "Rules.py:379"],
  "location Bumper Cave Ledge": ["true", "no rule (Regions.py:165)"],
  "location Ether Tablet": ["bookOfMudora & @drHasBeamSword", "Rules.py:373"],
  "location Hookshot Cave - Bottom Left": ["true", "no rule (Regions.py:347)"],
  "location Hookshot Cave - Bottom Right": ["true", "no rule (Regions.py:346)"],
  "location Hookshot Cave - Top Left": ["true", "no rule (Regions.py:347)"],
  "location Hookshot Cave - Top Right": ["true", "no rule (Regions.py:347)"],
  "location Kiki": [
    "true",
    "no rule: add_bunny_rule, Rules.py:1242, in the dark world",
  ],
  "location Kiki Assistance": [
    "pickUpKiki | pickUpKiki__maybe & maybe",
    "Rules.py:380",
  ],
  "location Lost Old Man": ["lamp", "Rules.py:1539, :1559-1561 (dark room)"],
  "location Mimic Cave": [
    "hammer & moonPearl",
    "Rules.py:402, :69 (kill_chests :1677-1678), :2031-2036",
  ],
  "location Mire Shed - Left": ["true", "no rule (Regions.py:374)"],
  "location Mire Shed - Right": ["true", "no rule (Regions.py:374)"],
  "location Old Man": [
    "returnOldMan | returnOldMan__maybe & maybe",
    "Rules.py:374",
  ],
  "location Old Man Drop Off": [
    "escortOldMan | escortOldMan__maybe & maybe",
    "Rules.py:375",
  ],
  "location Paradox Cave Lower - Far Left": [
    "@drCanHitCrystalThroughBarrier & moonPearl & moonPearl",
    "Rules.py:1018-1021, :2031-2036",
  ],
  "location Paradox Cave Lower - Far Right": [
    "@drCanHitCrystalThroughBarrier & moonPearl & moonPearl",
    "Rules.py:1018-1021, :2031-2036",
  ],
  "location Paradox Cave Lower - Left": [
    "@drCanHitCrystalThroughBarrier & moonPearl & moonPearl",
    "Rules.py:1018-1021, :2031-2036",
  ],
  "location Paradox Cave Lower - Middle": [
    "@drCanHitCrystalThroughBarrier & moonPearl & moonPearl",
    "Rules.py:1018-1021, :2031-2036",
  ],
  "location Paradox Cave Lower - Right": [
    "@drCanHitCrystalThroughBarrier & moonPearl & moonPearl",
    "Rules.py:1018-1021, :2031-2036",
  ],
  "location Paradox Cave Upper - Left": ["moonPearl", "Rules.py:2031-2036"],
  "location Paradox Cave Upper - Right": ["moonPearl", "Rules.py:2031-2036"],
  "location Pyramid Crack": [
    "pickUpBigBomb | pickUpBigBomb__maybe & maybe",
    "Rules.py:523 (Pick Up Big Bomb: the Big Bomb's event, Regions.py:1424)",
  ],
  "location Pyramid Fairy - Left": ["true", "no rule (Regions.py:364)"],
  "location Pyramid Fairy - Right": ["true", "no rule (Regions.py:364)"],
  "location Spectacle Rock": ["true", "no rule (Regions.py:20)"],
  "location Spectacle Rock Cave": ["true", "no rule (Regions.py:264)"],
  "location Spiral Cave": ["moonPearl", "Rules.py:2031-2036"],
  "location Superbunny Cave - Bottom": ["true", "no rule (Regions.py:351)"],
  "location Superbunny Cave - Top": ["true", "no rule (Regions.py:351)"],
  "location Turtle Medallion Pad": [
    "@drHasSword & @hasTurtleRockMedallion",
    "Rules.py:376",
  ],
  "Mimic Cave": ["true", "no rule (EntranceShuffle2.py:2879)"],
  "Mini Moldorm Cave": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Mire Shed": ["true", "no rule (EntranceShuffle2.py:3204)"],
  "Mire Teleporter": ["@drCanLiftHeavyRocks", "Rules.py:1210"],
  "Mire Teleporter Ledge Drop": ["true", "no rule (OverworldShuffle.py:1736)"],
  "Mirror From Death Mountain Floating Island": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Desert Area": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mirror From Desert Checkerboard Ledge": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Desert Ledge": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mirror From Desert Ledge Keep": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Desert Stairs": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mirror From East Death Mountain (Bottom Left)": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Eastern Nook Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Eastern Palace Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Hyrule Castle Courtyard": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Hyrule Castle Courtyard Northeast": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Hyrule Castle East Entry": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Hyrule Castle Ledge": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Ice Cave Area": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mirror From Kakariko Bush Yard": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Lake Hylia Northeast Bank": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Mountain Pass Ledge": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Octoballoon Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Potion Shop Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Potion Shop Northeast": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From River Bend East Bank": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Sand Dunes Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Stone Bridge North Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Tree Line Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From West Death Mountain (Bottom)": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Wooden Bridge Northeast": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Zora Approach Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Zora Approach Ledge": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror From Zora Waterfall Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror To Broken Bridge Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror To Frog Prison": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mirror To Hammer Pegs Area": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror To Ice Lake Southeast Ledge": [
    "magicMirror",
    "OverworldShuffle.py:1196-1205",
  ],
  "Mirror To Pyramid Area": ["magicMirror", "OverworldShuffle.py:1196-1205"],
  "Mountain Pass Ledge Drop": ["true", "no rule (OverworldShuffle.py:1587)"],
  "Mountain Pass Rock (Outer)": [
    "@drCanLiftRocks & moonPearl",
    "Rules.py:428, :1280",
  ],
  "Mountain Pass SE": ["true", "no rule (OverworldShuffle.py:2234)"],
  "Octoballoon Pier": ["true", "no rule (OverworldShuffle.py:1673)"],
  "Octoballoon Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1339, :1440, :1473",
  ],
  "Octoballoon WC": ["moonPearl", "Rules.py:1417-1423 (ow_terrain_rules)"],
  "Octoballoon WS": ["true", "no rule (OWEdges.py:183)"],
  "Old Man Cave (East)": ["true", "no rule (EntranceShuffle2.py:2854)"],
  "Old Man Cave Exit (East)": ["lamp", "Rules.py:1538, :1557-1558 (dark room)"],
  "Old Man Cave W": ["lamp", "Rules.py:1538, :1557-1558 (dark room)"],
  "Old Man Drop Off": ["true", "no rule (OverworldShuffle.py:1570)"],
  "Old Man House Exit (Bottom)": ["true", "no rule (EntranceShuffle2.py:3084)"],
  "Old Man S&Q": [
    "returnOldMan | returnOldMan__maybe & maybe",
    "Rules.py:354 (Return Old Man: Old Man Drop Off's event, Regions.py:1420); :1698 is Standard's",
  ],
  "Other World S&Q": ["magicMirror & @drHasBeatenAga", "Rules.py:355"],
  "Outcast Pond NE": ["true", "no rule (OWEdges.py:207)"],
  "Palace of Darkness Nook NE": ["true", "no rule (OWEdges.py:284)"],
  "Paradox Cave (Middle)": ["true", "no rule (EntranceShuffle2.py:2874)"],
  "Paradox Cave Chest Area NE": [
    "@drCanUseBombs & moonPearl",
    "Rules.py:994-1000, :1004-1006 (bomb_rules)",
  ],
  "Paradox Cave Climb": ["true", "no rule (EntranceShuffle2.py:3030)"],
  "Paradox Cave Drop": ["true", "no rule (EntranceShuffle2.py:3032)"],
  "Paradox Cave Exit (Top)": ["true", "no rule (EntranceShuffle2.py:3098)"],
  "Peg Area Rocks (West)": ["@drCanLiftHeavyRocks", "Rules.py:489, :1377"],
  "Post Aga Teleporter": ["@drHasBeatenAga", "Rules.py:1199"],
  "Potion Shop Northeast Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1297, :1435, :1468",
  ],
  "Potion Shop Rock (South)": [
    "@drCanLiftRocks & moonPearl",
    "Rules.py:442, :1299",
  ],
  "Potion Shop Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1296, :1434, :1467",
  ],
  "Pyramid Crack": [
    "detonateBigBomb | detonateBigBomb__maybe & maybe",
    "Rules.py:524 (Detonate Big Bomb: the Pyramid Crack location's event, Regions.py:1425)",
  ],
  "Pyramid Fairy": ["true", "no rule (EntranceShuffle2.py:2894)"],
  "Pyramid Hole": [
    "defeatAgahnim2",
    "Rules.py:525-526 (moved to Hyrule Castle Ledge, EntranceShuffle2.py:2052-2055)",
  ],
  "Qirn Jump East Water Drop": ["flippers", "Rules.py:1361, :1442, :1475"],
  "Qirn Jump Water Drop": ["flippers", "Rules.py:476, :1360, :1474"],
  "River Bend East Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1295, :1433, :1466",
  ],
  "River Bend Water Drop": [
    "flippers & moonPearl",
    "Rules.py:440, :1294, :1465",
  ],
  "Sanctuary Grave": ["@drCanLiftRocks & moonPearl", "Rules.py:516, :1250"],
  "Sanctuary S&Q": ["true", "no rule: Rules.py:1697 is Standard's"],
  "South Pass WC": ["true", "no rule (OWEdges.py:178)"],
  "Spectacle Rock Approach": ["moonPearl", "Rules.py:1171-1172"],
  "Spectacle Rock Cave": ["true", "no rule (EntranceShuffle2.py:2872)"],
  "Spiral Cave": ["true", "no rule (EntranceShuffle2.py:2861)"],
  "Statues NC": ["true", "no rule (OWEdges.py:156)"],
  "Statues Water Entry": [
    "flippers & moonPearl",
    "Rules.py:1329, :1438, :1471",
  ],
  "Stone Bridge (Northbound)": ["true", "no rule (OverworldShuffle.py:1636)"],
  "Stone Bridge EN": ["true", "no rule (OverworldShuffle.py:2282)"],
  "Superbunny Cave (Top)": ["true", "no rule (EntranceShuffle2.py:2867)"],
  "Tree Line NW": ["true", "no rule (OWEdges.py:139)"],
  "Turtle Rock Tail Ledge Drop": ["true", "Rules.py:1186"],
  "Two Brothers House Exit (West)": [
    "(@drCanUseBombs | @drHasBoots) & moonPearl & moonPearl",
    "Rules.py:993, :1001-1003, :1995-2000",
  ],
  "West Dark Death Mountain Drop": [
    "true",
    "no rule (OverworldShuffle.py:1679)",
  ],
  "West Dark Death Mountain EN": ["true", "no rule (OverworldShuffle.py:2367)"],
  "West Dark World Teleporter": ["@drCanLiftRocks", "Rules.py:1191"],
  "West Death Mountain ES": ["true", "no rule (OverworldShuffle.py:2299)"],
  "Wooden Bridge Bush (South)": ["moonPearl", "Rules.py:1314"],
  "Wooden Bridge Northeast Water Drop": [
    "flippers & moonPearl",
    "Rules.py:448, :1316",
  ],
  "Wooden Bridge Water Drop": ["flippers & moonPearl", "Rules.py:447, :1315"],
  "Zora Approach Water Drop": [
    "flippers & moonPearl",
    "Rules.py:1300, :1436, :1469",
  ],
  "Zora Waterfall Water Entry": ["flippers & moonPearl", "Rules.py:431, :1283"],
};
