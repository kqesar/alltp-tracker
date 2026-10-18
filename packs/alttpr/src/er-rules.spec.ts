import { compileWorld, loadRules, type World } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { importErRules, regionId } from "../scripts/er-rules.mjs";
import { importErTests } from "../scripts/er-tests.mjs";
import { functionBody, pythonExpression } from "../scripts/python.mjs";
import er from "./entrances/er.json" with { type: "json" };
import rules from "./entrances/rules.json" with { type: "json" };
import { STATE_NAMES } from "./pack";
import { RULES } from "./rules";
import { OPEN, STANDARD } from "./settings";

describe("the Python reader", () => {
  it("reads an expression at Python's precedence", () => {
    expect(pythonExpression("a or b and not c")).toEqual({
      args: [
        { name: "a", t: "name" },
        {
          args: [
            { name: "b", t: "name" },
            { of: { name: "c", t: "name" }, t: "not" },
          ],
          t: "and",
        },
      ],
      t: "or",
    });
    expect(pythonExpression("x if y else z")).toMatchObject({
      t: "ifelse",
      test: { name: "y" },
    });
    expect(pythonExpression("lambda state: f(1, k='v')[0].a")).toEqual({
      body: {
        name: "a",
        of: {
          at: { t: "const", value: 0 },
          of: {
            args: [{ t: "const", value: 1 }],
            fn: { name: "f", t: "name" },
            keywords: { k: { t: "const", value: "v" } },
            t: "call",
          },
          t: "index",
        },
        t: "attr",
      },
      params: ["state"],
      t: "lambda",
    });
    expect(pythonExpression("a not in [1, 2]")).toMatchObject({
      op: "not in",
      t: "compare",
    });
    expect(() => pythonExpression("a b")).toThrow(/<text>:1: unexpected b/);
    expect(() => pythonExpression("f(")).toThrow(/end of file/);
  });

  it("reads a function's body as blocks, a line going on in brackets", () => {
    const source = [
      "x = 1",
      "def f(world, player=1):",
      "    if a:  # a comment",
      "        g(b,",
      "          c)",
      "    else:",
      "        h('#', \\",
      "          d)",
      "y = 2",
    ].join("\n");
    const { body, line, params } = functionBody(source, "f", "f.py");
    expect({ line, params }).toEqual({ line: 2, params: ["world", "player"] });
    expect(
      body.map(({ body, line, text }) => ({
        body: body.map((s) => [s.line, s.text]),
        line,
        text,
      })),
    ).toEqual([
      { body: [[4, "g(b,           c)"]], line: 3, text: "if a" },
      { body: [[7, "h('#',            d)"]], line: 6, text: "else" },
    ]);
  });
});

