import type { Settings } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { solveFacts } from "../facts";
import { everything } from "../keys";
import { settingsFromUpstream } from "../settings";
import { vanillaConnections } from "./connections";
import { DR_DATA } from "./dr-data";
import { DR_DEFAULTS, drLocationId, drWorld, regionProbeId } from "./index";
import {
  edgePartnersOf,
  fluteSpots,
  isTileSwapped,
  OWR_DEFAULTS,
  owrDynamicEvents,
  owrMovedExits,
  owrNotesFromSpoiler,
  owrSettings,
  owrTerrainRules,
  whirlpoolsOf,
} from "./overworld";
import { OWR_DATA } from "./owr-data";
import { bunnyWall } from "./shuffle";
import { readFacts } from "./text";

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
    expect(inverted.every((r) => OWR_DATA.regionNamed(r).type === "dw")).toBe(
      true,
    );
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

  it("counts events in a count as facts, at maybe while reached at maybe", () => {
    expect(readFacts("count(a, b) >= 2 & c", /\b(a|b|c)\b/g)).toBe(
      "(count(a, b) >= 2) | ((count(a, b, a__maybe, b__maybe) >= 2) & (maybe)) & (c | c__maybe & maybe)",
    );
    expect(readFacts("count(x, y) >= 2", /\b(a)\b/g)).toBe("count(x, y) >= 2");
  });
});
