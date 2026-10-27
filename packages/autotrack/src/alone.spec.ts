// Gated ranges (read alone, or together), and a host's switch.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ALTTPR_RACE_PROFILE } from "../../../packs/alttpr/src/autotrack/race-profile";
import { MemoryTransport } from "../test/memory-transport";
import { bus } from "./address";
import { DefinitionError, TransportError } from "./errors";
import { type AutotrackPackSource, definePack } from "./pack";
import { Poller } from "./scheduler";

const BIG = bus(0x7f_2000);
const SIZE = 0x2000;
const POS = bus(0x7e_00a0);
const GATE = bus(0x7e_0011);
const FLAG = bus(0x30_8213);

/**
 * A pack of the dark room's shape: the game mode (500 ms, the pack's own), a
 * gate byte (500 ms, read when the assist is on: 1 read, 2 hold), a position
 * (250 ms, gated) and an 8 KiB map (alone, gated, refreshed on the position).
 */
const source = (
  over: Partial<AutotrackPackSource> = {},
): AutotrackPackSource => ({
  id: "alone",
  profile: ALTTPR_RACE_PROFILE,
  ranges: [
    {
      address: bus(0x7e_0010),
      category: "game-start",
      everyMs: 500,
      id: "mode",
      size: 1,
    },
    // Something of the pack's own the casual phase reads anyway, which the
    // gate byte (next to it, as the dark room's are) rides with
    {
      address: bus(0x7e_0012),
      category: "other",
      everyMs: 500,
      id: "own",
      size: 4,
    },
    {
      address: GATE,
      category: "other",
      everyMs: 500,
      id: "gate",
      optIn: "assist",
      size: 1,
    },
    {
      address: POS,
      category: "other",
      everyMs: 250,
      id: "pos",
      keep: (view) => view.has("gate") && view.bytes("gate")[0] === 2,
      optIn: "assist",
      size: 1,
      when: (view) => view.has("gate") && view.bytes("gate")[0] === 1,
    },
    {
      address: BIG,
      alone: true,
      category: "other",
      everyMs: 1000,
      id: "map",
      keep: (view) => view.has("gate") && view.bytes("gate")[0] === 2,
      optIn: "assist",
      refreshOn: ["pos"],
      size: SIZE,
      when: (view) => view.has("gate") && view.bytes("gate")[0] === 1,
    },
  ],
  ...over,
});

function setup(
  options: {
    race?: boolean;
    on?: boolean;
    pack?: AutotrackPackSource;
    skipped?: ReadonlySet<string>;
    onSkip?: (id: string, reason: string) => void;
  } = {},
) {
  const memory = new Uint8Array(0x100_0000);
  if (options.race) memory[FLAG] = 1;
  const transport = new MemoryTransport(memory);
  const poller = new Poller(definePack(options.pack ?? source()), transport, {
    now: () => 0,
    onSkip: options.onSkip,
    optIn: new Set(options.on === false ? [] : ["assist"]),
    romReadable: true,
    setting: "auto",
    skipped: options.skipped,
  });
  /** How many requests each tick sent, by counting the transport's reads. */
  const requests: number[] = [];
  const read = transport.read.bind(transport);
  let sent = 0;
  transport.read = (request, into, offset) => {
    sent++;
    return read(request, into, offset);
  };
  const tick = async () => {
    const before = sent;
    const update = await poller.tick();
    requests.push(sent - before);
    return update;
  };
  const touched = (address: number, size = 1) =>
    transport.pieces.filter(([a, n]) => a < address + size && address < a + n)
      .length;
  return { memory, poller, requests, tick, touched, transport };
}

