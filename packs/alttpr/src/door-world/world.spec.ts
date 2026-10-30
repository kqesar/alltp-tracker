import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import ruleData from "../door-rando/world/rules.json" with { type: "json" };
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { OPEN, settingsFromUpstream } from "../settings";
import { addBunnyRules } from "./bunny";
import {
  dynamicExits,
  isStaticExit,
  REMOVED_EXITS,
  vanillaConnections,
} from "./connections";
import { DR_DATA } from "./data";
import {
  DR_DEFAULTS,
  drKeyLogic,
  drLocationId,
  drWorld,
  markWorlds,
  regionProbeId,
} from "./index";
import { worldKeys } from "./keys";
import { zeldaPath } from "./standard";

const settings = (mode: "open" | "standard" | "inverted"): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
});

describe("the Door Randomizer's world (door-world)", () => {
  it("links every exit to a region of DR's, as DR's vanilla world does", () => {
    for (const mode of ["open", "standard", "inverted"] as const) {
      const connections = vanillaConnections(DR_DATA, mode);
      for (const [exit, to] of connections) {
        expect(isStaticExit(DR_DATA, exit), exit).toBe(true);
        expect(DR_DATA.regionByName.has(to), to).toBe(true);
      }
      // Unlinked: a one-way door's far side, an exit only the other
      // worlds' mandatory tables link, the inverted sanctuary's way out
      // (a single entrance, EntranceShuffle2.py single_entrance_map) and
      // the removed mirror route
      const other = new Set(
        [
          ...DR_DATA.pairsOf(
            "OverworldShuffle.py",
            mode === "inverted"
              ? "open_mandatory_connections"
              : "inverted_mandatory_connections",
          ),
          ...DR_DATA.pairsOf("EntranceShuffle2", "drop_map"),
          ...DR_DATA.pairsOf("EntranceShuffle2", "entrance_map"),
        ].map(([exit]) => exit),
      );
      const farSides = new Set(
        DR_DATA.pairsOf("DoorShuffle.py", "default_one_way_connections").map(
          ([, to]) => to,
        ),
      );
      const unlinked = DR_DATA.regions
        .flatMap((r) => r.exits)
        .filter(
          (exit) =>
            !connections.has(exit) && !farSides.has(exit) && !other.has(exit),
        );
      expect(unlinked, mode).toEqual([
        "Dark Sanctuary Hint Exit",
        "Sanctuary Mirror Route",
      ]);
      for (const exit of REMOVED_EXITS)
        expect(connections.has(exit)).toBe(false);
    }
  });

  it("lets the Inverted save point out from 1.5.7 on, never for an older seed", () => {
    // do_vanilla_connections links the Dark Sanctuary's exit to the place
    // of its entrance since 1.5.7 (3c4307e; EntranceShuffle2.py:171-176 at
    // 1.5.8); a 1.5.6 seed's logic, or one of no version known, never did
    const exit = "Dark Sanctuary Hint Exit";
    expect(vanillaConnections(DR_DATA, "inverted").has(exit)).toBe(false);
    expect(vanillaConnections(DR_DATA, "inverted", 156).has(exit)).toBe(false);
    expect(vanillaConnections(DR_DATA, "inverted", 157).get(exit)).toBe(
      "Dark Chapel Area",
    );
    expect(vanillaConnections(DR_DATA, "open", 158).has(exit)).toBe(false);
    // The brewery from the start: through that way out alone
    // (TestInvertedDarkWorld.py:6)
    const brewery = drLocationId("Brewery");
    const at = (drVersion: number) =>
      solveFacts(drWorld({ ...settings("inverted"), drVersion }), {
        heartContainer: 3,
      }).location(brewery);
    expect([at(156), at(157), at(158)]).toEqual(["no", "yes", "yes"]);
  });

  it("swaps the Inverted world's entrances (EntranceShuffle2.py:64-78)", () => {
    const open = vanillaConnections(DR_DATA, "open");
    const inverted = vanillaConnections(DR_DATA, "inverted");
    expect(open.get("Ganons Tower")).toBe("Ganons Tower Portal");
    expect(inverted.get("Ganons Tower")).toBe("Agahnims Tower Portal");
    expect(inverted.get("Agahnims Tower")).toBe("Ganons Tower Portal");
    expect(inverted.get("Links House")).toBe("Big Bomb Shop");
    expect(open.get("Pyramid Hole")).toBe("Pyramid");
    expect(inverted.has("Pyramid Hole")).toBe(false);
    expect(inverted.get("Inverted Pyramid Hole")).toBe("Pyramid");
    expect(open.get("Chris Houlihan Room Exit")).toBe(
      open.get("Links House Exit"),
    );
  });

  it("makes the flute and mirror exits DR makes in code, of new names", () => {
    for (const mode of ["open", "inverted"] as const) {
      const exits = dynamicExits(DR_DATA, mode);
      const names = exits.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names)
        expect(isStaticExit(DR_DATA, name), name).toBe(false);
      const own = mode === "open" ? "lw" : "dw";
      for (const exit of exits)
        expect(DR_DATA.regionByName.get(exit.from)?.type).toBe(
          exit.to === "Flute Sky" ? own : own === "lw" ? "dw" : "lw",
        );
    }
    expect(
      dynamicExits(DR_DATA, "open").find(
        (e) => e.name === "Flute From Zoras Domain",
      ),
    ).toBeUndefined();
  });

  it("marks the worlds through the exits, never across", () => {
    const world = drWorld(settings("open"));
    expect(world.locationIds.size).toBeGreaterThan(200);
    const marked = markWorlds(
      DR_DATA,
      [...vanillaConnections(DR_DATA, "open")].map(([name, to]) => ({
        from: DR_DATA.regions.find((r) => r.exits.includes(name))?.name ?? "",
        name,
        req: "true",
        to,
      })),
    );
    expect(marked.light.has("Links House")).toBe(true);
    expect(marked.dark.has("Links House")).toBe(false);
    expect(marked.dark.has("Palace of Darkness Portal")).toBe(true);
    expect(marked.light.has("Eastern Lobby")).toBe(true);
  });

  it("gives each location one id", () => {
    for (const mode of ["open", "standard", "inverted"] as const) {
      const world = drWorld({
        ...DR_DEFAULTS,
        ...settingsFromUpstream(mode),
      });
      const ids = [...world.locationIds.values()];
      expect(new Set(ids).size, mode).toBe(ids.length);
    }
    expect(drLocationId("Hyrule Castle - Zelda's Chest")).toBe(
      "hyrule-castle/zeldas-cell",
    );
  });

  it("starts at the Menu, its save-and-quit points reached", () => {
    const world = drWorld(settings("open"));
    const solution = solveFacts(world, { heartContainer: 3 });
    expect(solution.location(drLocationId("Link's House"))).toBe("yes");
    expect(solution.location(drLocationId("Sanctuary"))).toBe("yes");
    // The bunny: past Agahnim, a dark world cave's chest needs the pearl,
    // the Pyramid's ledge item does not (bunny_accessible_locations)
    const held = {
      defeatAgahnim: 1,
      glove: 1,
      hammer: 1,
      heartContainer: 3,
      magicMirror: 1,
    };
    const bunny = solveFacts(world, held);
    const link = solveFacts(world, { ...held, moonPearl: 1 });
    expect(bunny.location(drLocationId("Hype Cave - Top"))).toBe("no");
    expect(link.location(drLocationId("Hype Cave - Top"))).toBe("yes");
    expect(bunny.location(drLocationId("Pyramid"))).toBe("yes");
  });

  it("splits a dungeon region by the crystal states some path brings", () => {
    const { regionIds } = drWorld(settings("open")).compiled;
    // Hera's lobby: entered orange, its switch turns it blue
    expect(regionIds).toContain("heraLobby__orange");
    expect(regionIds).toContain("heraLobby__blue");
    // A region out of the dungeons has one node
    expect(regionIds).toContain("linksHouse");
    expect(regionIds).not.toContain("linksHouse__orange");
  });

  it("asks a key door's number of keys of DR's analysis, drops' too, else maybe", () => {
    const world = drWorld(settings("open"));
    const unswept = drWorld(settings("open"), { sweepEvents: false });
    const chest = drLocationId("Eastern Palace - Big Key Chest");
    const lamp = { heartContainer: 3, lamp: 1 };
    // The dark square's door asks two keys; Eastern's two keys are drops,
    // the dark eyegore's past the big key door, against its bow: until both
    // are reached, maybe
    expect(solveFacts(world, lamp).location(chest)).toBe("maybe");
    expect(solveFacts(world, { ...lamp, bow: 1 }).location(chest)).toBe(
      "maybe",
    );
    expect(
      solveFacts(world, { ...lamp, bigKeyP1: 1, bow: 1 }).location(chest),
    ).toBe("yes");
    // Not swept, the drops' keys are not held: maybe, never no
    const all = { ...lamp, bigKeyP1: 1, bow: 1 };
    expect(solveFacts(unswept, all).location(chest)).toBe("maybe");
    expect(solveFacts(unswept, { ...all, keyP1: 2 }).location(chest)).toBe(
      "yes",
    );
  });

  it("puts Eastern Palace's big key chest behind its room's enemies (1.5.8)", () => {
    // kill_chests' 'Eastern Big Key' (Rules.py:1483 at 1.5.8): the chest
    // once the room's enemies can be beaten. Bombs beat them, which DR
    // gives for free unless the bomb bag is on (can_use_bombs)
    const chest = drLocationId("Eastern Palace - Big Key Chest");
    const world = drWorld(
      { ...settings("open"), bombBag: true },
      { sweepEvents: false },
    );
    const held = { heartContainer: 3, keyP1: 2, lamp: 1 };
    expect(solveFacts(world, held).location(chest)).toBe("no");
    expect(solveFacts(world, { ...held, hammer: 1 }).location(chest)).toBe(
      "yes",
    );
    expect(solveFacts(world, { ...held, bombUpgrade: 1 }).location(chest)).toBe(
      "yes",
    );
  });

  it("drops from the Old Man's ledge into his dark room, lamp in hand (1.5.8)", () => {
    // mandatory_connections (EntranceShuffle2.py:2344 at 1.5.8) and the
    // dark room's entrances (Rules.py:1351)
    expect(
      vanillaConnections(DR_DATA, "open").get("Old Man Cave Dropdown"),
    ).toBe("Old Man Cave (West)");
    const world = drWorld(settings("open"), {
      probes: ["Old Man Cave Dropdown"],
    });
    const drop = "exit:Old Man Cave Dropdown";
    const held = { glove: 1, heartContainer: 3 };
    expect(solveFacts(world, held).location(drop)).toBe("no");
    expect(solveFacts(world, { ...held, lamp: 1 }).location(drop)).toBe("yes");
  });

  it("reads each key holding as DR's add_key_logic_rules does", () => {
    // Agahnim's Tower: the Room 03 stairs ask one key (validate_vanilla_key_
    // logic, KeyDoorShuffle.py:2079-2083), every key of the tower four
    const maze = drLocationId("Castle Tower - Dark Maze");
    const held = { heartContainer: 3, lamp: 1, sword: 1 };
    const at = (more: Settings, keys: number, options = {}) =>
      solveFacts(
        drWorld(
          { ...settings("open"), ...more },
          { start: ["Agahnims Tower Portal"], sweepEvents: false, ...options },
        ),
        { ...held, keyA1: keys },
      ).location(maze);
    const wild = { wildBigKeys: true, wildKeys: true };
    // Keys in their dungeon: below the number maybe, never no
    expect([at({}, 0), at({}, 1)]).toEqual(["maybe", "yes"]);
    // Wild keys: what the player recorded decides
    expect([at(wild, 0), at(wild, 1)]).toEqual(["no", "yes"]);
    // Strict with wild keys: every chest key (has_sm_key_strict)
    const strict = { ...wild, strictKeyLogic: true };
    expect([at(strict, 1), at(strict, 2)]).toEqual(["no", "yes"]);
    // Universal keys are bought: maybe, the shops not ported
    expect(at({ universalKeys: true }, 4)).toBe("maybe");
    // On connections given, no analysis: every key of the dungeon
    const given = { connections: vanillaConnections(DR_DATA, "open") };
    expect([at({}, 1, given), at({}, 4, given)]).toEqual(["maybe", "yes"]);
    expect(at({ universalKeys: true }, 4, given)).toBe("maybe");
    // Pots or drops in the dungeons, which the analysis does not count:
    // every key of the dungeon too
    const added = { dungeonPotsAndDrops: true };
    expect([at(added, 1), at(added, 4)]).toEqual(["maybe", "yes"]);
    expect([
      at({ ...wild, ...added }, 1),
      at({ ...wild, ...added }, 4),
    ]).toEqual(["maybe", "yes"]);
  });

  it("leaves Standard's escape doors to its key, universal keys or not", () => {
    // has_sm_key's escape key holds in Standard with vanilla doors
    // (BaseClasses.py:1114-1116): the escape's doors ask no key bought
    const zelda = drLocationId("Hyrule Castle - Zelda's Chest");
    const held = { ...everything(OPEN), keyH2: 0 };
    const standard = (more: Settings) =>
      solveFacts(drWorld({ ...settings("standard"), ...more }), held).location(
        zelda,
      );
    expect(standard({ universalKeys: true })).toBe("yes");
  });

  it("puts a big chest behind its dungeon's big key", () => {
    const wild = { ...settings("open"), wildBigKeys: true };
    const chest = drLocationId("Eastern Palace - Big Chest");
    const held = { bow: 1, heartContainer: 3, lamp: 1 };
    const at = (world: ReturnType<typeof drWorld>, more = {}) =>
      solveFacts(world, { ...held, ...more }).location(chest);
    // Wild big keys: the one recorded decides
    expect([at(drWorld(wild)), at(drWorld(wild), { bigKeyP1: 1 })]).toEqual([
      "no",
      "yes",
    ]);
    // Kept in its dungeon, the big key may lie inside: maybe until held
    const kept = drWorld(settings("open"));
    expect([at(kept), at(kept, { bigKeyP1: 1 })]).toEqual(["maybe", "yes"]);
    // Wild but one the player cannot record: maybe too
    const unrecorded = drWorld(wild, { unrecorded: ["bigKeyP1"] });
    expect(at(unrecorded)).toBe("maybe");
  });

  it("lets a bunny through a region of both worlds by a way from Link's own", () => {
    // get_rule_to_add (Rules.py:2083-2165): a cave the bunny reaches on
    // Link's side, through a cave of both, the way in from Link's world's
    // own region and its rule; a blocked door is no way
    const exits = [
      {
        from: "Paradox Cave Front",
        name: "Paradox Shop",
        req: "true",
        to: "Paradox Shop",
      },
      {
        blocked: true,
        from: "East Death Mountain (Bottom)",
        name: "A trapped door",
        req: "true",
        to: "Paradox Shop",
      },
      {
        from: "East Death Mountain (Bottom)",
        name: "Paradox Cave (Bottom)",
        req: "hammer",
        to: "Paradox Cave Front",
      },
    ];
    const both = ["Paradox Shop", "Paradox Cave Front"];
    const helpers = addBunnyRules(
      DR_DATA,
      exits,
      new Map(),
      {
        dark: new Set(both),
        light: new Set([...both, "East Death Mountain (Bottom)"]),
      },
      "open",
    );
    // can_reach(entrance) and the path's rules, its own among them
    // (path_to_access_rule, Rules.py:2069-2070), a helper of its own
    expect(exits[0]?.req).toBe("(@bunny0)");
    expect(helpers.get("bunny0")).toBe(
      "(moonPearl) | ((reach(eastDeathMountainBottom)) & (hammer) & (hammer))",
    );
  });

  it("keeps a bunny's rules apart, as DR's paths share them", () => {
    // A chain of rooms on both sides of the world, each left by a door a
    // bunny cannot pass (bunny_impassible_doors): each door's rule reads
    // the rule of the door before it, grown by its own bunny rule. Copied
    // as text it doubled a door (2^18 times over here); as a helper read by
    // name, each rule stays the size of its own path
    const doors = (
      ruleData as unknown as {
        bunny: { impassableDoors: { value: readonly string[] } };
      }
    ).bunny.impassableDoors.value.slice(0, 18);
    const rooms = DR_DATA.regions
      .filter((r) => r.type === "dungeon")
      .slice(0, doors.length + 1)
      .map((r) => r.name);
    const exits = [
      {
        from: "East Death Mountain (Bottom)",
        name: "A way in",
        req: "true",
        to: rooms[0] as string,
      },
      ...doors.map((name, i) => ({
        from: rooms[i] as string,
        name,
        req: "hammer",
        to: rooms[i + 1] as string,
      })),
    ];
    const helpers = addBunnyRules(
      DR_DATA,
      exits,
      new Map(),
      {
        dark: new Set(rooms),
        light: new Set([...rooms, "East Death Mountain (Bottom)"]),
      },
      "open",
    );
    const longest = Math.max(
      ...exits.map((e) => e.req.length),
      ...[...helpers.values()].map((h) => h.length),
    );
    expect(longest).toBeLessThan(2_000);
    // The last door: the pearl, or the way from Link's own side through
    // each door before it, by its rule
    const last = exits.at(-1)?.req ?? "";
    expect(last).toBe(`(hammer) & (@bunny${doors.length - 1})`);
    expect(helpers.get(`bunny${doors.length - 1}`)).toContain(
      "reach(eastDeathMountainBottom)",
    );
    expect(helpers.get(`bunny${doors.length - 1}`)).toContain(
      `@bunny${doors.length - 2}`,
    );
  });

  it("makes the light world the bunny's in Inverted", () => {
    const world = drWorld(settings("inverted"));
    // Through Agahnim's portal: a light world chest asks the pearl, the
    // bottle merchant does not (bunny_accessible_locations)
    const held = { defeatAgahnim: 1, glove: 1, hammer: 1, heartContainer: 3 };
    const bunny = solveFacts(world, held);
    const link = solveFacts(world, { ...held, moonPearl: 1 });
    const well = drLocationId("Kakariko Well - Top");
    expect(bunny.location(well)).toBe("no");
    expect(link.location(well)).toBe("yes");
    expect(bunny.location(drLocationId("Bottle Merchant"))).toBe("yes");
    expect(bunny.location(drLocationId("Link's House"))).toBe("yes");
  });

  it("builds on the connections it is given", () => {
    const connections = new Map(vanillaConnections(DR_DATA, "inverted"));
    const brewery = drLocationId("Brewery");
    const before = solveFacts(drWorld(settings("inverted")), {
      heartContainer: 3,
    });
    // DR's vanilla Inverted world leaves the Dark Sanctuary's exit unlinked
    expect(before.location(brewery)).toBe("no");
    connections.set("Dark Sanctuary Hint Exit", "Dark Chapel Area");
    const after = solveFacts(drWorld(settings("inverted"), { connections }), {
      heartContainer: 3,
    });
    expect(after.location(brewery)).toBe("yes");
  });

  it("runs Standard's escape: Uncle's save point, Zelda's way back", () => {
    const world = drWorld(settings("standard"));
    const at = (state: Record<string, number>, name: string) =>
      solveFacts(world, { heartContainer: 3, ...state }).location(
        drLocationId(name),
      );
    // Uncle S&Q (Rules.py:1507): his item from the start
    expect(at({}, "Link's Uncle")).toBe("yes");
    // A weapon, or Uncle's bombs (unknown): maybe
    expect(at({}, "Secret Passage")).toBe("maybe");
    expect(at({ sword: 1 }, "Secret Passage")).toBe("yes");
    // Zelda's way back asks the escape's doors: with every key, delivered,
    // and the world opens
    expect(at({ sword: 1 }, "Zelda Drop Off")).toBe("maybe");
    expect(at({ keyH2: 4, sword: 1 }, "Zelda Drop Off")).toBe("yes");
    expect(at({ keyH2: 4, sword: 1 }, "Kakariko Tavern")).toBe("yes");
  });

  it("keeps Link on the castle's grounds until Zelda is delivered", () => {
    // standard_rules (Rules.py:1509-1517, :1580-1581): the castle's
    // grounds, the save points and the flute (can_flute, BaseClasses.py:
    // 1270-1272) wait for her delivery. Every item but the keys and the
    // pack's event items (Agahnim's defeats are DR's events, which only
    // the castle's way out gives): nothing past the grounds, as DR's own
    // keyless probe found (4222a44)
    const outside = [
      "Hyrule Castle Area",
      "Links House Area",
      "Sanctuary Area",
      "Kakariko Village",
      "Pyramid Area",
    ];
    const world = drWorld(
      { ...settings("standard"), wildBigKeys: true, wildKeys: true },
      { regions: ["Hyrule Castle Courtyard", ...outside] },
    );
    const state = Object.fromEntries(
      Object.entries(everything(settingsFromUpstream("standard"))).filter(
        ([item]) => !/^(big)?[kK]ey|^defeatAgahnim|^rescueZelda$/.test(item),
      ),
    );
    const solution = solveFacts(world, state);
    expect(solution.location(regionProbeId("Hyrule Castle Courtyard"))).toBe(
      "yes",
    );
    for (const region of outside)
      expect(solution.location(regionProbeId(region)), region).toBe("no");
    // Agahnim beaten opens the castle gate (Rules.py:1017-1018), which no
    // play reaches before her delivery
    expect(
      solveFacts(world, { ...state, defeatAgahnim: 1 }).location(
        regionProbeId("Hyrule Castle Area"),
      ),
    ).toBe("yes");
  });

  it("reads the rules of the first way back from Zelda's cell", () => {
    const exits = [
      {
        from: "Hyrule Dungeon Cellblock",
        name: "a",
        req: "keyH2",
        to: "Hyrule Dungeon Staircase",
      },
      {
        from: "Hyrule Dungeon Staircase",
        name: "b",
        req: "true",
        to: "Hyrule Castle Throne Room",
      },
      {
        from: "Hyrule Dungeon Cellblock",
        name: "c",
        req: "lamp",
        to: "Hyrule Castle Throne Room",
      },
    ];
    // Breadth first: the direct way, its rule only
    expect(zeldaPath(DR_DATA, exits, (req) => req === "true")).toEqual([
      "lamp",
    ]);
    expect(
      zeldaPath(DR_DATA, exits.slice(0, 2), (req) => req === "true"),
    ).toEqual(["keyH2"]);
  });

  it("adds Murahdahla to a triforce hunt", () => {
    const hunt = {
      ...settings("open"),
      treasureHunt: 20,
      triforceHuntGoal: true,
    };
    const world = drWorld(hunt);
    const murahdahla = world.locationIds.get("Murahdahla") ?? "";
    expect(murahdahla).toBe("murahdahla");
    const pieces = (n: number) =>
      solveFacts(world, { heartContainer: 3, triforcePiece: n }).location(
        murahdahla,
      );
    expect(pieces(19)).toBe("no");
    expect(pieces(20)).toBe("yes");
    expect(drWorld(settings("open")).locationIds.has("Murahdahla")).toBe(false);
  });

  it("asks a door its worst case under dangerous key logic, partial's number capped", () => {
    // Ganons Tower's Double Switch EN and its kin: worst case 7, small_key_num
    // 6 (create_rule); dangerous reads eval_small_key_door_main, uncapped
    // (Rules.py:2399-2400), partial caps it (:2428-2430)
    const wild = { ...settings("open"), wildBigKeys: true, wildKeys: true };
    const firesnake = drLocationId("Ganons Tower - Firesnake Room");
    const at = (more: Settings, keys: number) =>
      solveFacts(drWorld({ ...wild, ...more }), {
        ...everything(OPEN),
        keyA2: keys,
      }).location(firesnake);
    expect(at({}, 3)).toBe("yes");
    expect(at({ dangerousKeyLogic: true }, 3)).not.toBe("yes");
    expect(at({ dangerousKeyLogic: true }, 4)).toBe("yes");
  });

  it("refuses a door rule without its worst case, never opening the door", () => {
    const logic = drKeyLogic(DR_DATA, settings("open")).get("Agahnims Tower");
    const [first] = logic?.doorRules.values() ?? [];
    if (logic === undefined || first === undefined)
      throw new Error("no rule for Agahnim's Tower");
    const keys = worldKeys(DR_DATA, "dungeon", { drops: false, pots: false });
    expect(keys.doorRule("Agahnims Tower", first, logic)).toContain("keyA1");
    expect(() =>
      keys.doorRule(
        "Agahnims Tower",
        { ...first, worstCase: undefined },
        logic,
      ),
    ).toThrow(RangeError);
  });

  it("gives a forced drop its room's dungeon's key, as a door shuffle moves it", () => {
    // update_forced_keys (DoorShuffle.py:1039-1050): the castle's big key
    // drop in a room of Eastern's layout holds Eastern's big key
    const drop = "Hyrule Castle - Big Key Drop";
    const moved = worldKeys(
      DR_DATA,
      "wild",
      { drops: false, pots: false },
      { wild: true },
      false,
      (d) => (d.location === drop ? "Eastern Palace" : undefined),
    );
    const fact = moved.forcedDrops.find((d) => d.location === drop)?.fact;
    if (fact === undefined) throw new Error("no castle big key drop");
    expect(moved.bigKeyRule("Eastern Palace")).toContain(fact);
    expect(moved.bigKeyRule("Hyrule Castle")).not.toContain(fact);
    // Left in its own dungeon without a shuffle
    const own = worldKeys(DR_DATA, "wild", { drops: false, pots: false });
    expect(own.bigKeyRule("Hyrule Castle")).toContain(fact);
    expect(own.bigKeyRule("Eastern Palace")).not.toContain(fact);
  });

  it("puts a boss's items behind its map and compass when restricted", () => {
    const held = { bigKeyP1: 1, bow: 1, heartContainer: 3, keyP1: 2, lamp: 1 };
    const boss = drLocationId("Eastern Palace - Boss");
    // Maps and compasses shuffled: the player records them
    const restricted = drWorld({
      ...settings("open"),
      restrictBossItems: true,
      wildCompasses: true,
      wildMaps: true,
    });
    expect(solveFacts(drWorld(settings("open")), held).location(boss)).toBe(
      "yes",
    );
    expect(solveFacts(restricted, held).location(boss)).toBe("no");
    expect(
      solveFacts(restricted, { ...held, compassP1: 1, mapP1: 1 }).location(
        boss,
      ),
    ).toBe("yes");
    // Kept in their dungeons, unrecorded: they may be in hand, never yes
    const kept = drWorld({ ...settings("open"), restrictBossItems: true });
    expect(solveFacts(kept, held).location(boss)).toBe("maybe");
    expect(
      solveFacts(kept, { ...held, compassP1: 1, mapP1: 1 }).location(boss),
    ).toBe("yes");
  });

  it("adds the run's pots and drops to their regions, with their rules and the bunny's", () => {
    const pot = "Palace of Darkness Hint Pot #1";
    const drop = "Sewers Dark Cross Enemy #2";
    const world = drWorld(
      { ...settings("open"), pottery: true },
      {
        dropsAndPots: [
          { name: pot, region: "Palace of Darkness Hint" },
          { name: drop, region: "Sewers Dark Cross" },
        ],
      },
    );
    const all = everything(OPEN);
    const at = (name: string, state: State) =>
      solveFacts(world, state).location(drLocationId(name));
    expect([at(pot, all), at(drop, all)]).toEqual(["yes", "yes"]);
    // pot_rules: the bombs or the boots (Rules.py:970-972); a bunny in the
    // dark world gets no pot (set_bunny_rules)
    expect(at(pot, { ...all, bombUpgrade: 0, pegasusBoots: 0 })).toBe("yes");
    expect(at(pot, { ...all, moonPearl: 0 })).not.toBe("yes");
    // In the dark (Rules.py:1313), and drop_rules: the enemy's defeat,
    // the bombs without a bomb bag (can_use_bombs) or a weapon
    expect(at(drop, { heartContainer: 3 })).toBe("no");
    expect(at(drop, { heartContainer: 3, lamp: 1 })).toBe("yes");
    const bag = drWorld(
      { ...settings("open"), bombBag: true },
      { dropsAndPots: [{ name: drop, region: "Sewers Dark Cross" }] },
    );
    const inBag = (state: State) =>
      solveFacts(bag, state).location(drLocationId(drop));
    expect(inBag({ heartContainer: 3, lamp: 1 })).toBe("no");
    expect(inBag({ heartContainer: 3, lamp: 1, sword: 1 })).toBe("yes");
    // Not asked for, not in the world
    expect(drWorld(settings("open")).locationIds.has(pot)).toBe(false);
  });

  it("puts Mire's spikes' key pot behind the spikes once pots shuffle", () => {
    const pot = drLocationId("Misery Mire - Spikes Pot Key");
    const state = { ...everything(OPEN), caneOfByrna: 0, cape: 0 };
    const hurt = { ...state, heartContainer: 3, pieceOfHeart: 0 };
    expect(solveFacts(drWorld(settings("open")), hurt).location(pot)).toBe(
      "yes",
    );
    const shuffled = drWorld({ ...settings("open"), potShuffle: true });
    expect(solveFacts(shuffled, hurt).location(pot)).toBe("maybe");
    expect(solveFacts(shuffled, state).location(pot)).toBe("yes");
  });
});
