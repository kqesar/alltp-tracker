import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { viewOf, writeMapRando } from "../../test/sm-rom";
import { SM_ITEMS } from "../items";
import {
  decodeInPlay,
  decodeItems,
  decodeObjectives,
  decodeSeed,
  type MemoryView,
} from "./decode";
import { MEMORY_RANGES, type MemoryRangeId } from "./memory";

const image = () => new Uint8Array(0x100_0000);
const game = (seed: Parameters<typeof writeMapRando>[1] = {}) =>
  viewOf(writeMapRando(image(), seed));

describe("decodeItems", () => {
  it("reads the items and beams collected, by Map Rando's bits", () => {
    const counts = decodeItems(
      game({
        beams: 0x1000 | 0x0002, // charge, ice
        items: 0x0004 | 0x1000 | 0x0400 | 0x0080, // morph, bombs, wall jump, spark booster
      }),
    );
    expect(counts).toMatchObject({
      blueBooster: 0,
      bombs: 1,
      charge: 1,
      ice: 1,
      morph: 1,
      sparkBooster: 1,
      speedBooster: 0,
      wallJump: 1,
      wave: 0,
    });
  });

  it("counts packs and tanks from the maximums they raised", () => {
    const counts = decodeItems(
      game({
        maxEnergy: 99 + 3 * 100,
        maxMissiles: 25,
        maxPowerBombs: 10,
        maxReserve: 200,
        maxSupers: 15,
      }),
    );
    expect(counts).toMatchObject({
      energyTank: 3,
      missile: 5,
      powerBomb: 2,
      reserveTank: 2,
      superMissile: 3,
    });
  });

  it("counts by the seed's sizes, and a tank disabled as held", () => {
    const counts = decodeItems(
      game({
        disabledTanks: 1,
        maxEnergy: 99 + 2 * 200 - 100,
        maxMissiles: 30,
        sizes: { energy: 200, missile: 10 },
      }),
    );
    // Two 200-energy tanks, one of their 100s disabled: still two tanks
    expect(counts).toMatchObject({ energyTank: 2, missile: 3 });
  });

  it("caps a count at the full pool, and reads nothing before its ranges", () => {
    const counts = decodeItems(game({ maxMissiles: 999 }));
    expect(counts).toMatchObject({ missile: 46 });
    const unread = viewOf(writeMapRando(image()), ["pack-sizes"]);
    expect(decodeItems(unread)).toBe("not-read");
  });
});

describe("decodeObjectives", () => {
  it("lists the seed's objectives in order, each done once its flag is set", () => {
    const objectives = decodeObjectives(
      game({
        done: ["phantoon", "metroidRoom2"],
        objectives: ["phantoon", "sporeSpawn", "metroidRoom2", "pitRoom"],
      }),
    );
    expect(
      typeof objectives === "string"
        ? objectives
        : objectives.map(({ done, objective }) => [objective.id, done]),
    ).toEqual([
      ["phantoon", true],
      ["sporeSpawn", false],
      ["metroidRoom2", true],
      ["pitRoom", false],
    ]);
  });

  it("reads the count without the fast pause menu's bit, and no objective as none", () => {
    const memory = writeMapRando(image(), { objectives: ["kraid"] });
    const count = MEMORY_RANGES.find((r) => r.id === "objective-count");
    memory[(count?.address ?? 0) + 1] |= 0x80;
    expect(decodeObjectives(viewOf(memory))).toHaveLength(1);
    expect(decodeObjectives(game({ objectives: [] }))).toEqual([]);
  });
});

describe("decodeSeed", () => {
  it("reads the seed's name and presets", () => {
    const memory = writeMapRando(image(), { name: "Xk9_-a" });
    const seed = MEMORY_RANGES.find((r) => r.id === "seed")?.address ?? 0;
    // $DF:FF05: wall jump; $FF09-$FF0D: Hard, custom, Max, Bosses, Wild
    memory[seed + 0x15] = 0x01;
    memory.set([3, 0, 5, 2, 4], seed + 0x19);
    expect(decodeSeed(viewOf(memory))).toEqual({
      map: "Wild",
      name: "Xk9_-a",
      objectives: "Bosses",
      progression: "Custom",
      qol: "Max",
      skill: "Hard",
      splitSpeed: false,
      wallJump: true,
    });
  });

  it("says no name for bytes that are not one", () => {
    expect(decodeSeed(game({ name: "" }))).toMatchObject({ name: null });
    expect(decodeSeed(game({ name: "a b" }))).toMatchObject({ name: null });
  });
});

describe("decodeInPlay", () => {
  it("is in play in game states $07 and $08 only", () => {
    expect(decodeInPlay(game({ state: 0x08 }))).toBe(true);
    expect(decodeInPlay(game({ state: 0x07 }))).toBe(true);
    for (const state of [0x00, 0x06, 0x13, 0x1f, 0x27]) {
      expect(decodeInPlay(game({ state }))).toBe(false);
    }
    expect(decodeInPlay(viewOf(image(), ["game-state"]))).toBe("not-read");
  });
});

describe("the decoders on random bytes", () => {
  const ids = MEMORY_RANGES.map((range) => range.id);
  const sizes = new Map(MEMORY_RANGES.map((range) => [range.id, range.size]));
  const memory = fc.record(
    Object.fromEntries(
      ids.map((id) => [
        id,
        fc.option(
          fc.oneof(
            fc.uint8Array({
              maxLength: sizes.get(id),
              minLength: sizes.get(id),
            }),
            fc.uint8Array({ maxLength: 4 }),
          ),
          { nil: null },
        ),
      ]),
    ) as Record<MemoryRangeId, fc.Arbitrary<Uint8Array | null>>,
  );
  const view = (ranges: Record<string, Uint8Array | null>): MemoryView => ({
    bytes: (id) => ranges[id] ?? new Uint8Array(0),
    has: (id) => ranges[id] !== null && ranges[id] !== undefined,
  });
  const max = new Map(SM_ITEMS.map(({ id, max }) => [id, max]));

  it("never throw, and keep every count within the pool", () => {
    fc.assert(
      fc.property(memory, (ranges) => {
        const counts = decodeItems(view(ranges));
        if (typeof counts !== "string") {
          for (const [id, count] of Object.entries(counts)) {
            expect(Number.isInteger(count)).toBe(true);
            expect(count).toBeGreaterThanOrEqual(0);
            expect(count).toBeLessThanOrEqual(max.get(id) ?? 0);
          }
          expect(Object.keys(counts).sort()).toEqual([...max.keys()].sort());
        }
        const objectives = decodeObjectives(view(ranges));
        if (typeof objectives !== "string") {
          expect(objectives.length).toBeLessThanOrEqual(20);
        }
        decodeSeed(view(ranges));
        decodeInPlay(view(ranges));
      }),
    );
  });
});
