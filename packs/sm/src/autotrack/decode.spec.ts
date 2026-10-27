import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { viewOf, writeMapRando } from "../../test/sm-rom";
import { SM_ITEMS } from "../items";
import { LOCATION_KEYS, LOCATIONS } from "../locations";
import { isBossKill, OBJECTIVES } from "../objectives";
import {
  clockStraddled,
  decodeBeforePlay,
  decodeBossKills,
  decodeCollected,
  decodeGameClock,
  decodeGameState,
  decodeGoal,
  decodeInPlay,
  decodeItems,
  decodeObjectives,
  decodeSeed,
  type MemoryView,
  RTA_FRAMES_PER_SECOND,
  rtaMs,
} from "./decode";
import { MEMORY_RANGE, MEMORY_RANGES, type MemoryRangeId } from "./memory";

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

describe("decodeCollected", () => {
  // Bits 19 and 12 are Brinstar Reserve Tank Room's middle item (46:3) and
  // 230 Missile Room's (17:2), 4 The Moat's (7:3)
  it("names the locations whose bit is set", () => {
    expect(
      [
        ...(decodeCollected(game({ collected: [19, 12] })) as Set<string>),
      ].sort(),
    ).toEqual(["17:2", "46:3"]);
    expect(decodeCollected(game())).toEqual(new Set());
  });

  it("reads every bit of the array, the last byte's included", () => {
    const bits = LOCATIONS.map(({ bit }) => bit);
    const found = decodeCollected(game({ collected: bits }));
    expect(found).toEqual(new Set(LOCATION_KEYS));
    // Bit 154 is byte $D883's, the array's last used one
    expect(decodeCollected(game({ collected: [154] }))).toEqual(
      new Set(["194:2"]),
    );
  });

  it("leaves out the locations that hold Nothing, set from a new game on", () => {
    // The Moat (bit 4) holds Nothing: its bit is set at a new game
    const fresh = game({ nothing: [4] });
    expect(decodeCollected(fresh)).toEqual(new Set());
    // Collecting another location shows only that one
    expect(decodeCollected(game({ collected: [19], nothing: [4] }))).toEqual(
      new Set(["46:3"]),
    );
  });

  it("is not known when the mask names a bit the collected bits lack", () => {
    // A running game holds the mask's bits (a new game copies them in): a mask
    // that does not fit is the menus' leftovers or another ROM's
    const memory = writeMapRando(image(), {});
    memory[MEMORY_RANGE["nothing-mask"].address] |= 0x10;
    expect(decodeCollected(viewOf(memory))).toBe("not-read");
    // The same mask, with its bit set in the collected bits, is read
    memory[MEMORY_RANGE.collected.address] |= 0x10;
    expect(decodeCollected(viewOf(memory))).toEqual(new Set());
    // Whichever byte of the mask it is in
    const last = writeMapRando(image(), { collected: [154] });
    last[MEMORY_RANGE["nothing-mask"].address + 19] |= 0x08;
    expect(decodeCollected(viewOf(last))).toBe("not-read");
  });

  it("never names a masked location, and is known only when the bits cover the mask", () => {
    const bytes = fc.uint8Array({ maxLength: 0x14, minLength: 0x14 });
    fc.assert(
      fc.property(bytes, bytes, (mask, extra) => {
        const view = (collected: Uint8Array) =>
          ({
            bytes: (id: string) => (id === "collected" ? collected : mask),
            has: () => true,
          }) satisfies MemoryView;
        // A running game: the mask's bits, and whatever else was collected
        const covering = extra.map((byte, i) => byte | mask[i]);
        const found = decodeCollected(view(covering));
        expect(typeof found).toBe("object");
        for (const { bit, key } of LOCATIONS) {
          const masked = (mask[bit >> 3] & (1 << (bit & 7))) !== 0;
          const set = (extra[bit >> 3] & (1 << (bit & 7))) !== 0;
          expect((found as Set<string>).has(key)).toBe(!masked && set);
        }
        // Any mask bit the collected bits lack: not known
        const lacking = covering.map((byte, i) => byte & ~mask[i]);
        if (mask.some((byte) => byte !== 0)) {
          expect(decodeCollected(view(lacking))).toBe("not-read");
        }
      }),
    );
  });

  it("is not known unless both ranges were read", () => {
    const memory = writeMapRando(image(), { collected: [19] });
    expect(decodeCollected(viewOf(memory, ["collected"]))).toBe("not-read");
    expect(decodeCollected(viewOf(memory, ["nothing-mask"]))).toBe("not-read");
    expect(decodeCollected(viewOf(memory))).toEqual(new Set(["46:3"]));
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

  it("is not known without the table or either flag range: Race Mode's case", () => {
    const memory = writeMapRando(image(), {
      done: ["kraid"],
      objectives: ["kraid"],
    });
    for (const id of [
      "objective-count",
      "objective-flags",
      "events",
      "boss-flags",
    ] as const) {
      expect(decodeObjectives(viewOf(memory, [id])), id).toBe("not-read");
    }
  });

  it("calls a boss kill what the game's boss flags hold, and nothing else", () => {
    expect(OBJECTIVES.filter(isBossKill).map(({ id }) => id)).toEqual([
      "kraid",
      "phantoon",
      "draygon",
      "ridley",
      "sporeSpawn",
      "crocomire",
      "botwoon",
      "goldenTorizo",
      "bombTorizo",
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

describe("decodeBossKills", () => {
  it("names the objectives a boss kill completes, the seed's or not", () => {
    // The one rule found for Map Rando races permits "items and boss kills":
    // Race Mode reads these alone, the player saying which the seed asks for
    const kills = decodeBossKills(
      viewOf(
        writeMapRando(image(), {
          done: ["ridley", "botwoon", "bombTorizo", "metroidRoom1", "pitRoom"],
          objectives: [],
        }),
        ["events", "objective-count", "objective-flags", "seed"],
      ),
    );
    expect(kills).toEqual(["ridley", "botwoon", "bombTorizo"]);
  });

  it("is not known before the boss flags are read", () => {
    expect(
      decodeBossKills(viewOf(writeMapRando(image()), ["boss-flags"])),
    ).toBe("not-read");
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

describe("decodeBeforePlay", () => {
  it("is before play in the states of the title, the menus and the loading of a game", () => {
    for (const state of [0x00, 0x04, 0x06, 0x1f]) {
      expect(decodeBeforePlay(game({ state })), `$${state}`).toBe(true);
      expect(decodeGameState(game({ state }))).toBe(state);
    }
    // In play, paused, in a door, dying, escaping or in the credits
    for (const state of [0x07, 0x08, 0x09, 0x0c, 0x0e, 0x13, 0x26, 0x27]) {
      expect(decodeBeforePlay(game({ state })), `$${state}`).toBe(false);
    }
    expect(decodeBeforePlay(viewOf(image(), ["game-state"]))).toBe("not-read");
  });
});

describe("decodeGoal", () => {
  it("is the goal once the escape is set and Samus is in the ship, states $26 and $27", () => {
    expect(decodeGoal(game({ escaping: true, state: 0x26 }))).toBe(true);
    expect(decodeGoal(game({ escaping: true, state: 0x27 }))).toBe(true);
    // Escaping, not yet at the ship
    expect(decodeGoal(game({ escaping: true, state: 0x08 }))).toBe(false);
    // The states alone: the escape was not set
    expect(decodeGoal(game({ state: 0x27 }))).toBe(false);
    expect(decodeGoal(game({ state: 0x26 }))).toBe(false);
  });

  it("is not known before the state and the events are read", () => {
    expect(decodeGoal(viewOf(image(), ["game-state"]))).toBe("not-read");
    expect(decodeGoal(viewOf(image(), ["events"]))).toBe("not-read");
  });
});

describe("decodeGameClock", () => {
  it("adds the NMI counter to the frames flushed to SRAM", () => {
    expect(
      decodeGameClock(game({ clock: { pending: 200, saved: 1_000 } })),
    ).toEqual({ frames: 1_200, pending: 200, saved: 1_000 });
  });

  it("reads all four bytes of the SRAM word", () => {
    const saved = 0x0012_34ff;
    expect(decodeGameClock(game({ clock: { pending: 1, saved } }))).toEqual({
      frames: saved + 1,
      pending: 1,
      saved,
    });
    // An hour of play is 216 000 frames, past a 16-bit word
    expect(
      decodeGameClock(game({ clock: { pending: 0, saved: 216_000 } })),
    ).toMatchObject({ frames: 216_000 });
  });

  it("is not known unless both parts were read", () => {
    expect(decodeGameClock(viewOf(image(), ["rta-saved"]))).toBe("not-read");
    expect(decodeGameClock(viewOf(image(), ["rta-pending"]))).toBe("not-read");
  });

  it("counts at the rate Map Rando's credits do", () => {
    expect(RTA_FRAMES_PER_SECOND).toBe(60.098_811_86);
    // 60.0988 frames are a second, not 60
    expect(rtaMs(60)).toBe(998);
    expect(rtaMs(216_000)).toBe(3_594_081);
  });
});

describe("clockStraddled", () => {
  const at = (saved: number, pending: number) => ({
    frames: saved + pending,
    pending,
    saved,
  });

  it("tells a flush between the two reads: the counter went back, the SRAM word did not move", () => {
    // 250 frames held, then the SRAM word is read before the flush adds them
    // and the counter after it zeroed them
    expect(clockStraddled(at(1_000, 250), at(1_000, 3))).toBe(true);
  });

  it("lets a flush through whole, and a clock that only moves on", () => {
    // The flush adds what the counter held: the word went up
    expect(clockStraddled(at(1_000, 250), at(1_255, 3))).toBe(false);
    expect(clockStraddled(at(1_000, 20), at(1_000, 80))).toBe(false);
    // Paused: the same two parts
    expect(clockStraddled(at(1_000, 20), at(1_000, 20))).toBe(false);
    // The first reading has nothing to straddle
    expect(clockStraddled(undefined, at(1_000, 3))).toBe(false);
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
        const collected = decodeCollected(view(ranges));
        if (typeof collected !== "string") {
          for (const key of collected) expect(LOCATION_KEYS).toContain(key);
          // Never a location the mask holds, whatever the bytes
          const mask = ranges["nothing-mask"];
          const bits = ranges.collected;
          if (mask && bits && mask.length >= 0x14 && bits.length >= 0x14) {
            for (const { bit, key } of LOCATIONS) {
              if (mask[bit >> 3] & (1 << (bit & 7))) {
                expect(collected.has(key)).toBe(false);
              }
            }
          }
        }
        decodeSeed(view(ranges));
        decodeInPlay(view(ranges));
        decodeBeforePlay(view(ranges));
        decodeGoal(view(ranges));
        const clock = decodeGameClock(view(ranges));
        if (typeof clock !== "string") {
          expect(clock.frames).toBe(clock.saved + clock.pending);
          expect(clock.pending).toBeLessThanOrEqual(0xff);
        }
      }),
    );
  });
});