/** A checkout of the entrance randomizer, cut to what each test reads. */
const CHECKOUT: Readonly<Record<string, string>> = {
  "BaseClasses.py": [
    "class World(object):",
    "    def __init__(self, mode):",
    "        self.sewer_light_cone = mode == 'standard'",
    "        self.light_world_light_cone = False",
    "        self.dark_world_light_cone = False",
    "",
    "class CollectionState(object):",
    "    def can_extend_magic(self, player, smallmagic=16, fullrefill=False):",
    "        return True",
    "",
    "    def has_sword(self, player):",
    "        return True",
    "",
    "    def has_blunt_weapon(self, player):",
    "        return True",
    "",
    "    def has_Boots(self, player):",
    "        return True",
  ].join("\n"),
  "Bosses.py": [
    "def MoldormDefeatRule(state, player):",
    "    return state.has_blunt_weapon(player)",
    "",
    "def ArrghusDefeatRule(state, player):",
    "    if not state.has('Hookshot', player):",
    "        return False",
    "    if state.has('Hammer', player):",
    "        return True",
    "    return state.has('Fire Rod', player) and state.can_extend_magic(player, 12)",
    "",
    "boss_table = {",
    "    'Moldorm': ('Moldorm', MoldormDefeatRule),",
    "    'Arrghus': ('Arrghus', ArrghusDefeatRule),",
    "}",
  ].join("\n"),
  "Dungeons.py": [
    "def create_dungeons(world, player):",
    "    def make_dungeon(name, default_boss, dungeon_regions, big_key):",
    "        return name",
    "",
    "    TH = make_dungeon('Tower of Hera', 'Moldorm', ['Tower of Hera (Top)'], None)",
    "    SP = make_dungeon('Swamp Palace', 'Arrghus', ['Swamp Palace (North)'], None)",
    "    if world.mode == 'inverted':",
    "        GT = make_dungeon('Inverted Ganons Tower', 'Agahnim2', ['Ganons Tower (Top)'], None)",
    "    GT.bosses['top'] = BossFactory('Moldorm', player)",
  ].join("\n"),
  "ItemList.py": [
    "def generate_itempool(world, player):",
    "    world.push_item(world.get_location('Floodgate', player), ItemFactory('Open Floodgate', player), False)",
    "    world.push_item(world.get_location('Agahnim 1', player), ItemFactory('Beat Agahnim 1', player), False)",
    "    world.push_item(world.get_location('Ganon', player), ItemFactory('Triforce', player), False)",
  ].join("\n"),
  "Items.py":
    "item_table = {'Hookshot': (True,), 'Hammer': (True,), 'Fire Rod': (True,), 'Open Floodgate': (True,), 'Small Key (Swamp Palace)': (True,)}",
  "Regions.py": [
    "_basic_shop_defaults = [('Red Potion', 150)]",
    "default_shop_contents = {",
    "    'Kakariko Shop': _basic_shop_defaults,",
    "    'Potion Shop': [('Green Potion', 60)],",
    "}",
  ].join("\n"),
  "Rules.py": [
    "def set_rules(world, player):",
    "    if world.logic == 'nologic':",
    "        return",
    "    global_rules(world, player)",
    "    if world.mode == 'open':",
    "        open_rules(world, player)",
    "    elif world.mode == 'standard':",
    "        pass",
    "    else:",
    "        raise NotImplementedError('Not implemented yet')",
    "    set_bunny_rules(world, player)",
    "    set_big_bomb_rules(world, player)",
    "    set_trock_key_rules(world, player)",
    "    if not world.swamp_patch_required[player]:",
    "        add_rule(world.get_entrance('Swamp Palace Moat', player), lambda state: state.has('Hammer', player))",
    "",
    "def global_rules(world, player):",
    "    world.get_region('Links House', player).can_reach_private = lambda state: True",
    "    set_rule(world.get_entrance('Kings Grave', player), lambda state: state.has_Boots(player))",
    "    add_rule(world.get_entrance('Kings Grave', player), lambda state: state.has('Hammer', player) or \\",
    "             state.has('Mirror', player))",
    "    set_rule(world.get_location('Tower of Hera - Boss', player), lambda state: world.get_location('Tower of Hera - Boss', player).parent_region.dungeon.boss.can_defeat(state))",
    "    set_defeat_dungeon_boss_rule(world.get_location('Swamp Palace - Boss', player))",
    "    set_rule(world.get_location('Swamp Palace - Big Chest', player), lambda state: state.has_key('Small Key (Swamp Palace)', player, 2) or item_name(state, 'Swamp Palace - Big Chest', player) == ('Small Key (Swamp Palace)', player))",
    "    chests = ['Swamp Palace - Big Chest', 'Tower of Hera - Boss']",
    "    for location in chests:",
    "        forbid_item(world.get_location(location, player), 'Hammer', player)",
    "    if world.swords == 'swordless':",
    "        set_rule(world.get_entrance('Kings Grave', player), lambda state: state.has('Fire Rod', player))",
    "    set_rule(world.get_location('Sunken Treasure', player), lambda state: state.has('Open Floodgate', player) and state.can_reach('Dam', 'Region', player))",
    "    set_rule(world.get_entrance('Ganon Drop', player), lambda state: not state.has('Hammer', player))",
    "    set_rule(world.get_location('Ganon', player), lambda state: state.has_crystals(world.crystals_needed_for_ganon, player) and (False if world.goal == 'ganonhunt' and not state.has('Triforce Piece', player) else True))",
    "    set_rule(world.get_location('Potion Shop', player), lambda state: state.world.get_region('Dam', 1).can_reach(state))",
    "",
    "def open_rules(world, player):",
    "    add_rule(world.get_entrance('Kings Grave', player), lambda state: state.can_reach('Potion Shop', 'Location', player))",
    "",
    "def set_big_bomb_rules(world, player):",
    "    bombshop_entrance = world.get_region('Big Bomb Shop', player).entrances[0]",
    "    Normal_LW_entrances = ['Kakariko Shop']",
    "    set_rule(world.get_entrance('Pyramid Fairy', player), lambda state: state.can_reach('Dam', 'Region', player))",
    "    def cross_peg_bridge(state):",
    "        return state.has('Hammer', player)",
    "    if bombshop_entrance.name in Normal_LW_entrances:",
    "        add_rule(world.get_entrance('Pyramid Fairy', player), lambda state: cross_peg_bridge(state) or state.can_reach('Top of Pyramid', 'Entrance', player))",
    "    elif bombshop_entrance.name == 'Kings Grave':",
    "        add_rule(world.get_entrance('Pyramid Fairy', player), lambda state: state.has('Fire Rod', player))",
    "",
    "def set_trock_key_rules(world, player):",
    "    set_rule(world.get_entrance('Top of Pyramid', player), lambda state: False)",
    "    all_state = world.get_all_state(True)",
    "    can_reach_back = all_state.can_reach(world.get_region('Dam', player)) if world.can_access_trock_eyebridge is None else world.can_access_trock_eyebridge",
    "    world.can_access_trock_eyebridge = can_reach_back",
    "    set_rule(world.get_entrance('Top of Pyramid', player), lambda state: state.has('Hammer', player))",
    "    def keys_needed(state):",
    "        item = item_name(state, 'Swamp Palace - Big Chest', player)",
    "        if item in [('Small Key (Swamp Palace)', player)]:",
    "            return 0",
    "        return 2",
    "    non_big_key_locations = ['Swamp Palace - Boss']",
    "    if can_reach_back:",
    "        set_rule(world.get_location('Swamp Palace - Boss', player), lambda state: state.has_key('Small Key (Swamp Palace)', player, keys_needed(state)))",
    "        non_big_key_locations += ['Swamp Palace - Big Chest']",
    "    for location in non_big_key_locations:",
    "        forbid_item(world.get_location(location, player), 'Hammer', player)",
    "",
    "def set_bunny_rules(world, player):",
    "    bunny_impassable_caves = ['Dam']",
    "    bunny_accessible_locations = ['Potion Shop']",
  ].join("\n"),
};