describe("a gated range", () => {
  it("costs nothing while its gate is shut: no request on the ticks between", async () => {
    const shut = setup();
    const off = setup({ on: false });
    for (let i = 0; i < 12; i++) {
      await shut.tick();
      await off.tick();
    }
    // The gate byte rides in the casual request of a 500 ms tick; the ticks
    // between send nothing, not even the race flag
    expect(shut.requests).toEqual(off.requests);
    expect(shut.requests.filter((n) => n === 0)).toHaveLength(6);
    expect(shut.touched(POS)).toBe(0);
    expect(shut.touched(BIG, SIZE)).toBe(0);
    expect(shut.poller.has("pos")).toBe(false);
    expect(shut.poller.has("map")).toBe(false);
  });

  it("is read on every 250 ms tick once the gate opens, with the race flag first", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    await h.tick(); // tick 0: the gate byte is read, the gate opens at once
    expect(h.poller.has("pos")).toBe(true);
    expect(h.poller.has("map")).toBe(true);
    const before = h.transport.pieces.length;
    await h.tick(); // tick 1: between two of the pack's own
    const pieces = h.transport.pieces.slice(before);
    // The flag first, then the position: two small requests, not the map
    expect(pieces[0]).toEqual([FLAG, 1]);
    expect(pieces.some(([a]) => a === POS)).toBe(true);
    expect(pieces.some(([a]) => a === BIG)).toBe(false);
    expect(h.requests[1]).toBe(2);
  });

  it("sends the map whole, as a request of its own, on its cadence", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    h.memory[BIG + 5] = 0x58;
    await h.tick();
    const map = h.transport.pieces.filter(([a]) => a === BIG);
    expect(map).toEqual([[BIG, SIZE]]);
    expect(h.poller.bytes("map")[5]).toBe(0x58);
    // One second: ticks 1, 2 and 3 do not read it again, tick 4 does
    for (let i = 0; i < 3; i++) await h.tick();
    expect(h.touched(BIG, SIZE)).toBe(1);
    await h.tick();
    expect(h.touched(BIG, SIZE)).toBe(2);
  });

  it("reads the map at once when what it refreshes on changes", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    await h.tick();
    await h.tick();
    const before = h.touched(BIG, SIZE);
    h.memory[POS] = 0x12; // a room change, off the cadence
    await h.tick();
    expect(h.touched(BIG, SIZE)).toBe(before + 1);
  });

  it("forgets its bytes as the gate shuts, and says they changed", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    await h.tick();
    await h.tick();
    h.memory[GATE] = 0;
    await h.tick();
    await h.tick(); // the gate byte is read on a 500 ms tick
    const update = await h.tick();
    expect(h.poller.has("pos")).toBe(false);
    expect(h.poller.has("map")).toBe(false);
    expect(update === null || update.changed.includes("map")).toBe(true);
  });

  it("holds what it read while `keep` holds, and reads nothing", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    h.memory[BIG + 7] = 0x27;
    await h.tick();
    await h.tick();
    const reads = h.transport.pieces.length;
    // A menu opens over the room: the gate byte says hold
    h.memory[GATE] = 2;
    for (let i = 0; i < 8; i++) await h.tick();
    expect(h.poller.has("pos")).toBe(true);
    expect(h.poller.has("map")).toBe(true);
    expect(h.poller.bytes("map")[7]).toBe(0x27);
    // Only the gate and the game mode were read again, never a held range
    const after = h.transport.pieces.slice(reads);
    expect(after.some(([a]) => a === POS || a === BIG)).toBe(false);
    // The menu closes: it reads again, and the map as the gate just opened
    h.memory[GATE] = 1;
    await h.tick();
    await h.tick();
    await h.tick();
    expect(h.touched(BIG, SIZE)).toBeGreaterThan(1);
    // Anything else (the room is lit) lets it go
    h.memory[GATE] = 0;
    for (let i = 0; i < 3; i++) await h.tick();
    expect(h.poller.has("map")).toBe(false);
  });

  it("is never read in Race Mode, and the ticks between send nothing there", async () => {
    const h = setup({ race: true });
    h.memory[GATE] = 1;
    for (let i = 0; i < 12; i++) await h.tick();
    expect(h.poller.race.active).toBe(true);
    expect(h.touched(BIG, SIZE) + h.touched(POS) + h.touched(GATE)).toBe(0);
    expect(h.requests.filter((n) => n === 0)).toHaveLength(6);
    expect(h.poller.has("gate")).toBe(false);
  });

  it("is never read in Race Mode even through a gate that always holds", async () => {
    const open = source();
    const h = setup({
      pack: {
        ...open,
        ranges: open.ranges.map((range) =>
          range.when === undefined ? range : { ...range, when: () => true },
        ),
      },
      race: true,
    });
    for (let i = 0; i < 12; i++) await h.tick();
    expect(h.touched(BIG, SIZE) + h.touched(POS)).toBe(0);
    // Off Race Mode the same gate reads them
    h.memory[FLAG] = 0;
    for (let i = 0; i < 4; i++) await h.tick();
    expect(h.touched(BIG, SIZE)).toBeGreaterThan(0);
    expect(h.touched(POS)).toBeGreaterThan(0);
  });

  it("is dropped, and forgotten, when Race Mode comes on while it is in flight", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    await h.tick();
    await h.tick();
    expect(h.poller.has("map")).toBe(true);
    // The map's own read is when the race ROM appears: the flag turns on as
    // the 8 KiB request is in flight
    const read = h.transport.read.bind(h.transport);
    h.transport.read = async (request, into, offset) => {
      await read(request, into, offset);
      if (request.size === SIZE) h.poller.setRaceSetting("on");
    };
    h.memory[POS] = 9; // the room changes: the map is read at once
    h.memory[BIG + 1] = 0x42;
    await h.tick();
    expect(h.poller.race.active).toBe(true);
    // What came in flight is not laid, and what was held is let go
    expect(h.poller.has("map")).toBe(false);
    expect(h.poller.has("pos")).toBe(false);
    expect(h.poller.bytes("map")[1]).not.toBe(0x42);
  });

  it("is not laid back by a read in flight as its switch goes off", async () => {
    const h = setup();
    h.memory[GATE] = 1;
    await h.tick();
    await h.tick();
    const read = h.transport.read.bind(h.transport);
    h.transport.read = async (request, into, offset) => {
      await read(request, into, offset);
      if (request.size === SIZE) h.poller.setOptIn("assist", false);
    };
    h.memory[POS] = 9;
    await h.tick();
    expect(h.poller.has("map")).toBe(false);
    expect(h.poller.has("pos")).toBe(false);
    expect(h.poller.has("gate")).toBe(false);
  });
});

