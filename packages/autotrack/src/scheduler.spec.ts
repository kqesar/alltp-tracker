import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ALTTPR_RACE_PROFILE } from "../../../packs/alttpr/src/autotrack/race-profile";
import { bootGame, SAMPLE_PACK } from "../test/fixtures";
import { MemoryTransport } from "../test/memory-transport";
import { bus } from "./address";
import { definePack, type RangeSpec } from "./pack";
import type { PlannedRequest } from "./plan";
import { covers, defineRaceProfile } from "./race";
import type { RaceSetting } from "./race-mode";
import { Poller } from "./scheduler";

function setup(
  options: {
    race?: boolean;
    setting?: RaceSetting;
    romReadable?: boolean;
  } = {},
) {
  const memory = new Uint8Array(0x100_0000);
  bootGame(memory, { race: options.race });
  const transport = new MemoryTransport(memory);
  const poller = new Poller(SAMPLE_PACK, transport, {
    now: () => 0,
    romReadable: options.romReadable ?? true,
    setting: options.setting ?? "auto",
  });
  return { memory, poller, transport };
}

/** Whether any piece read touches bytes of a forbidden-category range. */
function readForbidden(
  pieces: readonly [number, number][],
  forbidden: readonly { address: number; size: number }[],
) {
  return pieces.some(([address, size]) =>
    forbidden.some(
      (f) => f.address < address + size && f.address + f.size > address,
    ),
  );
}

describe("Poller", () => {
  it("reports first reads and later changes, keeping the previous bytes", async () => {
    const { memory, poller } = setup();
    const first = await poller.tick();
    // The race phase first, then the casual one.
    expect(first?.changed).toEqual([
      "module",
      "items",
      "items-more",
      "overworld",
      "bottles",
      "dungeon-counts",
      "entrances",
    ]);
    expect(poller.bytes("module")[0]).toBe(0x07);
    expect(poller.has("header")).toBe(false);

    memory[bus(0x7e_0010)] = 0x09;
    memory[bus(0x7e_f341)] = 0x01;
    const second = await poller.tick(); // tick 1: only "module" is due
    expect(second?.changed).toEqual(["module"]);
    expect(poller.previous("module")[0]).toBe(0x07);
    expect(poller.bytes("module")[0]).toBe(0x09);
    const third = await poller.tick(); // tick 2: the 500 ms ranges too
    expect(third?.changed).toEqual(["items"]);
    expect(await poller.tick()).toBeNull(); // tick 3: nothing changed
    expect(() => poller.bytes("nope")).toThrow(/Unknown range/);
  });

  it("reuses its views and plans: no per-poll layout work", async () => {
    const { memory, poller, transport } = setup();
    const view = poller.bytes("items");
    const requests = new Set<PlannedRequest>();
    const read = transport.read.bind(transport);
    transport.read = (request, into, offset) => {
      requests.add(request);
      return read(request, into, offset);
    };
    for (let i = 0; i <= 40; i++) {
      memory[bus(0x7e_f340)] = i;
      await poller.tick();
    }
    expect(poller.bytes("items")).toBe(view);
    expect(view[0]).toBe(40); // tick 40 is a 500 ms tick

    // Three due sets: three race requests, and two casual ones (the 250 ms
    // set has no casual range). The same objects come back every cycle.
    expect(requests.size).toBe(5);
  });

  it("reads the race flag first on every tick, and stops casual reads on a race ROM", async () => {
    const { memory, poller, transport } = setup();
    await poller.tick();
    expect(poller.race).toMatchObject({
      active: false,
      flag: "open",
      raceLegal: false,
    });
    expect(readForbidden(transport.pieces, SAMPLE_PACK.forbiddenBytes)).toBe(
      true,
    );

    // A race seed loaded mid-session: the very next tick reads nothing forbidden.
    memory[bus(0x30_8213)] = 0x01;
    transport.pieces.length = 0;
    await poller.tick();
    await poller.tick();
    await poller.tick();
    expect(poller.race).toMatchObject({
      active: true,
      flag: "race",
      raceLegal: true,
    });
    expect(transport.pieces[0]).toEqual([0x18_0213, 1]);
    expect(readForbidden(transport.pieces, SAMPLE_PACK.forbiddenBytes)).toBe(
      false,
    );
  });

  it("lets the user override the flag, and says so", async () => {
    const { poller, transport } = setup({ race: true, setting: "off" });
    await poller.tick();
    expect(poller.race).toMatchObject({
      active: false,
      flag: "race",
      overridden: true,
    });
    expect(readForbidden(transport.pieces, SAMPLE_PACK.forbiddenBytes)).toBe(
      true,
    );
  });

  it("fails closed when ROM cannot be read: no flag, Race Mode on, no ROM read", async () => {
    const { poller, transport } = setup({ romReadable: false });
    expect(poller.unreadable).toEqual(["header"]);
    expect(poller.race).toMatchObject({ active: true, flag: "unreadable" });
    await poller.readGameCheck();
    await poller.tick();
    expect(transport.pieces.every(([address]) => address >= 0xe0_0000)).toBe(
      true,
    );
    expect(readForbidden(transport.pieces, SAMPLE_PACK.forbiddenBytes)).toBe(
      false,
    );
  });

  it("reads the game check's ranges and the race flag for the game check", async () => {
    const { poller, transport } = setup();
    await poller.readGameCheck();
    expect(transport.pieces).toEqual([
      [0x7fc0, 0x15],
      [0x18_0213, 1],
    ]);
    expect(poller.has("header")).toBe(true);
    expect(poller.race.flag).toBe("open");
  });

  it("sends nothing on a tick where nothing is due", async () => {
    const pack = definePack({
      id: "sparse",
      profile: ALTTPR_RACE_PROFILE,
      ranges: [
        {
          address: bus(0x7e_f340),
          category: "items",
          everyMs: 2000,
          id: "a",
          size: 1,
        },
        {
          address: bus(0x7e_f341),
          category: "items",
          everyMs: 3000,
          id: "b",
          size: 1,
        },
      ],
    });
    const transport = new MemoryTransport(new Uint8Array(0x100_0000));
    const poller = new Poller(pack, transport, {
      now: () => 0,
      romReadable: true,
      setting: "auto",
    });
    await poller.tick(); // t=0: both
    const after = transport.pieces.length;
    await poller.tick(); // t=1000: neither
    expect(transport.pieces.length).toBe(after);
  });
});

