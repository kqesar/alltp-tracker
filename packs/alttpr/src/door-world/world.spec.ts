import type { Settings, State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
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
import { DR_REGIONS, pairsOf, REGION_NAMED } from "./data";
import {
  DR_DEFAULTS,
  drKeyLogic,
  drLocationId,
  drWorld,
  markWorlds,
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
      const connections = vanillaConnections(mode);
      for (const [exit, to] of connections) {
        expect(isStaticExit(exit), exit).toBe(true);
        expect(REGION_NAMED.has(to), to).toBe(true);
      }
      // Unlinked: a one-way door's far side, an exit only the other
      // worlds' mandatory tables link, the inverted sanctuary's way out
      // (a single entrance, EntranceShuffle2.py single_entrance_map) and
      // the removed mirror route
      const other = new Set(
        [
          ...pairsOf(
            "OverworldShuffle.py",
            mode === "inverted"
              ? "open_mandatory_connections"
              : "inverted_mandatory_connections",
          ),
          ...pairsOf("EntranceShuffle2", "drop_map"),
          ...pairsOf("EntranceShuffle2", "entrance_map"),
        ].map(([exit]) => exit),
      );
      const farSides = new Set(
        pairsOf("DoorShuffle.py", "default_one_way_connections").map(
          ([, to]) => to,
        ),
      );
      const unlinked = DR_REGIONS.flatMap((r) => r.exits).filter(
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

  it("swaps the Inverted world's entrances (EntranceShuffle2.py:64-78)", () => {
    const open = vanillaConnections("open");
    const inverted = vanillaConnections("inverted");
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
      const exits = dynamicExits(mode);
      const names = exits.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(isStaticExit(name), name).toBe(false);
      const own = mode === "open" ? "lw" : "dw";
      for (const exit of exits)
        expect(REGION_NAMED.get(exit.from)?.type).toBe(
          exit.to === "Flute Sky" ? own : own === "lw" ? "dw" : "lw",
        );
    }
    expect(
      dynamicExits("open").find((e) => e.name === "Flute From Zoras Domain"),
    ).toBeUndefined();
  });

  it("marks the worlds through the exits, never across", () => {
    const world = drWorld(settings("open"));
    expect(world.locationIds.size).toBeGreaterThan(200);
    const marked = markWorlds(
      [...vanillaConnections("open")].map(([name, to]) => ({
        from: DR_REGIONS.find((r) => r.exits.includes(name))?.name ?? "",
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

  it("reads each key holding as DR's add_key_logic_rules does", () => {
    // Agahnim's Tower: the Room 03 stairs ask one key (validate_vanilla_key_
    // logic, KeyDoorShuffle.py:1979-1983), every key of the tower four
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
    const given = { connections: vanillaConnections("open") };
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
    // get_rule_to_add (Rules.py:2079-2161): a cave the bunny reaches on
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
    addBunnyRules(
      exits,
      new Map(),
      {
        dark: new Set(both),
        light: new Set([...both, "East Death Mountain (Bottom)"]),
      },
      "open",
    );
    // can_reach(entrance) and the path's rules, its own among them
    // (path_to_access_rule, Rules.py:2065-2066)
    expect(exits[0]?.req).toBe(
      "((moonPearl) | ((reach(eastDeathMountainBottom)) & (hammer) & (hammer)))",
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
    const connections = new Map(vanillaConnections("inverted"));
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
    // Uncle S&Q (Rules.py:1503): his item from the start
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
    expect(zeldaPath(exits, (req) => req === "true")).toEqual(["lamp"]);
    expect(zeldaPath(exits.slice(0, 2), (req) => req === "true")).toEqual([
      "keyH2",
    ]);
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
    // (Rules.py:2393-2395), partial caps it (:2422-2424)
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
    const logic = drKeyLogic(settings("open")).get("Agahnims Tower");
    const [first] = logic?.doorRules.values() ?? [];
    if (logic === undefined || first === undefined)
      throw new Error("no rule for Agahnim's Tower");
    const keys = worldKeys("dungeon", { drops: false, pots: false });
    expect(keys.doorRule("Agahnims Tower", first, logic)).toContain("keyA1");
    expect(() =>
      keys.doorRule(
        "Agahnims Tower",
        { ...first, worstCase: undefined },
        logic,
      ),
    ).toThrow(RangeError);
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
    // pot_rules: the bombs or the boots (Rules.py:967-969); a bunny in the
    // dark world gets no pot (set_bunny_rules)
    expect(at(pot, { ...all, bombUpgrade: 0, pegasusBoots: 0 })).toBe("yes");
    expect(at(pot, { ...all, moonPearl: 0 })).not.toBe("yes");
    // In the dark (Rules.py:1310), and drop_rules: the enemy's defeat,
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
