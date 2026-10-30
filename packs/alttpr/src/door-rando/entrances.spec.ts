import { describe, expect, it } from "vitest";
import { ENTRANCES, entrancePool, TARGETS } from "../entrances";
import er from "../entrances/er.json" with { type: "json" };
import {
  type DrPoolSettings,
  type DrShuffle,
  drEntranceName,
  drEntranceOf,
  drEntrancePool,
  drShuffled,
  drTargetName,
  drTargetOf,
  vanillaEntrances,
} from "./entrances";
import owr from "./owr/connections.json" with { type: "json" };
import connections from "./world/connections.json" with { type: "json" };

const SHUFFLES: readonly DrShuffle[] = [
  "simple",
  "restricted",
  "full",
  "crossed",
  "insanity",
  "swapped",
  "lite",
  "lean",
  "dungeonssimple",
  "dungeonsfull",
];
const MODES = ["open", "standard", "inverted"] as const;

const settings = (more: Partial<DrPoolSettings> = {}): DrPoolSettings => ({
  dropShuffle: "none",
  enemyShuffle: false,
  mode: "open",
  pottery: "none",
  shopsanity: false,
  shuffleLinks: false,
  shuffleTavern: false,
  ...more,
});

describe("the Door Randomizer's entrance pools", () => {
  it("writes the game's entrance tables as the entrance randomizer does", () => {
    // Rom.py:500-549 writes a door's slot of the door table, a hole's
    // bytes of the hole table and a target's entrance number (exit_ids), as
    // the entrance randomizer's Rom.py does: autotracking's tables read a DR
    // seed alike, once each name is spelled as the other does
    const tables = connections as unknown as Record<
      string,
      Record<string, { value: Record<string, unknown> }>
    >;
    const doors = tables["source/overworld/EntranceData.py"]?.door_addresses
      ?.value as Record<string, number | number[]>;
    const exits = tables["source/overworld/EntranceShuffle2.py"]?.exit_ids
      ?.value as Record<string, number | null>;
    const erDoors = er.doors.value as Record<
      string,
      { slot?: number; slots?: number[] }
    >;
    const erExits = er.exits.value as unknown as Record<
      string,
      { entrance: number | null }
    >;
    let compared = 0;
    for (const [name, at] of Object.entries(doors)) {
      const mine = erDoors[drEntranceOf(name).name];
      if (Array.isArray(at))
        // The hole table starts at 0xDB84C; the Inverted pyramid's last
        // byte is a flag of its own (0x180340)
        expect(mine?.slots, name).toEqual(
          at.filter((a) => a < 0x180000).map((a) => a - 0xdb84c),
        );
      else expect(mine?.slot, name).toBe(at);
      compared++;
    }
    for (const [name, entrance] of Object.entries(exits)) {
      if (entrance === null) continue;
      const known = erExits[name] ?? erExits[drTargetOf(name).name];
      expect(known?.entrance, name).toBe(entrance);
      compared++;
    }
    expect(compared).toBeGreaterThan(250);
  });

  it("keeps the entrance randomizer's ids where the names match", () => {
    // A Crosskeys run's notes, saved with the entrance randomizer's ids,
    // read the same in DR's pools
    const crossed = entrancePool("crossed", "open");
    for (const entrance of crossed.entrances) {
      const name = drEntranceName(entrance.id);
      if (name !== undefined) expect(drEntranceOf(name).id).toBe(entrance.id);
    }
    expect(drEntranceOf("Kakariko Well Drop").id).toBe("kakariko-well-drop");
    expect(drEntranceOf("Mire Fairy").name).toBe("Dark Desert Fairy");
    expect(drTargetOf("Skull Pinball").name).toBe(
      "Skull Woods First Section (Right)",
    );
    expect(drTargetName(drTargetOf("Skull Pinball").id)).toBe("Skull Pinball");
    expect(drTargetName("links-house-exit")).toBe("Links House Exit");
    for (const t of TARGETS) {
      const name = drTargetName(t.id);
      if (name !== undefined) expect(drTargetOf(name).id).toBe(t.id);
    }
    expect(drEntranceName("no-such-door")).toBeUndefined();
    expect(() => drEntranceOf("No Such Door")).toThrow(RangeError);
    expect(() => drTargetOf("No Such Exit")).toThrow(RangeError);
  });

  it("lets every moved entrance lead where the vanilla world leads it", () => {
    // A seed may leave an entrance where it was: the pool never refuses
    // that note, in any shuffle of any world
    for (const shuffle of SHUFFLES)
      for (const mode of MODES) {
        const s = settings({ mode, shuffleLinks: true, shuffleTavern: true });
        const pool = drEntrancePool(shuffle, s);
        const maps = vanillaEntrances(mode === "inverted");
        expect(pool.entrances.length, `${shuffle} ${mode}`).toBe(
          drShuffled(shuffle, s).size,
        );
        for (const entrance of pool.entrances) {
          const name = drEntranceName(entrance.id) ?? "";
          const vanilla = maps.twoWay.get(name) ?? maps.oneWay.get(name) ?? "";
          expect(
            pool.targetsOf.get(entrance.id)?.map((t) => t.id),
            `${shuffle} ${mode} ${name}`,
          ).toContain(drTargetOf(vanilla).id);
          expect(pool.partners(entrance.id, drTargetOf(vanilla).id)).toEqual(
            [],
          );
        }
        expect(pool.decoupled).toBe(shuffle === "insanity");
      }
  });

  it("moves what each mode's pools move", () => {
    // dungeonssimple: the dungeons among dungeons, Skull Woods' doors and
    // holes; every other entrance vanilla (`undefined`: vanilla)
    const dungeons = drEntrancePool("dungeonssimple", settings());
    const moved = dungeons.entrances.map((e) => e.id);
    expect(moved).toContain(drEntranceOf("Eastern Palace").id);
    expect(moved).toContain(drEntranceOf("Skull Woods Second Section Hole").id);
    expect(moved).not.toContain(drEntranceOf("Kakariko Shop").id);
    // A dungeon's door leads to a dungeon, its holes to drops
    const eastern = dungeons.targetsOf.get(drEntranceOf("Eastern Palace").id);
    expect(eastern?.every((t) => t.kind === "dungeon")).toBe(true);
    expect(
      dungeons.targetsOf
        .get(drEntranceOf("Skull Woods Second Section Hole").id)
        ?.every((t) => t.kind === "drop"),
    ).toBe(true);
    // Holes come last
    const last = dungeons.entrances.at(-1);
    expect(last?.kind).toBe("hole");

    // Crossed: everything but Link's House and the Tavern's back, unless
    // the run shuffles them; Standard keeps its escape and Link's House
    const crossed = drShuffled("crossed", settings());
    expect(crossed.has("Kakariko Shop")).toBe(true);
    expect(crossed.has("Links House")).toBe(false);
    expect(crossed.has("Tavern North")).toBe(false);
    const linked = drShuffled(
      "crossed",
      settings({ shuffleLinks: true, shuffleTavern: true }),
    );
    expect(linked.has("Links House")).toBe(true);
    expect(linked.has("Tavern North")).toBe(true);
    const standard = drShuffled(
      "crossed",
      settings({ mode: "standard", shuffleLinks: true }),
    );
    for (const kept of [
      "Hyrule Castle Entrance (South)",
      "Hyrule Castle Secret Entrance Stairs",
      "Hyrule Castle Secret Entrance Drop",
      "Links House",
    ])
      expect(standard.has(kept), kept).toBe(false);
    // Inverted: its own pyramid's names, its Link's House the bomb shop
    const inverted = drShuffled("crossed", settings({ mode: "inverted" }));
    expect(inverted.has("Inverted Pyramid Hole")).toBe(true);
    expect(inverted.has("Pyramid Hole")).toBe(false);
    expect(inverted.has("Big Bomb Shop")).toBe(false);
    expect(inverted.has("Links House")).toBe(true);
  });

  it("keeps lite's caves vanilla as its settings say", () => {
    // fixed_non_items always; fixed_shops unless shopsanity; the pots'
    // caves unless pottery reaches them (do_vanilla_connect, :1060-1086)
    const lite = drShuffled("lite", settings());
    expect(lite.has("Dark Sanctuary Hint")).toBe(false);
    expect(lite.has("Kakariko Shop")).toBe(false);
    expect(lite.has("Lumberjack House")).toBe(false);
    expect(lite.has("Mimic Cave")).toBe(true);
    const items = drShuffled(
      "lite",
      settings({
        dropShuffle: "underworld",
        enemyShuffle: true,
        pottery: "cave",
        shopsanity: true,
      }),
    );
    expect(items.has("Kakariko Shop")).toBe(true);
    expect(items.has("Lumberjack House")).toBe(true);
    expect(items.has("Good Bee Cave")).toBe(true);
    expect(items.has("Light World Bomb Hut")).toBe(true);
    expect(items.has("Dark Sanctuary Hint")).toBe(false);
    // The Inverted world's Dark Death Mountain fairy is not kept (its
    // swap names an entrance that does not exist)
    expect(
      drShuffled("lite", settings({ mode: "inverted" })).has(
        "Dark Death Mountain Fairy",
      ),
    ).toBe(true);
    // Simple's Inverted Bumper Cave is fixed (inverted_fixed)
    expect(
      drShuffled("simple", settings({ mode: "inverted" })).has(
        "Bumper Cave (Bottom)",
      ),
    ).toBe(false);
    expect(drShuffled("simple", settings()).has("Bumper Cave (Bottom)")).toBe(
      true,
    );
  });

  it("places every entrance on the map", () => {
    const named = new Set(ENTRANCES.map((e) => e.id));
    for (const inverted of [false, true])
      for (const name of vanillaEntrances(inverted).pool)
        expect(named.has(drEntranceOf(name).id), name).toBe(true);
  });

  it("reads the Overworld Randomizer's entrances as DR's Open world's", () => {
    // The fork's EntranceShuffle2 tables (owr 0.8.0.2) are DR's, but for
    // the Inverted names its world never uses: its pools (owrShuffled) and
    // a note of either are the same; its ROM tables (EntranceData's slots,
    // exit_ids) too, so autotracking reads an OWR seed's doors alike
    const tables = (from: unknown, file: string) =>
      (from as Record<string, Record<string, { value: unknown }>>)[file] ?? {};
    const fork = tables(owr, "source/overworld/EntranceShuffle2.py");
    const dr = tables(connections, "source/overworld/EntranceShuffle2.py");
    const open = vanillaEntrances(false);
    const drops = (fork.drop_map?.value ?? {}) as Record<string, string>;
    expect(drops).toEqual(
      Object.fromEntries([...open.oneWay].filter(([name]) => name in drops)),
    );
    expect(Object.keys(drops)).toHaveLength(12);
    const twoWay = fork.entrance_map?.value as Record<string, string>;
    expect(new Map(Object.entries(twoWay))).toEqual(
      new Map(
        [...open.twoWay].filter(([name]) => !name.startsWith("Inverted")),
      ),
    );
    expect(
      [
        ...Object.keys(drops),
        ...Object.keys(twoWay),
        ...Object.keys(fork.single_entrance_map?.value as object),
      ].sort(),
    ).toEqual([...open.pool].sort());
    expect(fork.exit_ids?.value).toEqual(dr.exit_ids?.value);
    const data = "source/overworld/EntranceData.py";
    expect(tables(owr, data).door_addresses?.value).toEqual(
      tables(connections, data).door_addresses?.value,
    );
  });
});
