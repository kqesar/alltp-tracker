import { describe, expect, it } from "vitest";
import overworld from "./owr/overworld.json" with { type: "json" };
import regionData from "./owr/regions.json" with { type: "json" };
import rules from "./owr/rules.json" with { type: "json" };
import drRules from "./world/rules.json" with { type: "json" };

type Spot = { req: string; source: string[] };
const entrances = rules.entrances as Record<string, Spot>;
const locations = rules.locations as Record<string, Spot>;
const helpers = rules.helpers as Record<
  string,
  { req: string; source: string }
>;
const events = rules.events as Record<
  string,
  { item: string; location: string; source: string }
>;
const dynamicEvents = rules.dynamicEvents as {
  name: string;
  region: string;
  item: string;
  req: string;
  when?: string;
  source: string;
}[];

describe("the Overworld Randomizer's rules (import-dr --owr, stage B)", () => {
  it("come from the commit the world does", () => {
    expect(rules.upstream).toEqual(regionData.upstream);
  });

  it("read the fork's rule objects as DR's rules read lambdas", () => {
    // owr:Rules.py:358: set_rule(…, Primitive('can_flute', player))
    expect(entrances["Flute Spot 1"]?.req).toBe("@drCanFlute");
    // owr:Rules.py:410, spike_cave_access_rule(player): a function of the
    // module, read where called; its lambda a leaf among rule objects
    expect(locations["Spike Cave"]?.req).toBe(
      "hammer & @drCanLiftRocks & (cape & @drCanExtendMagic16Full | caneOfByrna & (@drCanExtendMagic12Full | !setting(cantTakeDamage) & (@drHasBoots | @drHasHearts4)))",
    );
    // not_rule(Has('Trench 1 Filled')): the dry path, as DR's
    expect(entrances["Swamp Trench 1 Approach Dry"]?.req).toBe("true");
    expect(rules.negatedEvents).toEqual(drRules.negatedEvents);
    // A spot chosen by the settings (owr:Rules.py:540): each, under its
    // branch
    expect(entrances["Ganons Tower"]?.req).toBe(
      "(!setting(tileSwapped_03) | !setting(tileSwapped_1b)) & count(crystal) >= setting(crystalsTower) | setting(tileSwapped_03) & setting(tileSwapped_1b)",
    );
    expect(Object.keys(entrances).length).toBeGreaterThan(650);
    expect(Object.keys(locations).length).toBeGreaterThan(900);
  });

  it("read a flipped screen as a setting the world gives", () => {
    const read = new Set(
      [...JSON.stringify(rules).matchAll(/setting\((tileSwapped_\w+)\)/g)].map(
        (m) => m[1],
      ),
    );
    // ow_inverted_rules (owr:Rules.py:1163-1231) and the swapped Kakariko's
    // flute (ItemList.py:255)
    expect([...read].sort()).toEqual(
      ["03", "05", "07", "10", "18", "1b", "2f", "30", "33", "35"].map(
        (tile) => `tileSwapped_${tile}`,
      ),
    );
    // Each a screen the overworld has
    const screens = new Set(Object.values(overworld.tiles));
    for (const name of read)
      expect(screens.has(Number.parseInt(name.slice(-2), 16)), name).toBe(true);
  });

  it("port the fork's own methods", () => {
    // owr:BaseClasses.py:1366-1367: DR's, and bombs to farm unless the
    // world overrides the check (its tests' harness does)
    expect(helpers.drCanUseBombs?.req).toBe(
      "(!setting(bombBag) | bombUpgrade) & (setting(overrideBombCheck) | @drCanFarmBombs)",
    );
    // Standard's escape and the stun prize are maybe; the farms' events
    expect(helpers.drCanFarmBombs?.req).toMatch(
      /^setting\(standardMode\) & maybe \| farmableBombs \| @drCanStunEnemies & maybe \| farmableRupees & \(/,
    );
    expect(helpers.drHasBeatenAga?.req).toBe(
      "defeatAgahnim & (!setting(standardMode) | zeldaDelivered)",
    );
    expect(helpers.drCanCollectBonkdrops?.req).toBe(
      "pegasusBoots | @drHasSword & quake",
    );
    // The activated flute alone, or its activation's event
    expect(helpers.drCanFlute?.req).toBe(
      "(!setting(standardMode) | zeldaDelivered) & @drFluteActive",
    );
    expect(helpers.drFluteActive?.req).toBe("flute >= 2 | ocarinaActivated");
  });

  it("place the fork's events by its table, each boss kill its own", () => {
    // Regions.py location_events: the followers' quests and the dungeons'
    // switches; Agahnim's are the pack's items
    expect(events.returnOldMan).toMatchObject({
      item: "Return Old Man",
      location: "Old Man Drop Off",
    });
    expect(events.detonateBigBomb?.location).toBe("Pyramid Crack");
    const kills = Object.entries(events).filter(
      ([, event]) => event.item === "Beat Boss",
    );
    expect(kills).toHaveLength(10);
    for (const [, kill] of kills)
      expect(kill.source).toMatch(/^Regions\.py:\d+$/);
    // The dungeons goal: Agahnim beaten, Agahnim 2, the ten boss kills
    expect(locations.Ganon?.req).toContain(
      `@drHasBeatenAga & defeatAgahnim2 & count(${kills.map(([id]) => id).join(", ")}) >= 10`,
    );
  });

  it("give each bonk drop its rule while they are shuffled", () => {
    for (const drop of overworld.bonk) {
      const req = locations[drop.name]?.req ?? "";
      expect(req, drop.name).toContain("@drCanCollectBonkdrops");
      expect(req, drop.name).toContain("!setting(bonkDrops)");
      expect(req.includes("@drHasBeatenAga"), drop.name).toBe(drop.aga);
    }
    expect(locations["Cold Fairy Statue"]?.req).toContain("@drCanUseBombs");
    // Standard's two castle trees wait for Zelda (owr:Rules.py:1776-1778)
    expect(locations["Hyrule Castle Tree"]?.req).toContain("zeldaDelivered");
  });

  it("list the events the world adds: the farms and the flute", () => {
    expect(
      dynamicEvents.filter((e) => e.item === "Farmable Bombs"),
    ).toHaveLength(6 + 15 + 2 + 2);
    expect(
      dynamicEvents
        .filter((e) => e.item === "Farmable Rupees")
        .map((e) => e.name),
    ).toEqual([
      "50 Rupee Cave Pot Drop",
      "20 Rupee Cave Pot Drop",
      "Archery Game Prize",
    ]);
    expect(dynamicEvents.find((e) => e.name === "Flute Activation")).toEqual({
      item: "Ocarina (Activated)",
      name: "Flute Activation",
      region: "Kakariko Village",
      req: "flute",
      source: expect.stringMatching(/^ItemList\.py:\d+$/),
      when: "!setting(tileSwapped_18)",
    });
    const regions = new Set(regionData.regions.map((r) => r.name));
    for (const event of dynamicEvents)
      expect(regions.has(event.region), event.region).toBe(true);
  });

  it("leave out only what is code, each with its line and why", () => {
    // Reviewed, by why, against DR's own list (rules.spec.ts): the same
    // code at the fork's lines (save-and-quit 345-349, hidden pits' key
    // door 630-634, Mire's spike pot 693-694, the key logic 964, boss items
    // 978-985, Uncle 1694-1695, the escape portals 1703-1704, Zelda's path
    // 1760-1763, Murahdahla 92 and 1772, the static key logic 62, the bomb
    // walls 1051-1052, pots 1110-1127, the bunny 111); the fork's own:
    // ow_terrain_rules (53, ported in the world: an edge's water and side),
    // the flute's activation (100, an event of dynamicEvents). No bomb shop
    // case: the big bomb is an event's.
    const why = new Map<string, number[]>();
    for (const { line, why: reason } of rules.unported)
      why.set(reason, [...(why.get(reason) ?? []), line]);
    expect(Object.fromEntries(why)).toEqual({
      "a call of a function": [631, 634],
      "a call of add_mc_rule": [984, 985],
      "a comparison (==)": [1772, 92],
      "a loop": [978],
      "a loop over no list": [346, 1052],
      "a save-and-quit point: what reaches a region": [345, 349],
      "a spot other than an entrance or a location": [1704, 1704],
      "an assignment": [630, 633, 693, 1695, 1703, 1703],
      "an assignment with ,": [1760],
      "key_logic_algorithm compared with static": [62],
      "Standard's save-and-quit to Uncle: an exit the world adds": [1694],
      "the attribute pot": [694],
      "the bunny's paths, by which regions the entrances make dark": [111],
      "the key logic: KeyDoorShuffle's analysis of each dungeon (keys, §2.5 of the design)":
        [964],
      "the name loc": [1127, 1127],
      "unread: Rules.py:100: expected , or ]": [100],
      "unread: Rules.py:1051: expected , or ]": [1051],
      "unread: Rules.py:1110: expected , or ]": [1110],
      "unread: Rules.py:1126: expected , or )": [1126, 1126],
      "unread: Rules.py:1758: expected ], not :": [1761, 1763],
      "water edges and whirlpools: flippers and the pearl, by where each edge leads":
        [53],
    });
    expect(rules.bombShop).toBeNull();
  });
});
