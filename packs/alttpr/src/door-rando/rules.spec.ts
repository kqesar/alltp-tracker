import { compileWorld, loadRules, type World } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { STATE_NAMES } from "../pack";
import { RULES } from "../rules";
import { OPEN, STANDARD } from "../settings";
import drLocations from "./locations.json" with { type: "json" };
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
/** Each region's locations, DR's own (pots, drops, shops) after its list. */
const locationsOf = new Map(
  regions.map((region) => [region.name, [...region.locations]]),
);
for (const { name, region } of drLocations.locations) {
  const list = locationsOf.get(region);
  if (list !== undefined && !list.includes(name)) list.push(name);
}

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
    const located = new Set([...locationsOf.values()].flat());
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
    // Reviewed, by why: the bomb shop's impossible cases (2027-2032); boss
    // items restricted to the map and compass (815-822); the save-and-quit
    // points (195-196) and Uncle's (1503-1504); the shuffled entrances'
    // escape portals (1511-1512); Zelda's path (1569-1572); the shuffled
    // doors' bombable walls (892-893); the hidden pits' key door once doors
    // shuffle (461-465) and the key logic (801); Mire's spike pot where pot
    // shuffle lands it (527-528); pot_rules' blocks comprehension (951, read
    // from the pots' data) and the two Dark Lake Hylia spike cave pots of an
    // f-string (971-972: absent from the vanilla pots); triforce hunt's
    // Murahdahla (69, a location ItemList.py adds); the bunny (90)
    const why = new Map<string, number[]>();
    for (const { line, why: reason } of rules.unported)
      why.set(reason, [...(why.get(reason) ?? []), line]);
    expect(Object.fromEntries(why)).toEqual({
      "a bomb shop case other than an added rule": [2030],
      "a call of add_mc_rule": [821, 822],
      "a loop": [815],
      "a loop over no list": [196, 893],
      "a save-and-quit point: what reaches a region": [195],
      "a spot other than an entrance or a location": [1512, 1512],
      "an assignment": [461, 462, 464, 465, 527, 1504, 1511, 1511],
      "an assignment with ,": [1569],
      "an assignment with Exception": [2027, 2032],
      "no location Murahdahla": [69],
      "Standard's save-and-quit to Uncle: an exit the world adds": [1503],
      "the attribute pot": [528],
      "the bunny's paths, by which regions the entrances make dark": [90],
      "the key logic: KeyDoorShuffle's analysis of each dungeon (keys, §2.5 of the design)":
        [801],
      "the name loc": [972, 972],
      "unread: Rules.py:892: expected , or ]": [892],
      "unread: Rules.py:951: expected , or ]": [951],
      "unread: Rules.py:971: expected , or )": [971, 971],
      "unread: Rules.py:1567: expected ], not :": [1570, 1572],
    });
  });

  it("port the enemy logic: kill rooms, drops and pots", () => {
    const kill = rules.kill as Record<
      string,
      { req: string; source: string; sprites: string[] }
    >;
    const drops = rules.drops as Record<
      string,
      { req: string; sprite: string }
    >;
    // Every kill room and kill chest of Rules.py:1402 and :1478, each with
    // the sprites it reads
    expect(Object.keys(kill)).toHaveLength(42);
    for (const [region, room] of Object.entries(kill)) {
      expect(room.source, region).toMatch(/^Rules\.py:(1402|1478)$/);
      for (const sprite of room.sprites)
        expect(sprite).toMatch(/^source\/dungeon\/EnemyList\.py:\d+$/);
    }
    // An anti-fairy alone: only the powder makes it a fairy (damage table
    // row 0x15, as DR 1.5.6 computes it)
    expect(kill["GT Tile Room"]?.req).toBe("powder");
    // No stalfos past 40 health: the spawn room asks nothing
    expect(kill["Eastern Stalfos Spawn"]).toMatchObject({
      req: "true",
      sprites: [],
    });
    // Each drop on its sprite: the 714 enemies and the 14 key drops of an enemy
    expect(Object.keys(drops)).toHaveLength(728);
    for (const drop of Object.values(drops))
      expect(drop.sprite).toMatch(/^source\/dungeon\/EnemyList\.py:\d+$/);
    // No random.choice tie among the vanilla rooms
    expect(rules.ties).toEqual([]);
    // A kill room's rule on its doors in, unless a portal's
    expect(entrances["Eastern Stalfos Spawn ES"]?.req).toBe("true");
    expect(entrances["Hyrule Dungeon Armory S"]?.req).toContain(
      "setting(doorEntranceFlag_hyruleDungeonArmoryS)",
    );
    // Pots under pottery: Hookshot Fairy's behind the hookshot
    expect(locations["Hookshot Fairy Pot #1"]?.req).toBe(
      "!setting(pottery) | hookshot",
    );
    // The escape: every other sewers location asks a weapon, or Uncle's bombs
    expect(locations["Sewers - Dark Cross"]?.req).toContain(
      "!setting(standardMode) | @drCanKillMostThings | maybe",
    );
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
            ...(locationsOf.get(region.name) ?? []).flatMap((name) => {
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
