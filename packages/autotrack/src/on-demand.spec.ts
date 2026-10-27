// On-demand reads: bytes at addresses only the game tells, asked for at run
// time. Casual by construction: a forbidden category only, served after the
// tick's gated reads, never in Race Mode.
import { describe, expect, it } from "vitest";
import { bootGame, SAMPLE_PACK, SAMPLE_SOURCE } from "../test/fixtures";
import { MemoryTransport } from "../test/memory-transport";
import { bus } from "./address";
import { DefinitionError, RaceViolationError, TransportError } from "./errors";
import { definePack } from "./pack";
import type { RaceSetting } from "./race-mode";
import { ON_DEMAND_MAX, Poller } from "./scheduler";

/** Two ROM bytes a table would point at, and a WRAM word. */
const ASK = {
  category: "navigation",
  ranges: [
    { address: bus(0x11_b800), size: 4 },
    { address: bus(0x7e_9040), size: 2 },
  ],
};

function setup(
  options: {
    race?: boolean;
    setting?: RaceSetting;
    romReadable?: boolean;
  } = {},
) {
  const memory = new Uint8Array(0x100_0000);
  bootGame(memory, { race: options.race });
  memory.set([1, 2, 3, 4], bus(0x11_b800));
  memory.set([9, 8], bus(0x7e_9040));
  const transport = new MemoryTransport(memory);
  const poller = new Poller(SAMPLE_PACK, transport, {
    now: () => 0,
    romReadable: options.romReadable ?? true,
    setting: options.setting ?? "auto",
  });
  return { memory, poller, transport };
}

/** The tick's settled promise, without leaving a rejection unhandled. */
const settle = <T>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );

