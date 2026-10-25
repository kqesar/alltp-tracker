import { readFileSync } from "node:fs";
import { bindSeed } from "@alltp/spoiler";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SM_ITEMS } from "./items";
import { OBJECTIVES } from "./objectives";
import {
  type MapRandoLog,
  mapRandoEvidence,
  parseSpoiler,
  SPOILER_KEYS,
} from "./spoiler";

const FIXTURE = new URL("../test/spoilers/dsjF6gGsH.json", import.meta.url);
const text = readFileSync(FIXTURE, "utf8");
const whole = JSON.parse(text) as {
  all_items: { item: string; location: Loc }[];
  summary: { step: number; items: { item: string; location: Loc }[] }[];
  [key: string]: unknown;
};

interface Loc {
  area: string;
  node: string;
  node_id: number;
  room: string;
  room_id: number;
}

function read(input: string): MapRandoLog {
  const result = parseSpoiler(input);
  if (!result.ok) throw new Error(`refused: ${result.error} ${result.detail}`);
  return result.value;
}

/** The fixture with a change, as the file's text. */
function changed(edit: (doc: typeof whole) => void): string {
  const doc = structuredClone(whole);
  edit(doc);
  return JSON.stringify(doc);
}

describe("the real log (seed dsjF6gGsH, 21 MB cut to the keys read)", () => {
  const log = read(text);

  it("is Map Rando's, with no seed id, as the file names none", () => {
    expect(log.game).toBe("sm");
    expect(log.format).toBe("map-rando");
    expect(log.seed).toEqual({ from: null, id: null });
    expect(log.skipped).toEqual([]);
    expect(log.start).toEqual([]);
  });

  it("places all 100 locations, 99 of them in a step", () => {
    expect(log.placements).toHaveLength(100);
    const outside = log.placements.filter((p) => p.sphere === null);
    expect(outside.map((p) => p.locationName)).toEqual([
      "Main Street: Speed Blocked Item",
    ]);
    expect(outside[0]?.item).toBe("missile");
    expect(log.spheres).toBe(10);
  });

  it("keys a location by room and node ids and names it room: node", () => {
    const first = whole.all_items[0] as { location: Loc };
    expect(log.placements[0]?.location).toBe(
      `${first.location.room_id}:${first.location.node_id}`,
    );
    expect(log.placements[0]?.locationName).toBe(
      `${first.location.room}: ${first.location.node}`,
    );
    expect(new Set(log.placements.map((p) => p.location)).size).toBe(100);
  });

  it("puts each item in the step the file's summary does", () => {
    const stepOf = new Map<string, number>();
    for (const { step, items } of whole.summary) {
      for (const { location } of items) {
        stepOf.set(`${location.room_id}:${location.node_id}`, step);
      }
    }
    expect(stepOf.size).toBe(99);
    for (const p of log.placements) {
      expect(p.sphere).toBe(stepOf.get(p.location) ?? null);
    }
    expect(log.placements.find((p) => p.item === "morph")?.sphere).toBe(1);
  });

  it("maps every item to the pack's id and keeps the file's name", () => {
    const [raw] = whole.all_items;
    expect(log.placements[0]).toMatchObject({
      area: raw?.location.area,
      item: "springBall",
      itemName: "SpringBall",
    });
    expect(log.extra.placed).toEqual({
      bombs: 1,
      charge: 1,
      energyTank: 14,
      grapple: 1,
      gravity: 1,
      hiJump: 1,
      ice: 1,
      missile: 46,
      morph: 1,
      plasma: 1,
      powerBomb: 10,
      reserveTank: 4,
      screwAttack: 1,
      spaceJump: 1,
      spazer: 1,
      speedBooster: 1,
      springBall: 1,
      superMissile: 10,
      varia: 1,
      wave: 1,
      xRay: 1,
    });
  });

  it("reads the objectives, the start and the pack sizes", () => {
    expect(log.extra.objectives).toEqual([
      "kraid",
      "phantoon",
      "draygon",
      "ridley",
    ]);
    expect(log.extra.startLocation).toEqual({
      name: "Ship",
      nodeId: 5,
      roomId: 8,
    });
    expect(log.extra.ammo).toEqual({
      missile: 5,
      powerBomb: 5,
      superMissile: 5,
    });
  });

  it("is what the keys of the whole file give: the fixture holds exactly them", () => {
    expect(Object.keys(whole).sort()).toEqual([...SPOILER_KEYS].sort());
    const script = readFileSync(
      new URL("../scripts/spoiler-fixture.mjs", import.meta.url),
      "utf8",
    );
    const listed = /const KEYS = \[([^\]]*)\]/.exec(script)?.[1] ?? "";
    expect([...listed.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort()).toEqual(
      [...SPOILER_KEYS].sort(),
    );
  });
});