const REGIONS = [
  {
    exits: [
      "Kings Grave",
      "Ganon Drop",
      "Pyramid Fairy",
      "Top of Pyramid",
      "Swamp Palace Moat",
    ],
    locations: ["Sunken Treasure", "Potion Shop", "Ganon"],
    name: "Light World",
  },
  { exits: [], locations: [], name: "Dam" },
  {
    exits: [],
    locations: ["Tower of Hera - Boss"],
    name: "Tower of Hera (Top)",
  },
  {
    exits: [],
    locations: ["Swamp Palace - Boss", "Swamp Palace - Big Chest"],
    name: "Swamp Palace (North)",
  },
];

/** The translation of CHECKOUT. */
const translate = () =>
  importErRules((file: string) => {
    const source = CHECKOUT[file];
    if (source === undefined) throw new Error(`no ${file}`);
    return source;
  }, REGIONS);

describe("the translation of the entrance randomizer's rules", () => {
  it("folds each spot's rules in order, a branch on a setting into setting()", () => {
    const { entrances, locations } = translate();
    // Boots, and the hammer ('Mirror' is no item: never held); the fire rod
    // when swordless; Open adds the Potion Shop reached
    expect(entrances["Kings Grave"]).toEqual({
      req: "(setting(swordless) & fireRod | !setting(swordless) & @erHasBoots & hammer) & (setting(standardMode) | @erAtPotionShop)",
      source: ["Rules.py:19", "Rules.py:20", "Rules.py:29", "Rules.py:36"],
    });
    expect(locations["Sunken Treasure"]?.req).toBe(
      "openFloodgate & reach(dam)",
    );
    // The triforce hunt is no goal of the pack: that branch falls away
    expect(locations.Ganon?.req).toBe(
      "count(crystal) >= setting(crystalsGanon)",
    );
    expect(locations["Potion Shop"]?.req).toBe("reach(dam)");
  });

  it("reads a placement as maybe, a boss through its dungeon", () => {
    const { helpers, locations } = translate();
    expect(locations["Swamp Palace - Big Chest"]?.req).toBe(
      "keyD2 >= 2 | maybe",
    );
    expect(locations["Tower of Hera - Boss"]?.req).toBe("@erDefeatMoldorm");
    // (set_trock_key_rules sets it again, where everything held reaches
    // the Dam)
    expect(locations["Swamp Palace - Boss"]?.req).toMatch(
      / \| !setting\(allItemsReach_dam\) & @erDefeatArrghus$/,
    );
    // if not x: return False is x & …; if y: return True is y | …
    expect(helpers.erDefeatArrghus).toEqual({
      req: "hookshot & (hammer | fireRod & @erCanExtendMagic12)",
      source: "Bosses.py:4",
    });
    expect(helpers.erDefeatMoldorm?.req).toBe("@erHasBluntWeapon");
    expect(helpers.erHasBluntWeapon).toEqual({
      req: "@erHasSword | hammer",
      source: "BaseClasses.py:14",
    });
    // The potion shop, bottles by the item functionality
    expect(helpers.erCanExtendMagic12?.req).toBe(
      "setting(halfBottleMagic) & (reach(potionShop) & bottle | magic) | !setting(halfBottleMagic) & setting(quarterBottleMagic) & (reach(potionShop) & bottle >= 2 | magic) | !setting(halfBottleMagic) & !setting(quarterBottleMagic) & (reach(potionShop) & bottle | magic)",
    );
    // A location reached: its region, and its rule
    expect(helpers.erAtPotionShop?.req).toBe("reach(lightWorld) & reach(dam)");
  });

  it("lists what it cannot say, and what only places items", () => {
    const { events, fill, unported } = translate();
    expect(unported).toEqual([
      {
        code: "world.get_region('Links House', player).can_reach_private = lambda state: True",
        line: 18,
        why: "a save-and-quit point: what reaches a region",
      },
      {
        code: "set_rule(world.get_entrance('Ganon Drop', player), lambda state: not state.has('Hammer', player))",
        line: 31,
        why: "negates hammer, an item",
      },
      {
        code: "set_bunny_rules(world, player)",
        line: 11,
        why: "the bunny's paths, by which regions the entrances make dark",
      },
    ]);
    expect(fill).toEqual([27, 65]);
    // Only the events a rule reads; Agahnim is the pack's own item
    expect(events).toEqual({
      openFloodgate: {
        item: "Open Floodgate",
        location: "Floodgate",
        source: "ItemList.py:2",
      },
    });
  });

  it("reads what hangs on the entrances as cases and derived settings", () => {
    const {
      allItemsReach,
      bombShop,
      bunny,
      derived,
      entrances,
      helpers,
      locations,
    } = translate();
    // One case per list of doors the Big Bomb Shop may be entered by
    expect(bombShop).toEqual({
      cases: [
        {
          doors: ["Kakariko Shop"],
          req: "hammer | @erThroughTopOfPyramid",
          source: "Rules.py:45",
        },
        { doors: ["Kings Grave"], req: "fireRod", source: "Rules.py:47" },
      ],
      spot: "Pyramid Fairy",
    });
    expect(entrances["Pyramid Fairy"]?.req).toBe("reach(dam)");
    // An entrance reached: its region, and its rule as it ends
    expect(helpers.erThroughTopOfPyramid).toEqual({
      req: "reach(lightWorld) & hammer",
      source: "Rules.py:54",
    });
    // Turtle Rock's: what everything held reaches, a setting, read with
    // the entrances' rules as they were then
    expect(derived).toEqual({
      allItemsReach_dam: {
        kind: "allItemsReach",
        region: "Dam",
        source: "Rules.py:52",
      },
      swampPatch: { kind: "swampPatch", source: "EntranceShuffle.py" },
    });
    expect(allItemsReach).toEqual({
      "Swamp Palace Moat": "true",
      "Top of Pyramid": "false",
    });
    // A count by what a location holds: 0 with the key in it, else 2
    expect(locations["Swamp Palace - Boss"]?.req).toBe(
      "setting(allItemsReach_dam) & (maybe | keyD2 >= 2) | !setting(allItemsReach_dam) & @erDefeatArrghus",
    );
    expect(entrances["Swamp Palace Moat"]?.req).toBe(
      "setting(swampPatch) | hammer",
    );
    expect(bunny).toEqual({
      accessibleLocations: { line: 69, value: ["Potion Shop"] },
      impassableCaves: { line: 68, value: ["Dam"] },
    });
  });

  it("gives the same output for the same source", () => {
    expect(translate()).toEqual(translate());
  });

  it("names regions in lowerCamel case", () => {
    expect(regionId("Ganons Tower (Tile Room)")).toBe("ganonsTowerTileRoom");
    expect(regionId("Agahnim 1")).toBe("agahnim1");
  });
});