describe("Race Mode", () => {
  const categories = Object.keys(ALTTPR_RACE_PROFILE.categories);
  const permitted = ALTTPR_RACE_PROFILE.permitted;
  // Random packs: race-permitted ranges inside permitted memory (as packs
  // must declare them), forbidden ones anywhere in WRAM or ROM.
  const rangeArb = fc
    .tuple(
      fc.constantFrom(...categories),
      fc.nat({ max: permitted.length - 1 }),
      fc.nat({ max: 0x500 }),
      fc.integer({ max: 48, min: 1 }),
      fc.constantFrom(250, 500, 1000),
      fc.constantFrom(0xf5_f000, 0xf5_0000, 0xf5_1000, 0x18_0200, 0x00_7f00),
    )
    .map(([category, block, offset, size, everyMs, base]) => {
      if (ALTTPR_RACE_PROFILE.categories[category].permitted) {
        const area = permitted[block];
        const at = area.address + (offset % area.size);
        return {
          address: at,
          category,
          everyMs,
          size: Math.min(size, area.address + area.size - at),
        };
      }
      return { address: base + offset, category, everyMs, size };
    });
  const packArb = fc
    .array(rangeArb, { maxLength: 12, minLength: 1 })
    .map((ranges) =>
      definePack({
        id: "random",
        profile: ALTTPR_RACE_PROFILE,
        ranges: ranges.map((r, i): RangeSpec => ({ ...r, id: `r-${i}` })),
      }),
    );

  it("never sends a forbidden byte, nor one outside permitted memory, when it is on", async () => {
    const image = new Uint8Array(0x100_0000).fill(0xaa);
    await fc.assert(
      fc.asyncProperty(
        packArb,
        fc.constantFrom<RaceSetting>("on", "auto"),
        fc.constantFrom(0x01, 0x02, 0x00),
        fc.integer({ max: 12, min: 1 }),
        async (pack, setting, flagByte, ticks) => {
          // "auto" is on unless the flag reads 0x00 (open).
          fc.pre(setting === "on" || flagByte !== 0x00);
          image[0x18_0213] = flagByte;
          const memory = image;
          const transport = new MemoryTransport(memory);
          const poller = new Poller(pack, transport, {
            now: () => 0,
            romReadable: true,
            setting,
          });
          for (let i = 0; i < ticks; i++) await poller.tick();
          expect(poller.race.active).toBe(true);
          for (const [address, size] of transport.pieces) {
            expect(covers(permitted, address, size)).toBe(true);
            // Forbidden bytes read only where a permitted range covers them.
            for (const f of pack.forbiddenBytes) {
              const from = Math.max(address, f.address);
              const to = Math.min(address + size, f.address + f.size);
              if (from < to)
                expect(covers(pack.permittedBytes, from, to - from)).toBe(true);
            }
          }
          // Forbidden ranges never update in Race Mode.
          pack.ranges.forEach((range, index) => {
            if (!pack.racePermitted[index])
              expect(poller.has(range.id)).toBe(false);
          });
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe("modes (a combined ROM such as SMZ3)", () => {
  // Test data: one ROM, two games. The running game's state is in WRAM,
  // the other's in SRAM; a WRAM byte says which game runs.
  const profile = defineRaceProfile({
    categories: {
      items: { permitted: true, rule: "test" },
      state: { permitted: true, rule: "test" },
    },
    id: "test-community",
    mapping: "lorom",
    permitted: [
      [0x7e_0000, 0x7f_ffff],
      [0x70_0000, 0x70_7fff],
    ],
    source: "test",
    title: "test",
    version: "1",
  });
  const PROBE = 0xf5_0ff0;
  const ZELDA_WRAM = 0xf5_f340;
  const METROID_WRAM = 0xf5_09a2;
  const ZELDA_SRAM = 0xe0_1000;
  const METROID_SRAM = 0xe0_2000;
  const pack = definePack({
    id: "combo",
    modes: {
      decode: (bytes) =>
        bytes[0] === 0 ? "zelda" : bytes[0] === 1 ? "metroid" : null,
      names: ["zelda", "metroid"],
      range: "game",
    },
    profile,
    ranges: [
      { address: PROBE, category: "state", everyMs: 250, id: "game", size: 1 },
      {
        address: ZELDA_WRAM,
        category: "items",
        everyMs: 250,
        id: "zelda-items",
        modes: ["zelda"],
        size: 4,
      },
      {
        address: ZELDA_SRAM,
        category: "items",
        everyMs: 250,
        id: "zelda-saved",
        modes: ["metroid"],
        size: 4,
      },
      {
        address: METROID_WRAM,
        category: "items",
        everyMs: 250,
        id: "metroid-items",
        modes: ["metroid"],
        size: 4,
      },
      {
        address: METROID_SRAM,
        category: "items",
        everyMs: 250,
        id: "metroid-saved",
        modes: ["zelda"],
        size: 4,
      },
    ],
  });

  it("reads each game where the probe says it lives, and switches on a portal", async () => {
    const memory = new Uint8Array(0x100_0000);
    memory.set([1, 2, 3, 4], ZELDA_WRAM);
    memory.set([9, 9, 9, 9], METROID_SRAM);
    const transport = new MemoryTransport(memory);
    const poller = new Poller(pack, transport, {
      now: () => 0,
      romReadable: true,
      setting: "auto",
    });
    const addresses = () =>
      new Set(transport.pieces.map(([address]) => address));

    // Tick 1: the mode is unknown, so only the probe is read.
    expect((await poller.tick())?.modeChanged).toBe(true);
    expect(poller.mode).toBe("zelda");
    expect([...addresses()]).toEqual([PROBE]);

    // Tick 2: ALttP runs; Super Metroid's state is in SRAM.
    transport.pieces.length = 0;
    expect((await poller.tick())?.changed).toEqual([
      "zelda-items",
      "metroid-saved",
    ]);
    expect(addresses()).toEqual(new Set([PROBE, ZELDA_WRAM, METROID_SRAM]));
    expect(Array.from(poller.bytes("zelda-items"))).toEqual([1, 2, 3, 4]);

    // A portal: Super Metroid now runs; ALttP saved its state to SRAM and
    // WRAM holds Super Metroid's. The tick that sees it keeps no game data.
    memory[PROBE] = 1;
    memory.set([1, 2, 3, 5], ZELDA_SRAM);
    memory.set([7, 7, 7, 7], METROID_WRAM);
    memory.set([0xee, 0xee, 0xee, 0xee], ZELDA_WRAM);
    const portal = await poller.tick();
    expect(portal?.modeChanged).toBe(true);
    expect(portal?.changed).toEqual(["game"]);
    expect(poller.mode).toBe("metroid");
    expect(Array.from(poller.bytes("zelda-items"))).toEqual([1, 2, 3, 4]);

    transport.pieces.length = 0;
    await poller.tick();
    expect(addresses()).toEqual(new Set([PROBE, ZELDA_SRAM, METROID_WRAM]));
    expect(Array.from(poller.bytes("zelda-saved"))).toEqual([1, 2, 3, 5]);
    expect(Array.from(poller.bytes("metroid-items"))).toEqual([7, 7, 7, 7]);
  });

  it("falls back to the shared ranges while the probe cannot tell", async () => {
    const memory = new Uint8Array(0x100_0000);
    memory[PROBE] = 0x55;
    const transport = new MemoryTransport(memory);
    const poller = new Poller(pack, transport, {
      now: () => 0,
      romReadable: true,
      setting: "auto",
    });
    await poller.tick();
    await poller.tick();
    expect(poller.mode).toBeNull();
    expect(new Set(transport.pieces.map(([address]) => address))).toEqual(
      new Set([PROBE]),
    );
  });
});