describe("the real file", () => {
  // The 21 MB file is never in the repository: point MAP_RANDO_SPOILER at one
  // (the fixture's source) to hold the slice to it and to time it.
  const path = process.env.MAP_RANDO_SPOILER;

  it.skipIf(path === undefined)(
    "reads as its cut does, and the slice is cheap",
    () => {
      const big = readFileSync(path as string, "utf8");
      const started = performance.now();
      const result = read(big);
      const elapsed = performance.now() - started;
      expect(result).toEqual(read(text));
      console.info(
        `Map Rando spoiler: ${big.length} characters read in ${elapsed.toFixed(1)} ms`,
      );
      expect(elapsed).toBeLessThan(2000);
    },
  );
});

describe("the item and objective names", () => {
  it("follow Map Rando's enum Item (lib.rs:155-181), by index", () => {
    const variants = [
      "ETank",
      "Missile",
      "Super",
      "PowerBomb",
      "Bombs",
      "Charge",
      "Ice",
      "HiJump",
      "SpeedBooster",
      "Wave",
      "Spazer",
      "SpringBall",
      "Varia",
      "Gravity",
      "XRayScope",
      "Plasma",
      "Grapple",
      "SpaceJump",
      "ScrewAttack",
      "Morph",
      "ReserveTank",
      "WallJump",
      "Nothing",
      "SparkBooster",
      "BlueBooster",
    ];
    for (const { index, variant } of SM_ITEMS) {
      expect(variants[index]).toBe(variant);
    }
    expect(new Set(SM_ITEMS.map((i) => i.variant)).size).toBe(SM_ITEMS.length);
  });

  it("name the 19 objective flags of settings.rs:521-545", () => {
    expect(OBJECTIVES.map((o) => o.upstream)).toEqual([
      "f_DefeatedKraid",
      "f_DefeatedPhantoon",
      "f_DefeatedDraygon",
      "f_DefeatedRidley",
      "f_DefeatedSporeSpawn",
      "f_DefeatedCrocomire",
      "f_DefeatedBotwoon",
      "f_DefeatedGoldenTorizo",
      "f_DefeatedBombTorizo",
      "f_UsedBowlingStatue",
      "f_UsedAcidChozoStatue",
      "f_ClearedPitRoom",
      "f_ClearedBabyKraidRoom",
      "f_ClearedPlasmaRoom",
      "f_ClearedMetalPiratesRoom",
      "f_KilledMetroidRoom1",
      "f_KilledMetroidRoom2",
      "f_KilledMetroidRoom3",
      "f_KilledMetroidRoom4",
    ]);
  });
});

describe("refusals", () => {
  const refused = (input: string) => {
    const result = parseSpoiler(input);
    if (result.ok) throw new Error("read, expected a refusal");
    return result;
  };

  it("refuses what is not a JSON object as not-a-spoiler", () => {
    for (const input of ["", "hello", "[]", "null", "{", '{"summary": [}']) {
      expect(refused(input).error).toBe("not-a-spoiler");
    }
  });

  it("refuses a truncated file, whatever the cut", () => {
    for (let at = 0; at < text.length; at += 997) {
      expect(refused(text.slice(0, at)).error).toBe("not-a-spoiler");
    }
  });

  it("names the key a missing or misshapen part is", () => {
    expect(
      refused(changed((d) => delete (d as Record<string, unknown>).summary)),
    ).toMatchObject({
      detail: "summary",
      error: "not-a-spoiler",
    });
    expect(
      refused(
        changed((d) => {
          (d.all_items[3] as { item: unknown }).item = 7;
        }),
      ),
    ).toMatchObject({ detail: "all_items.3.item", error: "not-a-spoiler" });
    expect(refused(changed((d) => (d.missile_size = 0))).detail).toBe(
      "missile_size",
    );
    expect(refused(changed((d) => (d.all_items = []))).detail).toBe(
      "all_items",
    );
  });

  it("refuses an item the pack does not know as newer-version, naming it", () => {
    const input = changed((d) => {
      const at = (d.all_items[5] as { location: Loc }).location;
      (d.all_items[5] as { item: string }).item = "Hyperbeam";
      for (const step of d.summary) {
        for (const i of step.items) {
          if (
            i.location.room_id === at.room_id &&
            i.location.node_id === at.node_id
          )
            i.item = "Hyperbeam";
        }
      }
    });
    expect(refused(input)).toMatchObject({
      detail: "Hyperbeam",
      error: "newer-version",
    });
  });

  it("refuses an objective flag the pack does not know as newer-version", () => {
    const input = changed((d) => {
      d.objectives = ["f_DefeatedKraid", "f_DefeatedSamus"];
    });
    expect(refused(input)).toMatchObject({
      detail: "f_DefeatedSamus",
      error: "newer-version",
    });
  });

  it("refuses a file that contradicts itself: a location twice, a step's item not placed", () => {
    expect(
      refused(
        changed((d) => {
          const [first] = d.all_items;
          if (first) d.all_items.push(structuredClone(first));
        }),
      ),
    ).toMatchObject({ error: "not-a-spoiler" });
    expect(
      refused(
        changed((d) => {
          const step = d.summary[0]?.items[0];
          if (step) step.item = "Bombs";
        }),
      ),
    ).toMatchObject({ error: "not-a-spoiler" });
    expect(
      refused(
        changed((d) => {
          const step = d.summary[0];
          const second = d.summary[1]?.items[0];
          if (step && second) step.items.push(structuredClone(second));
        }),
      ),
    ).toMatchObject({ error: "not-a-spoiler" });
  });

  it("never quotes more than a short detail of the file", () => {
    const input = changed((d) => {
      (d.all_items[0] as { item: string }).item = "x".repeat(150);
    });
    expect(refused(input).detail?.length ?? 0).toBeLessThanOrEqual(80);
  });

  it("never throws, on random text or random JSON", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (s) => {
        parseSpoiler(s);
      }),
    );
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        parseSpoiler(JSON.stringify(v));
        parseSpoiler(JSON.stringify({ all_items: v, summary: v }));
      }),
    );
  });
});