describe("Poller.request", () => {
  it("reads the ranges on the next tick, after the race flag, and hands each one's bytes", async () => {
    const { poller, transport } = setup();
    await poller.tick(); // the flag reads open
    const asked = settle(poller.request(ASK));
    transport.pieces.length = 0;
    await poller.tick();
    expect(await asked).toEqual({
      value: [Uint8Array.of(1, 2, 3, 4), Uint8Array.of(9, 8)],
    });
    // The race phase came first: the flag, then the asked bytes
    const flag = transport.pieces.findIndex(
      ([a]) => a === SAMPLE_PACK.raceFlag?.address,
    );
    const rom = transport.pieces.findIndex(([a]) => a === bus(0x11_b800));
    expect(flag).toBeGreaterThanOrEqual(0);
    expect(rom).toBeGreaterThan(flag);
  });

  it("reads the race flag first on a tick that would not have", async () => {
    const memory = new Uint8Array(0x100_0000);
    bootGame(memory, {});
    const transport = new MemoryTransport(memory);
    // Only a range due every other tick: tick 1 has no race phase
    const pack = definePack({
      ...SAMPLE_SOURCE,
      ranges: SAMPLE_SOURCE.ranges
        .map((r) => (r.everyMs === undefined ? r : { ...r, everyMs: 500 }))
        .concat({
          address: bus(0x7e_0011),
          category: "game-start",
          everyMs: 250,
          id: "tick",
          optIn: "never",
          size: 1,
        }),
    });
    const poller = new Poller(pack, transport, {
      now: () => 0,
      romReadable: true,
      setting: "auto",
    });
    await poller.tick();
    const asked = settle(poller.request(ASK));
    transport.pieces.length = 0;
    await poller.tick();
    expect(await asked).toHaveProperty("value");
    expect(transport.pieces[0][0]).toBe(pack.raceFlag?.address);
  });

  it("is refused before the race flag is read: Race Mode until it says not", async () => {
    const { poller } = setup();
    expect(await settle(poller.request(ASK))).toEqual({
      error: expect.any(RaceViolationError),
    });
  });

  it("is refused in Race Mode, before anything is sent", async () => {
    const { poller, transport } = setup({ race: true });
    await poller.tick();
    transport.pieces.length = 0;
    const asked = await settle(poller.request(ASK));
    expect(asked).toEqual({ error: expect.any(RaceViolationError) });
    await poller.tick();
    expect(transport.pieces.some(([a]) => a === bus(0x11_b800))).toBe(false);
  });

  it("is refused, unread, when Race Mode comes on before its tick", async () => {
    const { poller, transport } = setup();
    await poller.tick();
    const asked = settle(poller.request(ASK));
    poller.setRaceSetting("on");
    transport.pieces.length = 0;
    await poller.tick();
    expect(await asked).toEqual({ error: expect.any(RaceViolationError) });
    expect(transport.pieces.some(([a]) => a === bus(0x11_b800))).toBe(false);
  });

  it("is refused, read but dropped, when Race Mode comes on while it is in flight", async () => {
    const { poller, transport } = setup();
    await poller.tick();
    const asked = settle(poller.request(ASK));
    const read = transport.read.bind(transport);
    transport.read = (request, into, offset) => {
      if (request.pieces[0] === bus(0x11_b800)) poller.setRaceSetting("on");
      return read(request, into, offset);
    };
    await poller.tick();
    expect(await asked).toEqual({ error: expect.any(RaceViolationError) });
  });

  it("refuses a permitted or unknown category, a bad range and too many bytes", async () => {
    const { poller } = setup();
    const refused = async (read: Parameters<Poller["request"]>[0]) =>
      (await settle(poller.request(read))) as { error?: unknown };
    expect((await refused({ ...ASK, category: "items" })).error).toBeInstanceOf(
      DefinitionError,
    );
    expect((await refused({ ...ASK, category: "nope" })).error).toBeInstanceOf(
      DefinitionError,
    );
    for (const range of [
      { address: bus(0x7e_0000), size: 0 },
      { address: 0xf6_ffff, size: 2 }, // WRAM's end into VRAM
      { address: 0xff_0000, size: 1 }, // a hole
    ]) {
      expect(
        (await refused({ category: "navigation", ranges: [range] })).error,
      ).toBeInstanceOf(DefinitionError);
    }
    expect(
      (
        await refused({
          category: "navigation",
          ranges: [{ address: bus(0x11_8000), size: ON_DEMAND_MAX + 1 }],
        })
      ).error,
    ).toBeInstanceOf(DefinitionError);
  });

  it("refuses ROM a device cannot read", async () => {
    const { poller } = setup({ romReadable: false });
    const asked = await settle(poller.request(ASK));
    expect(asked).toEqual({ error: expect.any(TransportError) });
  });

  it("rejects a read that fails without failing the tick, and asks again next time", async () => {
    const { poller, transport } = setup();
    await poller.tick();
    transport.script.read = (pieces) =>
      pieces.some(([a]) => a === bus(0x11_b800))
        ? new TransportError("device", "read", "no")
        : undefined;
    const asked = settle(poller.request(ASK));
    // The tick itself goes on
    await expect(poller.tick()).resolves.not.toBeUndefined();
    expect(await asked).toEqual({ error: expect.any(TransportError) });
    transport.script.read = undefined;
    const again = settle(poller.request(ASK));
    await poller.tick();
    expect(await again).toHaveProperty("value");
  });

  it("drops a read whose signal aborts while it waits, never sending it", async () => {
    const { poller, transport } = setup();
    await poller.tick();
    const controller = new AbortController();
    const asked = settle(poller.request({ ...ASK, signal: controller.signal }));
    controller.abort();
    expect(await asked).toEqual({
      error: expect.objectContaining({ name: "AbortError" }),
    });
    transport.pieces.length = 0;
    await poller.tick();
    expect(transport.pieces.some(([a]) => a === bus(0x11_b800))).toBe(false);
    // One aborted before it is asked for is refused at once
    expect(
      await settle(poller.request({ ...ASK, signal: controller.signal })),
    ).toEqual({ error: expect.objectContaining({ name: "AbortError" }) });
  });

  it("rejects what waits when the poller closes", async () => {
    const { poller } = setup();
    await poller.tick();
    const asked = settle(poller.request(ASK));
    poller.close();
    expect(await asked).toEqual({ error: expect.any(TransportError) });
  });
});