describe("the entrance randomizer's rules (rules.json)", () => {
  it("come from the commit er.json does", () => {
    expect(rules.upstream).toEqual(er.upstream);
  });

  it("each name a spot of the randomizer's regions and cite their lines", () => {
    const exits = new Set(er.regions.flatMap((r) => r.exits));
    const located = new Set(er.regions.flatMap((r) => r.locations));
    for (const [name, rule] of Object.entries(rules.entrances)) {
      expect(exits.has(name), name).toBe(true);
      expect(rule.source.length, name).toBeGreaterThan(0);
    }
    for (const [name, rule] of Object.entries(rules.locations)) {
      expect(located.has(name), name).toBe(true);
      expect(rule.source.length, name).toBeGreaterThan(0);
    }
  });

  it("compile in the engine, with the pack's items, helpers and settings", () => {
    // Every rule as a location of its region, where reach() may stand: the
    // world built from the noted entrances turns an entrance's into exits
    const world: World = {
      regions: [
        { exits: er.regions.map((r) => ({ to: r.id })), id: "start" },
        ...er.regions.map((r) => ({
          id: r.id,
          locations: [
            ...r.locations.flatMap((name) => {
              const rule =
                rules.locations[name as keyof typeof rules.locations];
              return rule === undefined
                ? []
                : [{ id: `location:${name}`, req: rule.req }];
            }),
            ...r.exits.flatMap((name) => {
              const rule =
                rules.entrances[name as keyof typeof rules.entrances];
              return rule === undefined
                ? []
                : [{ id: `entrance:${name}`, req: rule.req }];
            }),
          ],
        })),
      ],
      start: "start",
    };
    const helpers = loadRules({
      groups: RULES.groups,
      helpers: {
        ...RULES.helpers,
        ...Object.fromEntries(
          Object.entries(rules.helpers).map(([name, { req }]) => [name, req]),
        ),
      },
    });
    // What hangs on the entrances, the world built from them gives
    const lightWorld = Object.fromEntries(
      Object.keys(rules.derived).map((name) => [name, false]),
    );
    for (const settings of [OPEN, STANDARD]) {
      const compiled = compileWorld(world, helpers, {
        items: [...STATE_NAMES, ...Object.keys(rules.events)],
        settings: { ...settings, ...lightWorld },
      });
      expect(compiled.locationIds).toHaveLength(
        Object.keys(rules.entrances).length +
          Object.keys(rules.locations).length,
      );
    }
  });

  it("stand as written, hearts and bombs included", () => {
    // A seed's fill never counts them, the randomizer's tests do
    // (TestMiseryMire.py:72: the Spike Chest with a heart container)
    expect(rules.helpers.erHasHearts4.req).toBe(
      "heartContainer | pieceOfHeart >= 4",
    );
    expect(rules.locations["Misery Mire - Spike Chest"].req).toBe(
      "!setting(cantTakeDamage) & @erHasHearts4 | caneOfByrna | cape",
    );
    expect(rules.helpers.erCanKillMostThings.req).toMatch(/\| tenBombs$/);
  });

  it("leave out only what is code, each with its line", () => {
    expect(rules.unported.map(({ line, why }) => [line, why])).toEqual([
      [117, "a save-and-quit point: what reaches a region"],
      [118, "a save-and-quit point: what reaches a region"],
      [119, "a save-and-quit point: what reaches a region"],
      [122, "a save-and-quit point: what reaches a region"],
      [123, "a save-and-quit point: what reaches a region"],
      [126, "a save-and-quit point: what reaches a region"],
      [127, "a save-and-quit point: what reaches a region"],
      [60, "the bunny's paths, by which regions the entrances make dark"],
    ]);
  });
});