describe("Nothing", () => {
  it("is a location with no item: no placement, listed as skipped once", () => {
    // Two locations hold nothing; the summary does not step on them.
    const nothing = whole.all_items.slice(0, 2).map((i) => i.location);
    const log = read(
      changed((d) => {
        for (const entry of d.all_items.slice(0, 2)) entry.item = "Nothing";
        for (const step of d.summary) {
          step.items = step.items.filter(
            (i) =>
              !nothing.some(
                (n) =>
                  n.room_id === i.location.room_id &&
                  n.node_id === i.location.node_id,
              ),
          );
        }
      }),
    );
    expect(log.skipped).toEqual(["Nothing"]);
    expect(log.placements).toHaveLength(98);
    expect(log.placements.some((p) => p.itemName === "Nothing")).toBe(false);
  });

  it("is refused when the summary still steps on it under another item", () => {
    const input = changed((d) => {
      (d.all_items[0] as { item: string }).item = "Nothing";
    });
    // Only if that location is in a step; the first one is not necessarily.
    const inStep = whole.summary.some((s) =>
      s.items.some(
        (i) =>
          i.location.room_id === whole.all_items[0]?.location.room_id &&
          i.location.node_id === whole.all_items[0]?.location.node_id,
      ),
    );
    expect(inStep).toBe(true);
    expect(parseSpoiler(input)).toMatchObject({
      error: "not-a-spoiler",
      ok: false,
    });
  });
});

describe("mapRandoEvidence", () => {
  const log = read(text);
  const bind = (run: Parameters<typeof mapRandoEvidence>[1]) =>
    bindSeed(mapRandoEvidence(log.extra, run));
  const ROOMLESS = { objectives: null, splitSpeed: null, wallJump: null };

  it("never verifies: the file names no seed", () => {
    expect(bind(ROOMLESS)).toEqual({ facts: 0, verdict: "not-verified" });
    expect(
      bind({
        objectives: ["ridley", "kraid", "draygon", "phantoon"],
        splitSpeed: false,
        wallJump: false,
      }),
    ).toEqual({ facts: 1, verdict: "not-verified" });
  });

  it("refuses other objectives, naming the fact", () => {
    const binding = bind({ ...ROOMLESS, objectives: ["kraid"] });
    expect(binding).toMatchObject({
      refusal: { error: "settings-differ" },
      verdict: "refused",
    });
    expect(
      binding.verdict === "refused" &&
        binding.refusal.detail?.startsWith("objectives"),
    ).toBe(true);
  });

  it("refuses boots or boosters the seed placed and the run's ROM lacks", () => {
    const withBoots = {
      ...log.extra,
      placed: { ...log.extra.placed, wallJump: 1 },
    };
    expect(
      bindSeed(mapRandoEvidence(withBoots, { ...ROOMLESS, wallJump: false })),
    ).toMatchObject({ refusal: { error: "settings-differ" } });
    const split = {
      ...log.extra,
      placed: { ...log.extra.placed, blueBooster: 1 },
    };
    expect(
      bindSeed(mapRandoEvidence(split, { ...ROOMLESS, splitSpeed: false })),
    ).toMatchObject({ refusal: { error: "settings-differ" } });
    // Agreeing is no refusal, and a log that places none says nothing: a
    // starting item is not in the placements.
    expect(
      bindSeed(mapRandoEvidence(withBoots, { ...ROOMLESS, wallJump: true })),
    ).toEqual({ facts: 1, verdict: "not-verified" });
    expect(bind({ ...ROOMLESS, splitSpeed: true, wallJump: true })).toEqual({
      facts: 0,
      verdict: "not-verified",
    });
  });
});