describe("a gated range whose read fails", () => {
  it("is skipped from then on, said in `unreadable`, and the tick goes on", async () => {
    const skipped: string[] = [];
    const h = setup({ onSkip: (id) => skipped.push(id) });
    h.memory[GATE] = 1;
    await h.tick();
    const read = h.transport.read.bind(h.transport);
    let failing = true;
    h.transport.read = async (request, into, offset) => {
      if (failing && request.size === SIZE) {
        throw new TransportError("timeout", "read", "no answer");
      }
      return read(request, into, offset);
    };
    h.memory[POS] = 9; // asks for the map at once
    await expect(h.tick()).resolves.not.toThrow();
    expect(skipped).toEqual(["map"]);
    expect(h.poller.unreadable).toEqual(["map"]);
    expect(h.poller.has("map")).toBe(false);
    // The rest of the tick, and the pack's own ranges, went on
    expect(h.poller.has("pos")).toBe(true);
    // It is not asked for again, even once the device answers
    failing = false;
    const before = h.touched(BIG, SIZE);
    for (let i = 0; i < 8; i++) await h.tick();
    expect(h.touched(BIG, SIZE)).toBe(before);
    expect(h.poller.has("pos")).toBe(true);
  });

  it("is not read at all on a device that failed it before", async () => {
    const h = setup({ skipped: new Set(["map"]) });
    h.memory[GATE] = 1;
    for (let i = 0; i < 6; i++) await h.tick();
    expect(h.touched(BIG, SIZE)).toBe(0);
    expect(h.poller.has("pos")).toBe(true);
    expect(h.poller.unreadable).toEqual(["map"]);
  });

  it("never fails the game's own reads' error, which still ends the tick", async () => {
    const h = setup();
    h.transport.read = async () => {
      throw new TransportError("closed", "read", "gone");
    };
    await expect(h.poller.tick()).rejects.toThrow("gone");
  });
});

describe("steady polls", () => {
  it("count only on ticks that read a range of the pack's own", async () => {
    const { poller, tick } = setup();
    // The mode (500 ms) is the pack's own; the assist's ranges fall due on
    // the ticks between: those say nothing of a game standing still
    const base: boolean[] = [];
    for (let i = 0; i < 6; i++) {
      await tick();
      base.push(poller.readBase);
    }
    expect(base).toEqual([true, false, true, false, true, false]);
  });
});

describe("an opt-in switch", () => {
  it("keeps its ranges unread, and every request away, while off", async () => {
    const h = setup({ on: false });
    h.memory[GATE] = 1;
    for (let i = 0; i < 6; i++) await h.tick();
    expect(h.poller.has("gate")).toBe(false);
    expect(h.poller.has("map")).toBe(false);
    expect(h.touched(GATE) + h.touched(POS) + h.touched(BIG, SIZE)).toBe(0);
  });

  it("reads them once turned on, and forgets them when turned off", async () => {
    const h = setup({ on: false });
    h.memory[GATE] = 1;
    await h.tick();
    h.poller.setOptIn("assist", true);
    await h.tick();
    await h.tick();
    await h.tick();
    expect(h.poller.has("gate")).toBe(true);
    expect(h.poller.has("map")).toBe(true);
    h.poller.setOptIn("assist", false);
    expect(h.poller.has("gate")).toBe(false);
    expect(h.poller.has("pos")).toBe(false);
    expect(h.poller.has("map")).toBe(false);
    const update = await h.tick();
    expect(update?.changed).toEqual(
      expect.arrayContaining(["gate", "pos", "map"]),
    );
  });

  it("ignores a name no range uses", () => {
    const { poller } = setup();
    expect(() => poller.setOptIn("nope", true)).not.toThrow();
  });
});

