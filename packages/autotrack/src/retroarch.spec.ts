import { describe, expect, it } from "vitest";
import { fakeRetroArch } from "../test/fake-retroarch";
import { bus, PAK } from "./address";
import { classifyReadFailure } from "./diagnostics";
import { TransportError } from "./errors";
import { planReads } from "./plan";
import {
  parseStatus,
  RETROARCH_DEVICE,
  RETROARCH_LIMITS,
  RETROARCH_URL,
  RetroArchTransport,
} from "./retroarch";

/** A LoROM game's memory, with a few bytes to find again. */
const lorom = () => {
  const memory = new Uint8Array(0x100_0000);
  memory[bus(0x7e_0010)] = 0x07;
  memory.set([0x11, 0x22, 0x33], bus(0x7e_f340));
  memory.set(new TextEncoder().encode("THE LEGEND OF ZELDA"), bus(0x00_ffc0));
  return memory;
};

/** RetroArch's transport, opened and attached. */
const attached = async (
  options: Partial<Parameters<typeof fakeRetroArch>[0]> = {},
) => {
  const retroarch = fakeRetroArch({
    mapping: "lorom",
    memory: lorom(),
    ...options,
  });
  const transport = new RetroArchTransport({
    mapping: options.mapping ?? "lorom",
    send: retroarch.send,
  });
  const bridge = await transport.open();
  const info = await transport.attach(RETROARCH_DEVICE);
  return { bridge, info, retroarch, transport };
};

/** Reads `ranges` as the poller would, into a buffer of the plan's size. */
const readRanges = async (
  transport: RetroArchTransport,
  ranges: { address: number; size: number }[],
) => {
  const plan = planReads(ranges, { gap: 0, limits: RETROARCH_LIMITS });
  const buffer = new Uint8Array(plan.size);
  for (const request of plan.requests)
    await transport.read(request, buffer, request.offset);
  return { buffer, plan };
};

describe("parseStatus", () => {
  it("reads what RetroArch says", () => {
    expect(parseStatus("GET_STATUS CONTENTLESS")).toEqual({
      game: null,
      state: "CONTENTLESS",
      system: null,
    });
    expect(
      parseStatus("GET_STATUS PLAYING super_nes,alttpr-crosskeys_0yAObedRMV\n"),
    ).toEqual({
      game: "alttpr-crosskeys_0yAObedRMV",
      state: "PLAYING",
      system: "super_nes",
    });
  });

  it("keeps a file name's commas, up to the checksum", () => {
    expect(
      parseStatus(
        "GET_STATUS PAUSED super_nes,Legend of Zelda, The - A Link to the Past (USA),crc32=777aac2f",
      ),
    ).toEqual({
      game: "Legend of Zelda, The - A Link to the Past (USA)",
      state: "PAUSED",
      system: "super_nes",
    });
  });

  it("refuses another command's reply", () => {
    expect(parseStatus("1.22.2")).toBeNull();
    expect(parseStatus("READ_CORE_MEMORY 7e0010 07")).toBeNull();
  });
});

