import type { Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { dynamicExits, vanillaConnections } from "./connections";
import { DR_DATA } from "./dr-data";
import {
  DR_DEFAULTS,
  drLocationId,
  drWorld,
  eachValue,
  regionProbeId,
} from "./index";
import {
  crossablePairsOf,
  crossingsOf,
  edgePartnersOf,
  fluteSpots,
  isTileSwapped,
  linkOwrEntrances,
  OWR_DEFAULTS,
  type OwrPossibleLinks,
  owrDynamicEvents,
  owrFlipGroups,
  owrMovedExits,
  owrNotesComplete,
  owrNotesFromSpoiler,
  owrScreensOf,
  owrSettings,
  owrTerrainRules,
  regionTypeOf,
  unknownScreenSettings,
  whirlpoolsOf,
} from "./overworld";
import { OWR_DATA } from "./owr-data";
import { bunnyWall } from "./shuffle";
import { and, readFacts } from "./text";

type Mode = "open" | "standard" | "inverted";
const settings = (mode: Mode): Settings => ({
  ...DR_DEFAULTS,
  ...settingsFromUpstream(mode),
  drVersion: 157,
});
const overworld = OWR_DATA.overworld;

describe("the Overworld Randomizer's world (door-world on OWR_DATA)", () => {
  it("links every edge with its vanilla partner, both ways", () => {
    for (const mode of ["open", "inverted"] as const) {
      const c = vanillaConnections(OWR_DATA, mode);
      for (const edge of overworld?.edges ?? [])
        expect(c.has(edge.name), edge.name).toBe(true);
      // OverworldShuffle.py default_connections: Lost Woods SW to its pass
      expect(c.get("Lost Woods SW")).toBe(
        OWR_DATA.parentOf("Lost Woods Pass NW"),
      );
      expect(c.get("Lost Woods Pass NW")).toBe(
        OWR_DATA.parentOf("Lost Woods SW"),
      );
    }
  });

  it("puts the flute spots in slot order, each screen as it stands", () => {
    // FluteShuffle.py:44-50, 655-657: the Desert ledge's slot (0x38) sorts
    // it before Dam's (0x3b)
    expect(fluteSpots(OWR_DATA, "open")).toEqual([
      "West Death Mountain (Bottom)",
      "Potion Shop Area",
      "Kakariko Village",
      "Links House Area",
      "Eastern Nook Area",
      "Desert Teleporter Ledge",
      "Dam Area",
      "Octoballoon Area",
    ]);
    const inverted = fluteSpots(OWR_DATA, "inverted");
    expect(inverted[0]).toBe("West Dark Death Mountain (Top)");
    expect(
      inverted.every((r) => OWR_DATA.regionNamed(r ?? "").type === "dw"),
    ).toBe(true);
    expect(vanillaConnections(OWR_DATA, "open").get("Flute Spot 6")).toBe(
      "Desert Teleporter Ledge",
    );
  });

  it("links shuffled whirlpools and flute spots as noted, the rest nowhere", () => {
    // Shuffled whirlpools: a noted pair both ways, an unnoted one nowhere
    const pools = vanillaConnections(OWR_DATA, "open", 157, undefined, {
      whirlpools: {
        "C Whirlpool": "Zora Whirlpool",
        "Zora Whirlpool": "C Whirlpool",
      },
    });
    const where = whirlpoolsOf(OWR_DATA);
    expect(pools.get("C Whirlpool")).toBe(where.get("Zora Whirlpool")?.region);
    expect(pools.get("Zora Whirlpool")).toBe(where.get("C Whirlpool")?.region);
    expect(pools.has("Lake Hylia Whirlpool")).toBe(false);
    // Vanilla, every whirlpool is linked
    expect(
      vanillaConnections(OWR_DATA, "open").has("Lake Hylia Whirlpool"),
    ).toBe(true);
    expect(() =>
      vanillaConnections(OWR_DATA, "open", 157, undefined, {
        whirlpools: { "C Whirlpool": "Nowhere" },
      }),
    ).toThrow('No whirlpool "Nowhere"');
    // Moved flute spots: the noted screens in slot order, the rest nowhere
    const flute = vanillaConnections(OWR_DATA, "open", 157, undefined, {
      flute: [0x30, 0x05],
    });
    expect(flute.get("Flute Spot 1")).toBe("East Death Mountain (Bottom)");
    expect(flute.get("Flute Spot 2")).toBe(overworld?.flute["48"]?.regions[0]);
    expect(flute.has("Flute Spot 3")).toBe(false);
  });

  it("links a crossed overworld's edges as noted, the rest nowhere", () => {
    // o4mamwuKZ (grouped): Central Bonk Rocks' north edge into the Pyramid's
    const edges = {
      "Central Bonk Rocks NW": "Pyramid SW",
      "Pyramid SW": "Central Bonk Rocks NW",
    };
    const c = vanillaConnections(OWR_DATA, "open", 157, undefined, { edges });
    expect(c.get("Central Bonk Rocks NW")).toBe(
      OWR_DATA.parentOf("Pyramid SW"),
    );
    expect(c.get("Pyramid SW")).toBe(
      OWR_DATA.parentOf("Central Bonk Rocks NW"),
    );
    expect(c.has("Lost Woods SW")).toBe(false);
    expect(edgePartnersOf(OWR_DATA, { edges }).size).toBe(2);
    // Not noted at all: every vanilla pair, both ways
    expect(edgePartnersOf(OWR_DATA).get("Lost Woods Pass NW")).toBe(
      "Lost Woods SW",
    );
    expect(() =>
      vanillaConnections(OWR_DATA, "open", 157, undefined, {
        edges: { "Lost Woods SW": "Nowhere" },
      }),
    ).toThrow('No edge "Nowhere"');
  });

  it("links a crossable pair as its crossing is noted, its twins with it", () => {
    const pairs = crossablePairsOf(OWR_DATA);
    expect(pairs).toHaveLength(67);
    expect(pairs).toContainEqual(["Lost Woods SW", "Lost Woods Pass NW"]);
    const crossed = edgePartnersOf(OWR_DATA, {
      crossings: { "Lost Woods SW": true },
    });
    // Into the twin of its partner, the twins' pair with it (OWEdges.py:
    // parallel_links: Skull Woods SW, Skull Woods Pass NW)
    expect(crossed.get("Lost Woods SW")).toBe("Skull Woods Pass NW");
    expect(crossed.get("Skull Woods Pass NW")).toBe("Lost Woods SW");
    expect(crossed.get("Skull Woods SW")).toBe("Lost Woods Pass NW");
    // Another crossable pair not noted: nowhere; an edge with no twin:
    // vanilla
    expect(crossed.has("Lost Woods SC")).toBe(false);
    const stays = edgePartnersOf(OWR_DATA, {
      crossings: { "Lost Woods SW": false },
    });
    expect(stays.get("Lost Woods SW")).toBe("Lost Woods Pass NW");
    expect(stays.get("Skull Woods SW")).toBe("Skull Woods Pass NW");
    const lone = OWR_DATA.overworld?.edges.find(
      (e) =>
        e.parallel === undefined &&
        e.screen < 0x40 &&
        !pairs.flat().includes(e.name),
    );
    expect(lone).toBeDefined();
    expect(crossed.get(lone?.name ?? "")).toBe(
      edgePartnersOf(OWR_DATA).get(lone?.name ?? ""),
    );
  });

  it("asks the flippers of an edge into the water its noted partner opens on", () => {
    const exit = () => ({
      from: "Lost Woods Area",
      name: "Lost Woods SW",
      req: "true",
      to: "Lost Woods Pass West Area",
    });
    const marked = { dark: new Set<string>(), light: new Set<string>() };
    const vanilla = [exit()];
    owrTerrainRules(OWR_DATA, vanilla, marked, "open");
    expect(vanilla[0]?.req).toBe("true");
    // Noted into River Bend's south water edge (OWEdges.py:79)
    const crossed = [exit()];
    owrTerrainRules(OWR_DATA, crossed, marked, "open", {
      edges: { "Lost Woods SW": "River Bend SC" },
    });
    expect(crossed[0]?.req).toBe("flippers");
  });

  it("reads a crossed seed's edges from its spoiler, both ways", () => {
    const json = {
      meta: { ow_crossed: "grouped" },
      Overworld: [{ entrance: "Central Bonk Rocks NW", exit: "Pyramid SW" }],
    };
    expect(owrNotesFromSpoiler(json)).toEqual({
      edges: {
        "Central Bonk Rocks NW": "Pyramid SW",
        "Pyramid SW": "Central Bonk Rocks NW",
      },
    });
    expect(
      owrNotesFromSpoiler({ ...json, meta: { ow_crossed: "none" } }),
    ).toEqual({});
  });

  it("reads a seed's whirlpools and flute spots from its spoiler, for its shuffles alone", () => {
    const json = {
      Maps: [{ data: [5, 16], type: "flute" }],
      meta: { ow_fluteshuffle: "random", ow_whirlpool: true },
      Whirlpools: [{ entrance: "C Whirlpool", exit: "Zora Whirlpool" }],
    };
    expect(owrNotesFromSpoiler(json)).toEqual({
      flute: [5, 16],
      whirlpools: {
        "C Whirlpool": "Zora Whirlpool",
        "Zora Whirlpool": "C Whirlpool",
      },
    });
    expect(
      owrNotesFromSpoiler({
        ...json,
        meta: { ow_fluteshuffle: "vanilla", ow_whirlpool: false },
      }),
    ).toEqual({});
  });

  it("flips every screen in Inverted and none otherwise", () => {
    expect(isTileSwapped("inverted", 0x1b)).toBe(true);
    expect(isTileSwapped("open", 0x1b)).toBe(false);
    expect(owrSettings("inverted")).toMatchObject({
      darkChapelStart: true,
      tileSwapped_1b: true,
      tileSwapped_03: true,
    });
    expect(owrSettings("open").tileSwapped_18).toBe(false);
    expect(OWR_DEFAULTS.overrideBombCheck).toBe(false);
  });

  it("starts and saves where the flipped screens put Link", () => {
    const open = vanillaConnections(OWR_DATA, "open");
    const inverted = vanillaConnections(OWR_DATA, "inverted");
    // OverworldShuffle.py:183-196
    expect(open.get("Links House S&Q")).toBe("Links House");
    expect(inverted.get("Links House S&Q")).toBe("Big Bomb Shop");
    expect(open.get("Sanctuary S&Q")).toBe("Sanctuary");
    expect(inverted.get("Sanctuary S&Q")).toBe("Dark Sanctuary Hint");
    expect(open.get("Other World S&Q")).toBe("Pyramid Area");
    expect(inverted.get("Other World S&Q")).toBe("Hyrule Castle Ledge");
    // EntranceShuffle2.py:195-200, 157-160
    expect(inverted.get("Big Bomb Shop Exit")).toBe("Big Bomb Shop Area");
    expect(inverted.get("Dark Sanctuary Hint Exit")).toBe("Dark Chapel Area");
    expect(open.get("Chris Houlihan Room Exit")).toBe("Links House Area");
    expect(inverted.get("Chris Houlihan Room Exit")).toBe("Big Bomb Shop Area");
  });

  it("trades the towers and moves the pyramid once their screens flip", () => {
    const open = vanillaConnections(OWR_DATA, "open");
    const inverted = vanillaConnections(OWR_DATA, "inverted");
    // is_atgt_swapped (BaseClasses.py:347-348, EntranceShuffle2.py:69-71)
    expect(open.get("Ganons Tower")).toBe(
      OWR_DATA.parentOf("Ganons Tower Exit"),
    );
    expect(inverted.get("Ganons Tower")).toBe(
      OWR_DATA.parentOf("Agahnims Tower Exit"),
    );
    // relocate_pyramid_entrances (EntranceShuffle2.py:2034-2055)
    expect(owrMovedExits(OWR_DATA, "open").size).toBe(0);
    expect(owrMovedExits(DR_DATA, "inverted").size).toBe(0);
    expect(owrMovedExits(OWR_DATA, "inverted").get("Pyramid Entrance")).toBe(
      "Hyrule Castle Ledge",
    );
    expect(open.get("Pyramid Exit")).toBe("Pyramid Exit Ledge");
    expect(inverted.get("Pyramid Exit")).toBe("Hyrule Castle Ledge");
  });

  it("activates the flute at Kakariko only while its screen stands", () => {
    const named = (mode: Mode) =>
      owrDynamicEvents(OWR_DATA, { ...owrSettings(mode) }).map((e) => e.name);
    expect(named("open")).toContain("Flute Activation");
    expect(named("inverted")).not.toContain("Flute Activation");
    expect(
      owrDynamicEvents(OWR_DATA, owrSettings("open")).find(
        (e) => e.name === "Flute Activation",
      )?.fact,
    ).toBe("ocarinaActivated");
    expect(owrDynamicEvents(DR_DATA, {})).toEqual([]);
  });

  it("flies with the flute once it is activated, never before", () => {
    const world = drWorld(
      { ...settings("open"), overrideBombCheck: true },
      { data: OWR_DATA },
    );
    const spot = drLocationId("Desert Ledge");
    // Book of Mudora aside, the Desert ledge is the flute's and the mirror's
    const base = { glove: 2, magicMirror: 1 };
    expect(solveFacts(world, { ...base, flute: 1 }).location(spot)).toBe("yes");
    expect(solveFacts(world, base).location(spot)).toBe("no");
    // Inverted: no activation spot, the activated flute alone flies
    const inverted = drWorld(
      { ...settings("inverted"), overrideBombCheck: true },
      { data: OWR_DATA },
    );
    const mire = drLocationId("Mire Shed - Left");
    const held = { glove: 2, moonPearl: 1 };
    expect(solveFacts(inverted, { ...held, flute: 1 }).location(mire)).toBe(
      "no",
    );
    expect(solveFacts(inverted, { ...held, flute: 2 }).location(mire)).toBe(
      "yes",
    );
  });

  it("asks the flippers into water and the pearl into the other world", () => {
    // ow_terrain_rules (Rules.py:1417-1429): Zora's approach edge into the
    // waterfall's water
    const world = drWorld(settings("open"), { data: OWR_DATA });
    const zora = drLocationId("Zora's Ledge");
    expect(solveFacts(world, {}).location(zora)).toBe("no");
    expect(solveFacts(world, { flippers: 1 }).location(zora)).toBe("yes");
  });

  it("stops a bunny at a wall of its own door kinds", () => {
    // owr:Rules.py:2024-2029: the castle's sewers in Inverted, the rat
    // path's dashable wall
    expect(bunnyWall(OWR_DATA, "Sewers Rat Path WS")).toBe("yes");
    const world = drWorld(settings("inverted"), {
      data: OWR_DATA,
      regions: ["Sewers Secret Room"],
    });
    const secret = regionProbeId("Sewers Secret Room");
    const all = everything(settingsFromUpstream("inverted"));
    expect(solveFacts(world, { ...all, moonPearl: 0 }).location(secret)).toBe(
      "no",
    );
    expect(solveFacts(world, all).location(secret)).toBe("yes");
  });

  it("flips Mixed's screens in their groups, the sanctuary's never with vanilla entrances", () => {
    const groups = owrFlipGroups(OWR_DATA, {
      crossed: false,
      mode: "open",
      shuffle: "vanilla",
      whirlpools: false,
    });
    const of = (screen: number) =>
      groups.find((g) => g.screens.includes(screen));
    // define_tile_groups (OverworldShuffle.py:1009-1039)
    expect(of(0x13)).toEqual({
      canFlip: false,
      screens: [0x13, 0x14, 0x1a, 0x1b],
    });
    expect(of(0x00)?.screens).toEqual([0x00, 0x2d, 0x80]);
    expect(of(0x0f)?.screens).toEqual([0x0f, 0x35, 0x81]);
    expect(of(0x12)?.screens).toEqual([0x12, 0x15, 0x33, 0x3f]);
    expect(of(0x28)?.screens).toEqual([0x28, 0x29]);
    expect(of(0x2c)).toEqual({ canFlip: true, screens: [0x2c] });
    expect(groups.flatMap((g) => g.screens)).toHaveLength(42);
    // Crossed, the edges' and special screens stand apart; shuffled
    // whirlpools free theirs; Lite's sanctuary flips but in Inverted
    const crossed = owrFlipGroups(OWR_DATA, {
      crossed: true,
      mode: "open",
      shuffle: "lite",
      whirlpools: true,
    });
    expect(crossed.find((g) => g.screens.includes(0x00))?.screens).toEqual([
      0x00,
    ]);
    expect(crossed.find((g) => g.screens.includes(0x13))).toEqual({
      canFlip: true,
      screens: [0x13, 0x14],
    });
    expect(
      owrFlipGroups(OWR_DATA, {
        crossed: true,
        mode: "inverted",
        shuffle: "lite",
        whirlpools: true,
      }).find((g) => g.screens.includes(0x13))?.canFlip,
    ).toBe(false);
  });

  it("reads a screen flipped as its group is noted, unknown while none is", () => {
    const screens = owrScreensOf(OWR_DATA, "open", { flips: { "45": true } });
    // 0x2d noted: its group (0x00, 0x80) with it, and the dark twins
    expect([0x00, 0x2d, 0x40, 0x6d, 0x80].map(screens.flipped)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(screens.swapped(0x2d)).toBe(true);
    expect(screens.flipped(0x2c)).toBeUndefined();
    // The sanctuary's group never flips; a large screen's other ids never
    expect(screens.flipped(0x1b)).toBe(false);
    expect(screens.flipped(0x01)).toBe(false);
    // Inverted: flipped back
    const inverted = owrScreensOf(OWR_DATA, "inverted", {
      flips: { "44": true },
    });
    expect([inverted.swapped(0x2c), inverted.swapped(0x2b)]).toEqual([
      false,
      undefined,
    ]);
    // Notes that disagree in a group: unknown
    expect(
      owrScreensOf(OWR_DATA, "open", {
        flips: { "0": true, "45": false },
      }).flipped(0x00),
    ).toBeUndefined();
    // Without Mixed: Inverted's
    expect(owrScreensOf(OWR_DATA, "inverted").swapped(0x2c)).toBe(true);
    // The settings it reads: an unknown screen's listed, never a sub-id's
    expect(unknownScreenSettings(screens)).toContain("tileSwapped_2c");
    expect(unknownScreenSettings(screens)).not.toContain("tileSwapped_01");
    expect(owrSettings("open", screens)).toMatchObject({
      darkChapelStart: false,
      tileSwapped_2d: true,
    });
  });

  it("swaps a flipped screen's regions into the other world, none while unknown", () => {
    const screens = owrScreensOf(OWR_DATA, "open", { flips: { "44": true } });
    const typeOf = regionTypeOf(OWR_DATA, screens);
    expect(typeOf(OWR_DATA.regionNamed("Links House Area"))).toBe("dw");
    expect(typeOf(OWR_DATA.regionNamed("Big Bomb Shop Area"))).toBe("lw");
    expect(typeOf(OWR_DATA.regionNamed("Kakariko Village"))).toBeUndefined();
    expect(typeOf(OWR_DATA.regionNamed("Links House"))).toBe("cave");
    // No flute from a region whose type is not known; a flipped one's
    // mirror exits leave from it
    const exits = dynamicExits(OWR_DATA, "open", typeOf);
    expect(exits.some((e) => e.from === "Kakariko Village")).toBe(false);
    expect(
      exits.some((e) => e.from === "Links House Area" && e.to === "Flute Sky"),
    ).toBe(false);
    expect(
      exits.some(
        (e) => e.from === "Big Bomb Shop Area" && e.to === "Flute Sky",
      ),
    ).toBe(true);
  });

  it("links what an unknown screen decides neither way, each way possible", () => {
    const possible: OwrPossibleLinks = [];
    const notes = { flips: {} };
    const c = vanillaConnections(
      OWR_DATA,
      "open",
      157,
      undefined,
      notes,
      owrScreensOf(OWR_DATA, "open", notes),
      possible,
    );
    expect(c.has("Links House S&Q")).toBe(false);
    expect(possible).toContainEqual(["Links House S&Q", "Big Bomb Shop"]);
    // The sanctuary's group stands: the pyramid's S&Q, its door, the towers
    expect(c.get("Other World S&Q")).toBe("Pyramid Area");
    expect(c.get("Pyramid Exit")).toBe("Pyramid Exit Ledge");
    // The pyramid's screen stands, so the towers never trade
    expect(c.get("Ganons Tower")).toBe(OWR_DATA.parentOf("Ganons Tower Exit"));
    expect(c.has("TR Pegs Teleporter")).toBe(false);
    expect(c.has("Chris Houlihan Room Exit")).toBe(false);
    // Edges: a pair whose screens' flips are not known leads nowhere; the
    // flute spots on screens not known neither
    expect(c.has("Lost Woods SW")).toBe(false);
    expect(possible).toContainEqual([
      "Lost Woods SW",
      "Skull Woods Pass West Area",
    ]);
    expect(c.has("Flute Spot 1")).toBe(false);
    // Known: the vanilla links back
    const all = Object.fromEntries(
      [...Array.from({ length: 0x40 }, (_, i) => i), 0x80, 0x81].map((i) => [
        String(i),
        false,
      ]),
    );
    const known = vanillaConnections(OWR_DATA, "open", 157, undefined, {
      flips: all,
    });
    const vanilla = vanillaConnections(OWR_DATA, "open");
    expect(Object.fromEntries(known)).toEqual(Object.fromEntries(vanilla));
  });

  it("trades the towers and moves the pyramid neither way while their screens are not known", () => {
    // Full entrances: the pyramid's screen may flip (OverworldShuffle.py:
    // 1009-1011 merges it with the sanctuary's for vanilla ones only)
    const screens = owrScreensOf(
      OWR_DATA,
      "open",
      { flips: {} },
      { shuffle_full: true },
    );
    expect(screens.flipped(0x1b)).toBeUndefined();
    const c = new Map<string, string>();
    const possible: OwrPossibleLinks = [];
    linkOwrEntrances(OWR_DATA, c, "open", screens, possible);
    for (const exit of [
      "Ganons Tower",
      "Agahnims Tower",
      "Pyramid Hole",
      "Pyramid Exit",
    ])
      expect(c.has(exit), exit).toBe(false);
    expect(possible).toContainEqual([
      "Ganons Tower",
      OWR_DATA.parentOf("Agahnims Tower Exit"),
    ]);
    expect(possible).toContainEqual(["Pyramid Exit", "Hyrule Castle Ledge"]);
    expect(possible).toContainEqual([
      "Pyramid Hole",
      "Pyramid",
      "Hyrule Castle Ledge",
    ]);
    expect(owrMovedExits(OWR_DATA, "open", screens).size).toBe(0);
  });

  it("crosses Mixed's edges where their screens flip apart, Polar's never", () => {
    const flips = { "0": true, "16": false };
    const screens = owrScreensOf(OWR_DATA, "open", { flips });
    // Lost Woods (0x00) flipped, its pass (0x10) standing
    expect(
      edgePartnersOf(OWR_DATA, { flips }, screens).get("Lost Woods SW"),
    ).toBe("Skull Woods Pass NW");
    expect(
      edgePartnersOf(OWR_DATA, { flips, polar: true }, screens).get(
        "Lost Woods SW",
      ),
    ).toBe("Lost Woods Pass NW");
    // A crossed run's crossing as seen: crossing worlds between screens
    // flipped apart is the vanilla link
    const seen = { crossings: { "Lost Woods SW": true }, flips };
    expect(
      edgePartnersOf(OWR_DATA, seen, owrScreensOf(OWR_DATA, "open", seen)).get(
        "Lost Woods SW",
      ),
    ).toBe("Lost Woods Pass NW");
    expect(
      crossingsOf(
        OWR_DATA,
        { "Lost Woods SW": "Lost Woods Pass NW" },
        owrScreensOf(OWR_DATA, "open", seen),
      )["Lost Woods SW"],
    ).toBe(true);
  });

  it("reads a Mixed seed's flips and Polar from its spoiler", () => {
    const notes = owrNotesFromSpoiler({
      Maps: [{ data: [0x2c, 0x6c], type: "swaps" }],
      meta: { ow_crossed: "polar", ow_mixed: true },
      Overworld: [],
    });
    expect(notes.flips?.["44"]).toBe(true);
    expect(notes.flips?.["43"]).toBe(false);
    expect(notes.polar).toBe(true);
    expect(owrNotesFromSpoiler({ meta: { ow_mixed: false } })).toEqual({});
  });

  it("holds a rule's unknown settings in both values, past four reads maybe", () => {
    const unknown = new Set(["a", "b", "c", "d", "e"]);
    expect(eachValue("setting(a) & x | !setting(a) & y", unknown)).toBe(
      and("false & x | true & y", "true & x | false & y"),
    );
    expect(eachValue("setting(z)", unknown)).toBe("setting(z)");
    expect(
      eachValue(
        "setting(a) | setting(b) | setting(c) | setting(d) | !setting(e)",
        unknown,
      ),
    ).toBe("maybe | maybe | maybe | maybe | maybe");
  });

  it("asks the pearl and drops the flute's activation while a screen is not known", () => {
    const flips = {};
    const unknown = new Set(
      unknownScreenSettings(owrScreensOf(OWR_DATA, "open", { flips })),
    );
    expect(
      owrDynamicEvents(OWR_DATA, owrSettings("open"), unknown).some(
        (e) => e.name === "Flute Activation",
      ),
    ).toBe(false);
    // Kakariko's screen not known: its well's cave is maybe a bunny's
    const base = { ...settings("open"), overrideBombCheck: true };
    const all = everything(settingsFromUpstream("open"));
    const well = drLocationId("Kakariko Well - Top");
    const known = Object.fromEntries(
      [...Array.from({ length: 0x40 }, (_, i) => i), 0x80, 0x81].map((i) => [
        String(i),
        false,
      ]),
    );
    const sure = drWorld(base, { data: OWR_DATA, overworld: { flips: known } });
    expect(solveFacts(sure, { ...all, moonPearl: 0 }).location(well)).toBe(
      "yes",
    );
    const notKnown = drWorld(base, {
      data: OWR_DATA,
      overworld: { flips: { ...known, "24": undefined as unknown as boolean } },
    });
    expect(
      solveFacts(notKnown, { ...all, moonPearl: 0 }).location(well),
    ).not.toBe("yes");
    expect(
      owrNotesComplete(
        OWR_DATA,
        { flips: known },
        owrScreensOf(OWR_DATA, "open", { flips: known }),
      ),
    ).toBe(true);
  });

  it("counts events in a count as facts, at maybe while reached at maybe", () => {
    expect(readFacts("count(a, b) >= 2 & c", /\b(a|b|c)\b/g)).toBe(
      "(count(a, b) >= 2) | ((count(a, b, a__maybe, b__maybe) >= 2) & (maybe)) & (c | c__maybe & maybe)",
    );
    expect(readFacts("count(x, y) >= 2", /\b(a)\b/g)).toBe("count(x, y) >= 2");
  });
});