describe("Race Mode and gated or opt-in ranges, over random packs", () => {
  /** A forbidden-category range with any mix of switch, gate, keep and alone. */
  const rangeArb = fc.record({
    alone: fc.boolean(),
    everyMs: fc.constantFrom(250, 500, 1000),
    gated: fc.boolean(),
    keep: fc.boolean(),
    offset: fc.integer({ max: 0x3fff, min: 0 }),
    optIn: fc.boolean(),
    size: fc.integer({ max: 0x2000, min: 1 }),
  });

  it("never sends a forbidden byte on a tick where Race Mode is on", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(rangeArb, { maxLength: 5, minLength: 1 }),
        fc.boolean(),
        async (specs, switchOn) => {
          const base = source();
          const extra = specs.map((spec, i) => ({
            address: bus(0x7f_0000 + spec.offset),
            alone: spec.gated && spec.alone ? true : undefined,
            category: "other",
            everyMs: spec.everyMs,
            id: `r-${i}`,
            keep: spec.gated && spec.keep ? () => true : undefined,
            optIn: spec.optIn ? "assist" : undefined,
            size: spec.size,
            when: spec.gated ? () => true : undefined,
          }));
          const pack = definePack({
            ...base,
            ranges: [base.ranges[0], ...extra],
          });
          const memory = new Uint8Array(0x100_0000);
          memory[FLAG] = 1;
          const transport = new MemoryTransport(memory);
          const poller = new Poller(pack, transport, {
            now: () => 0,
            optIn: new Set(switchOn ? ["assist"] : []),
            romReadable: true,
            setting: "auto",
          });
          for (let i = 0; i < 9; i++) await poller.tick();
          expect(poller.race.active).toBe(true);
          const forbidden = pack.forbiddenBytes;
          const reads = transport.pieces.some(([address, size]) =>
            forbidden.some(
              (f) => f.address < address + size && address < f.address + f.size,
            ),
          );
          expect(reads).toBe(false);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe("definePack and gated ranges", () => {
  const withMap = (map: Record<string, unknown>) =>
    source({
      ranges: [
        {
          address: BIG,
          category: "other",
          everyMs: 1000,
          id: "map",
          size: 16,
          ...map,
        },
      ],
    });

  it("refuses a race-permitted category, and a gate without its cadence", () => {
    expect(() =>
      definePack(withMap({ alone: true, category: "items", when: () => true })),
    ).toThrow(DefinitionError);
    expect(() =>
      definePack(withMap({ everyMs: undefined, when: () => true })),
    ).toThrow(/needs everyMs/);
  });

  it("refuses keep, alone or refreshOn without a gate, and refreshOn without alone", () => {
    expect(() => definePack(withMap({ alone: true }))).toThrow(/need when/);
    expect(() => definePack(withMap({ keep: () => true }))).toThrow(
      /need when/,
    );
    expect(() =>
      definePack(withMap({ refreshOn: ["map"], when: () => true })),
    ).toThrow(/needs alone/);
  });

  it("refuses an unknown refreshOn id and more than eight switches", () => {
    expect(() =>
      definePack(
        withMap({ alone: true, refreshOn: ["nope"], when: () => true }),
      ),
    ).toThrow(/unknown range "nope"/);
    const ranges = Array.from({ length: 9 }, (_, i) => ({
      address: bus(0x7e_0100 + i),
      category: "other",
      everyMs: 500,
      id: `r-${i}`,
      optIn: `s-${i}`,
      size: 1,
    }));
    expect(() => definePack(source({ ranges }))).toThrow(/at most 8/);
  });
});

describe("an alone range refreshed on another alone range", () => {
  /** A second big span, listed first, refreshed on the map's change. */
  const picture = {
    address: bus(0x7e_2000),
    alone: true,
    category: "other",
    everyMs: 5000,
    id: "picture",
    optIn: "assist",
    refreshOn: ["map"],
    size: SIZE,
    when: (view: { has(id: string): boolean; bytes(id: string): Uint8Array }) =>
      view.has("gate") && view.bytes("gate")[0] === 1,
  };

  it("is read after it, so the map's change is seen on the same tick", async () => {
    const pack = source({ ranges: [picture, ...source().ranges] });
    const defined = definePack(pack);
    const order = defined.gated.map(({ index }) => defined.ranges[index].id);
    expect(order.indexOf("picture")).toBeGreaterThan(order.indexOf("map"));
    const h = setup({ pack });
    h.memory[GATE] = 1;
    await h.tick(); // the gate opens: both read
    for (let i = 0; i < 3; i++) await h.tick();
    const before = h.touched(bus(0x7e_2000), SIZE);
    h.memory[BIG] = 7; // the map changes
    for (let i = 0; i < 4; i++) await h.tick(); // its 1 s cadence comes
    expect(h.touched(bus(0x7e_2000), SIZE)).toBe(before + 1);
  });

  it("refuses refreshOn that loops", () => {
    const ranges = source().ranges.map((r) =>
      r.id === "map" ? { ...r, refreshOn: ["picture"] } : r,
    );
    expect(() => definePack(source({ ranges: [picture, ...ranges] }))).toThrow(
      /refreshOn loops/,
    );
  });
});