describe("RetroArchTransport", () => {
  it("opens on RetroArch's version and attaches to the game it runs", async () => {
    const { bridge, info } = await attached();
    expect(bridge).toEqual({
      kind: "retroarch",
      url: RETROARCH_URL,
      version: "1.22.2",
    });
    expect(info).toEqual({
      device: RETROARCH_DEVICE,
      flags: [],
      name: "RetroArch",
      rom: "alttpr - seed",
      romReadable: true,
      version: "1.22.2",
    });
  });

  it("says nothing answered when nothing listens", async () => {
    const retroarch = fakeRetroArch({
      mapping: "lorom",
      memory: lorom(),
      silent: true,
    });
    const transport = new RetroArchTransport({
      mapping: "lorom",
      send: retroarch.send,
    });
    await expect(transport.open()).rejects.toMatchObject({
      code: "unreachable",
      operation: "open",
    });
    expect(retroarch.commands).toEqual(["VERSION"]);
  });

  it("reads by bus address, under the pack's mapping", async () => {
    const { retroarch, transport } = await attached();
    const { buffer, plan } = await readRanges(transport, [
      { address: bus(0x7e_0010), size: 1 },
      { address: bus(0x7e_f340), size: 3 },
      { address: bus(0x00_ffc0), size: 19 },
    ]);
    // WRAM to $7E, ROM to the FastROM banks, as SNI translates them
    expect(retroarch.commands.slice(2).sort()).toEqual([
      "READ_CORE_MEMORY 7e0010 1",
      "READ_CORE_MEMORY 7ef340 3",
      "READ_CORE_MEMORY 80ffc0 19",
    ]);
    expect(buffer[plan.rangeOffsets[0]]).toBe(0x07);
    expect([
      ...buffer.subarray(plan.rangeOffsets[1], plan.rangeOffsets[1] + 3),
    ]).toEqual([0x11, 0x22, 0x33]);
    expect(
      new TextDecoder().decode(
        buffer.subarray(plan.rangeOffsets[2], plan.rangeOffsets[2] + 19),
      ),
    ).toBe("THE LEGEND OF ZELDA");
  });

  it("reads SMZ3's header where bsnes-mercury serves it", async () => {
    const memory = new Uint8Array(0x100_0000);
    memory.set(
      new TextEncoder().encode("ZSM11.3.2"),
      bus(0x80_ffc0, "exhirom"),
    );
    const { retroarch, transport } = await attached({
      mapping: "exhirom",
      memory,
    });
    const { buffer } = await readRanges(transport, [
      { address: bus(0x80_ffc0, "exhirom"), size: 9 },
    ]);
    expect(retroarch.commands.at(-1)).toBe("READ_CORE_MEMORY c0ffc0 9");
    expect(new TextDecoder().decode(buffer)).toBe("ZSM11.3.2");
  });

  it("sends a request's pieces together", async () => {
    const { retroarch, transport } = await attached();
    const ranges = Array.from({ length: 8 }, (_, i) => ({
      address: PAK.wram + 0x1000 * i,
      size: 0x10,
    }));
    const { plan } = await readRanges(transport, ranges);
    expect(plan.requests).toHaveLength(1);
    expect(retroarch.maxInFlight()).toBe(8);
  });

  it("reads on where a reply stops short", async () => {
    const memory = lorom();
    memory.set([1, 2, 3, 4], bus(0x7e_fffe));
    const { retroarch, transport } = await attached({
      ends: [0x7f_0000],
      memory,
    });
    const { buffer } = await readRanges(transport, [
      { address: bus(0x7e_fffe), size: 4 },
    ]);
    expect([...buffer]).toEqual([1, 2, 3, 4]);
    expect(retroarch.commands.slice(2)).toEqual([
      "READ_CORE_MEMORY 7efffe 4",
      "READ_CORE_MEMORY 7f0000 2",
    ]);
  });

  it("reads nothing while RetroArch runs no game", async () => {
    const { bridge, info, retroarch, transport } = await attached({
      status: "CONTENTLESS",
    });
    expect(info.rom).toBeNull();
    const error = await readRanges(transport, [
      { address: bus(0x7e_0010), size: 1 },
    ]).catch((caught) => caught);
    expect(error).toBeInstanceOf(TransportError);
    // "no memory map defined" would blame the core: nothing was sent
    expect(retroarch.commands).toEqual(["VERSION", "GET_STATUS"]);
    expect(classifyReadFailure(error, info, bridge).cause).toBe("no-content");
  });

  it("passes on RetroArch's error, which names the core's fault", async () => {
    const { bridge, info, transport } = await attached({ core: "snes9x" });
    const error = await readRanges(transport, [
      { address: bus(0x7e_0010), size: 1 },
    ]).catch((caught) => caught);
    expect(error).toMatchObject({
      code: "device",
      detail: { reason: "no memory map defined" },
    });
    expect(classifyReadFailure(error, info, bridge)).toMatchObject({
      cause: "no-memory-map",
      evidence: "reply",
      remedy: { action: "switch-core", core: "bsnes-mercury" },
    });
  });

  it("refuses a reply it did not ask for", async () => {
    const answers = [
      ["READ_CORE_MEMORY 7e0011 07\n", "answers $7e0011"],
      ["READ_CORE_MEMORY 7e0010 07 08\n", "more bytes than asked"],
      ["READ_CORE_MEMORY 7e0010 7\n", 'holds "7"'],
      ["GET_STATUS CONTENTLESS", "is not a read's"],
      ["READ_CORE_MEMORY 7e0010\n", "is not a read's"],
    ];
    for (const [reply, why] of answers) {
      const { transport } = await attached({
        answer: (command) =>
          command.startsWith("READ_CORE_MEMORY") ? reply : undefined,
      });
      await expect(
        readRanges(transport, [{ address: bus(0x7e_0010), size: 1 }]),
      ).rejects.toMatchObject({
        code: "protocol",
        message: expect.stringContaining(why),
      });
    }
  });

  it("times out a read that gets no reply", async () => {
    const { transport } = await attached({
      answer: (command) =>
        command.startsWith("READ_CORE_MEMORY") ? null : undefined,
    });
    await expect(
      readRanges(transport, [{ address: bus(0x7e_0010), size: 1 }]),
    ).rejects.toMatchObject({ code: "timeout", operation: "read" });
  });

  it("drops the replies still on their way once closed", async () => {
    const { transport } = await attached();
    let closedWith: Error | null = null;
    transport.onClose((error) => {
      closedWith = error;
    });
    const reading = readRanges(transport, [
      { address: bus(0x7e_0010), size: 1 },
    ]);
    transport.close();
    await expect(reading).rejects.toMatchObject({ code: "closed" });
    expect(closedWith).toMatchObject({ code: "closed" });
  });

  it("wraps a command that could not be sent", async () => {
    const transport = new RetroArchTransport({
      mapping: "lorom",
      send: () => Promise.reject(new Error("Address already in use")),
    });
    await expect(transport.open()).rejects.toMatchObject({
      code: "unreachable",
      message: expect.stringContaining("Address already in use"),
    });
  });
});