describe("the import of the randomizer's own tests", () => {
  /** A checkout holding two test files and the base class one inherits. */
  const files: Readonly<Record<string, string>> = {
    "test/dungeons/TestDungeon.py": [
      "class TestDungeon(unittest.TestCase):",
      "    def setUp(self):",
      "        for exitname, regionname in mandatory_connections:",
      "            connect_simple(self.world, exitname, regionname, 1)",
      "        connect_simple(self.world, self.world.get_entrance('Big Bomb Shop', 1), self.world.get_region('Big Bomb Shop', 1), 1)",
      "        self.world.swamp_patch_required[1] = True",
      "        generate_itempool(self.world, 1)",
    ].join("\n"),
    "test/TestDeathMountain.py": [
      "class TestDeathMountain(TestVanilla):",
      "    def setUp(self):",
      "        create_regions(self.world, 1)",
      "        link_entrances(self.world, 1)",
      "        set_rules(self.world, 1)",
      "",
      "    def testWest(self):",
      "        self.run_tests([",
      "            ['Old Man', True, ['Ocarina', 'Lamp']],  # a comment",
      "        ])",
    ].join("\n"),
  };
  const read = (file: string) => {
    const source =
      files[file] ??
      (file.startsWith("test/dungeons/Test")
        ? [
            "class TestOne(TestDungeon):",
            "    def testOne(self):",
            "        self.starting_regions = ['Eastern Palace']",
            "        key = 'Small Key (Desert Palace)'",
            "        self.run_tests([",
            "            ['Eastern Palace - Boss', False, [key] * 2, ['Lamp']],",
            "            ['Eastern Palace - Boss', True, ['Lamp'] + [key]],",
            "        ])",
          ].join("\n")
        : undefined);
    if (source === undefined) throw new Error(`no ${file}`);
    return source;
  };

  it("reads each test's cases and the harness its setUp builds", () => {
    const fixtures = importErTests(read);
    expect(fixtures).toHaveLength(12);
    const dungeon = fixtures[0];
    expect(dungeon?.harness).toEqual({
      bombShop: "Big Bomb Shop",
      connections: "mandatory",
      marked: false,
      pool: true,
      source: "test/dungeons/TestDungeon.py:2",
      swampPatch: true,
    });
    // A name the method binds, a list repeated or joined
    expect(dungeon?.tests).toEqual([
      {
        cases: [
          [
            "Eastern Palace - Boss",
            false,
            ["Small Key (Desert Palace)", "Small Key (Desert Palace)"],
            ["Lamp"],
          ],
          [
            "Eastern Palace - Boss",
            true,
            ["Lamp", "Small Key (Desert Palace)"],
          ],
        ],
        line: 2,
        name: "testOne",
        startingRegions: ["Eastern Palace"],
      },
    ]);
    expect(fixtures.at(-1)).toMatchObject({
      harness: { connections: "vanilla", marked: false, pool: false },
      tests: [{ cases: [["Old Man", true, ["Ocarina", "Lamp"]]] }],
    });
  });
});
