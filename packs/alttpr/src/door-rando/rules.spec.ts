import { compileWorld, loadRules, type World } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { STATE_NAMES } from "../pack";
import { RULES } from "../rules";
import { OPEN, STANDARD } from "../settings";
import regionData from "./world/regions.json" with { type: "json" };
import rules from "./world/rules.json" with { type: "json" };

type Spot = { req: string; source: string[] };
const entrances = rules.entrances as Record<string, Spot>;
const locations = rules.locations as Record<string, Spot>;
const helpers = rules.helpers as Record<
  string,
  { req: string; source: string }
>;
const { regions } = regionData;

/** Every req the translation wrote. */
const reqs = [
  ...Object.values(entrances).map((spot) => spot.req),
  ...Object.values(locations).map((spot) => spot.req),
  ...Object.values(helpers).map((helper) => helper.req),
  ...rules.bombShop.cases.map((c) => c.req),
];

describe("the Door Randomizer's rules (import-dr, stage B)", () => {
  it("come from the commit the world does", () => {
    expect(rules.upstream).toEqual(regionData.upstream);
  });

  it("each name a spot of DR's regions and cite their lines", () => {
    const exits = new Set(regions.flatMap((region) => region.exits));
    const located = new Set(regions.flatMap((region) => region.locations));
    for (const [name, rule] of Object.entries(entrances)) {
      expect(exits.has(name), name).toBe(true);
      for (const source of rule.source)
        expect(source).toMatch(/^Rules\.py:\d+$/);
    }
    for (const [name, rule] of Object.entries(locations)) {
      expect(located.has(name), name).toBe(true);
      expect(rule.source.length, name).toBeGreaterThan(0);
    }
    expect(Object.keys(entrances).length).toBeGreaterThan(600);
    expect(Object.keys(locations).length).toBeGreaterThan(100);
  });

  it("leave out only what is code, each with its line and why", () => {
    const why = new Map<string, number[]>();
    for (const { line, why: reason } of rules.unported)
      why.set(reason, [...(why.get(reason) ?? []), line]);
    expect(Object.fromEntries(why)).toEqual({
      "a bomb shop case other than an added rule": [2030],
      "a call of add_mc_rule": [821, 822],
      // Boss items restricted to the map and compass (restrict_boss_items)
      "a loop": [815],
      "a loop over no list": [196, 1542, 893],
      // Code: save-and-quit, Uncle's exit, the escape's kill rooms and
      // Zelda's path, the shuffled doors' bombable walls, the bunny
      "a save-and-quit point: what reaches a region": [195],
      "a spot other than an entrance or a location": [1512, 1512],
      "an assignment": [
        461, 462, 464, 465, 527, 1504, 1511, 1511, 1539, 1540, 1541,
      ],
      "an assignment with ,": [1569],
      // The bomb shop's impossible cases
      "an assignment with Exception": [2027, 2032],
      // Kill rooms, drops and pots: dr-enemies.mjs
      "enemy drops: EnemyLogic over the sprite (dr-enemies.mjs)": [59],
      "kill rooms: EnemyLogic over the room's sprites (dr-enemies.mjs)": [60],
      // Triforce hunt's Murahdahla, a location ItemList.py adds
      "no location Murahdahla": [69],
      "pots: which pots the pottery mode shuffles (dr-enemies.mjs)": [58],
      "Standard's save-and-quit to Uncle: an exit the world adds": [1503],
      // Mire's spike pot, where pot shuffle lands it (random)
      "the attribute pot": [528],
      "the bunny's paths, by which regions the entrances make dark": [90],
      // The key logic, and the hidden pits' key door once doors shuffle
      "the key logic: KeyDoorShuffle's analysis of each dungeon (keys, §2.5 of the design)":
        [801],
      "unread: Rules.py:892: expected , or ]": [892],
      "unread: Rules.py:1567: expected ], not :": [1570, 1572],
    });
  });

  it("read what only DR writes as data", () => {
    // not state.has('Trench 1 Filled'): the dry path stays open
    expect(rules.negatedEvents).toEqual(["Trench 1 Filled", "Trench 2 Filled"]);
    expect(entrances["Swamp Trench 1 Approach Dry"]?.req).toBe("true");
    expect(entrances["Swamp Trench 1 Approach Key"]?.req).toBe(
      "flippers & trench1Filled",
    );
    // Crystal states, by region
    expect(entrances["Hera Lobby to Front Barrier - Blue"]?.req).toBe(
      "reachedBlue_heraLobby",
    );
    expect(rules.crystal.length).toBeGreaterThan(50);
    // A door's flag: a derived setting with its vanilla value
    expect(entrances["Skull Torch Room WS"]?.req).toBe(
      "fireRod | !setting(doorTrapped_skullTorchRoomWS)",
    );
    expect(
      (rules.doorData as Record<string, { vanilla: boolean }>)
        .doorTrapped_skullTorchRoomWS,
    ).toMatchObject({ vanilla: false });
    // Rules.py:1982 reads state.can_flute uncalled, true in Python
    expect(rules.uncalledMethods).toEqual(["can_flute"]);
    // A vanilla boss slot, Ice variants beside
    expect(entrances["GT Ice Armos NE"]?.req).toBe("@drDefeatArmosKnights");
    expect(helpers.drDefeatIceTrinexx).toBeDefined();
    // Bunny rules: the pearl, or the region on Link's side
    expect(locations.Mushroom?.req).toBe(
      "moonPearl | setting(notBunny_lostWoodsEastArea)",
    );
  });

  it("compile in the engine, with the pack's items and DR's", () => {
    // Every rule as a location of its region, where reach() may stand
    const world: World = {
      regions: [
        { exits: regions.map((region) => ({ to: region.id })), id: "start" },
        ...regions.map((region) => ({
          id: region.id,
          locations: [
            ...region.locations.flatMap((name) => {
              const rule = locations[name];
              return rule === undefined
                ? []
                : [{ id: `location:${name}`, req: rule.req }];
            }),
            ...region.exits.flatMap((name) => {
              const rule = entrances[name];
              return rule === undefined
                ? []
                : [{ id: `entrance:${name}`, req: rule.req }];
            }),
          ],
        })),
      ],
      start: "start",
    };
    const loaded = loadRules({
      groups: RULES.groups,
      helpers: {
        ...RULES.helpers,
        ...Object.fromEntries(
          Object.entries(helpers).map(([name, { req }]) => [name, req]),
        ),
      },
    });
    // The facts the world gives: events, crystal states, opened doors
    const facts = new Set<string>();
    for (const req of reqs)
      for (const m of req.matchAll(
        /\b(reached(?:Blue|Orange)_\w+|opened_\w+)/g,
      ))
        facts.add(m[1] ?? "");
    const settings = new Set<string>();
    for (const req of reqs)
      for (const m of req.matchAll(/setting\((\w+)\)/g))
        settings.add(m[1] ?? "");
    for (const base of [OPEN, STANDARD]) {
      const compiled = compileWorld(world, loaded, {
        items: [
          ...STATE_NAMES,
          ...Object.keys(rules.events),
          ...rules.newItems,
          ...facts,
        ],
        settings: {
          ...Object.fromEntries(
            [...settings].map((name) => [
              name,
              name === "treasureHunt" ? 20 : false,
            ]),
          ),
          ...base,
        },
      });
      expect(compiled.locationIds).toHaveLength(
        Object.keys(entrances).length + Object.keys(locations).length,
      );
    }
  });
});
