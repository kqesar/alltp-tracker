// The picture's loader over a synthetic console: hand-made tables, sheets
// and WRAM, served as the session's on-demand reads would be.
import { bus } from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import {
  ART_ROM,
  AUX_ROWS,
  GFX_BASE,
  GUARD,
  MAIN_ROWS,
  ROOM_PX,
  SHEETS,
} from "./dark-room-art";
import { createArtLoader } from "./dark-room-art-loader";
import { MEMORY_RANGE, type MemoryRangeId } from "./memory";

/** A sheet's stream: 0x600 bytes of `value` (two long byte fills). */
const sheetStream = (value: number) =>
  Uint8Array.of(0xe7, 0xff, value, 0xe5, 0xff, value, 0xff);

/** A console image (FX Pak Pro space) with the ROM's tables and sheets. */
function console() {
  const memory = new Uint8Array(0x100_0000);
  const put = (busAddress: number, bytes: ArrayLike<number>) =>
    memory.set(bytes, bus(busAddress));
  put(ART_ROM.guard, GUARD);
  const pointers = new Uint8Array(SHEETS * 3);
  for (let s = 0; s < SHEETS; s++) {
    const address = 0x91_8000 + s * 0x10;
    pointers[s] = address >> 16;
    pointers[SHEETS + s] = (address >> 8) & 0xff;
    pointers[2 * SHEETS + s] = address & 0xff;
    put(address, sheetStream(0xff));
  }
  put(ART_ROM.sheetPointers, pointers);
  const main = new Uint8Array(MAIN_ROWS * 8);
  main.set([1, 2, 3, 4, 5, 6, 7, 8], 4 * 8);
  put(ART_ROM.mainTilesets, main);
  put(ART_ROM.auxTilesets, new Uint8Array(AUX_ROWS * 4));
  return { memory, put };
}

/** The art ranges' bytes for room $55, blockset 4, BG2 naming tile 0. */
function ranges(): Partial<Record<MemoryRangeId, Uint8Array>> {
  // The OAM buffer at $0800, the blocksets and uploads from $0AA1
  const sprites = new Uint8Array(0x2fa);
  const oam = sprites.subarray(0, 0x220);
  const gfx = sprites.subarray(GFX_BASE - 0x800);
  gfx[0] = 4; // main blockset
  gfx[1] = 0; // aux
  // The animated frame at $7E:A680
  gfx[0x0adc - GFX_BASE] = 0x80;
  gfx[0x0add - GFX_BASE] = 0xa6;
  for (let i = 0; i < 128; i++) oam[i * 4 + 1] = 0xf0;
  // The view's sprite bank ($BC); BG2's scroll at 0
  const view = new Uint8Array(0x4a);
  view[0xbc - 0xa2] = 0x10;
  const palette = new Uint8Array(0x200);
  palette.set([0x1f, 0x00], 2 * 15); // colour 15 (7, sheet 0 high): red
  return {
    "dark-room-art-bg2": new Uint8Array(0x2000),
    "dark-room-art-palette": palette,
    "dark-room-art-screens": Uint8Array.of(0x16, 0),
    "dark-room-art-sprites": sprites,
    "dark-room-art-view": view,
    "dark-room-room": Uint8Array.of(0x55, 0),
    "rom-header": new Uint8Array(32).fill(0x41),
  };
}

class View {
  constructor(readonly held: Partial<Record<string, Uint8Array>>) {}
  has(id: string) {
    return this.held[id] !== undefined;
  }
  bytes(id: string) {
    const bytes = this.held[id];
    if (bytes === undefined) throw new Error(`unread ${id}`);
    return bytes;
  }
}

/** A read over `memory` that counts its calls and can fail. */
function reader(memory: Uint8Array) {
  const calls: { address: number; size: number }[][] = [];
  let failing = false;
  const read = async (
    asked: readonly { address: number; size: number }[],
  ): Promise<Uint8Array[]> => {
    calls.push([...asked]);
    if (failing) throw new Error("timeout");
    return asked.map(({ address, size }) =>
      memory.slice(address, address + size),
    );
  };
  return {
    calls,
    fail: (on: boolean) => {
      failing = on;
    },
    read,
  };
}

describe("createArtLoader", () => {
  it("waits for every range of the picture", async () => {
    const { memory } = console();
    const loader = createArtLoader(reader(memory).read);
    const held = ranges();
    delete held["dark-room-art-bg2"];
    expect(await loader.update(new View(held))).toBeNull();
  });

  it("draws the room from the ROM's sheets in the room's palette", async () => {
    const { memory } = console();
    const io = reader(memory);
    const loader = createArtLoader(io.read);
    const outcome = await loader.update(new View(ranges()));
    expect(outcome?.status).toBe("ready");
    if (outcome?.status !== "ready") return;
    const { art } = outcome;
    expect(art.room).toBe(0x55);
    expect(art.background.length).toBe(ROOM_PX * ROOM_PX);
    // Every plane set: colour 7, 15 in sheet 1, a high one (VRAM slot 0)
    expect(art.background[0] >>> 0).toBe(0xff00_00ff);
    expect(art.link).toBeNull();
    // The tables, then the sheets, the animated frame and Link's pieces at once
    expect(io.calls).toHaveLength(2);
    expect(io.calls[0].map((r) => r.address)).toEqual(
      [
        ART_ROM.guard,
        ART_ROM.sheetPointers,
        ART_ROM.auxTilesets,
        ART_ROM.mainTilesets,
      ].map((a) => bus(a)),
    );
    expect(io.calls[1]).toContainEqual({
      address: bus(0x7e_a680),
      size: 0x400,
    });
  });

  it("reads nothing again for the same room, and draws it again only on a change", async () => {
    const { memory } = console();
    const io = reader(memory);
    const loader = createArtLoader(io.read);
    const held = ranges();
    const first = await loader.update(new View(held));
    const again = await loader.update(new View(held));
    expect(io.calls).toHaveLength(2);
    if (first?.status !== "ready" || again?.status !== "ready") {
      throw new Error("not drawn");
    }
    expect(again.art.version).toBe(first.art.version);
    // A chest opened: the tilemap changed, the picture is drawn again
    held["dark-room-art-bg2"]?.set([1, 0]);
    const changed = await loader.update(new View(held));
    expect(changed?.status === "ready" && changed.art.version).toBe(
      first.art.version + 1,
    );
    expect(io.calls).toHaveLength(2);
  });

  it("shows the plan for another base patch's code, for good", async () => {
    const { memory, put } = console();
    put(ART_ROM.guard, [0xea]);
    const io = reader(memory);
    const loader = createArtLoader(io.read);
    expect(await loader.update(new View(ranges()))).toEqual({
      reason: "other-base-patch",
      status: "unavailable",
    });
    await loader.update(new View(ranges()));
    expect(io.calls).toHaveLength(1);
  });

  it("shows the plan for a blockset past the tables", async () => {
    const { memory } = console();
    const held = ranges();
    held["dark-room-art-sprites"]?.set([MAIN_ROWS], GFX_BASE - 0x800);
    const outcome = await createArtLoader(reader(memory).read).update(
      new View(held),
    );
    expect(outcome).toMatchObject({ reason: "unknown-graphics" });
  });

  it("shows the plan for a sheet that does not unpack", async () => {
    const { memory, put } = console();
    // Sheet 3's stream runs off its window
    put(0x91_8030, [0x1f, 1, 2]);
    memory.fill(0x00, bus(0x91_8033), bus(0x91_8033) + 0x700);
    const outcome = await createArtLoader(reader(memory).read).update(
      new View(ranges()),
    );
    expect(outcome).toMatchObject({ reason: "unknown-graphics" });
  });

  it("never reads a sheet that did not unpack again, the room moving or not", async () => {
    const { memory, put } = console();
    put(0x91_8030, [0x1f, 1, 2]);
    memory.fill(0x00, bus(0x91_8033), bus(0x91_8033) + 0x700);
    const io = reader(memory);
    const loader = createArtLoader(io.read);
    for (let t = 0; t < 10; t++) {
      const held = ranges();
      // An enemy moving: the OAM changes on every update
      held["dark-room-art-sprites"]?.set([t], 100);
      expect(await loader.update(new View(held))).toMatchObject({
        reason: "unknown-graphics",
      });
    }
    // The tables, then the sheets once
    expect(io.calls).toHaveLength(2);
  });

  it("pauses after a failed read, then tries again", async () => {
    const { memory } = console();
    const io = reader(memory);
    let clock = 0;
    const loader = createArtLoader(io.read, () => clock);
    io.fail(true);
    expect(await loader.update(new View(ranges()))).toMatchObject({
      reason: "read-failed",
    });
    io.fail(false);
    clock = 1000;
    expect(await loader.update(new View(ranges()))).toMatchObject({
      reason: "read-failed",
    });
    expect(io.calls).toHaveLength(1);
    clock = 6000;
    expect((await loader.update(new View(ranges())))?.status).toBe("ready");
  });

  it("forgets the ROM's tables when another ROM runs", async () => {
    const { memory } = console();
    const io = reader(memory);
    const loader = createArtLoader(io.read);
    const held = ranges();
    await loader.update(new View(held));
    held["rom-header"] = new Uint8Array(32).fill(0x42);
    await loader.update(new View(held));
    expect(io.calls).toHaveLength(4);
  });

  it("draws Link from his uploads, body from ROM, sword from WRAM", async () => {
    const { memory, put } = console();
    // Body piece 0 ($0ACE, VRAM tiles 16-17) at $10:8000: all colour 1
    put(
      0x10_8000,
      new Uint8Array(0x40)
        .fill(0)
        .map((_, i) => (i % 32 < 16 && i % 2 === 0 ? 0xff : 0)),
    );
    const held = ranges();
    const sprites = held["dark-room-art-sprites"] as Uint8Array;
    sprites[0x0ace - 0x800] = 0x00;
    sprites[0x0acf - 0x800] = 0x80;
    const oam = sprites;
    // One 8 x 8 sprite of tile 16, palette 7, at (40, 50)
    oam.set([40, 50, 16, 7 << 1], 0);
    const palette = held["dark-room-art-palette"] as Uint8Array;
    palette.set([0x00, 0x7c], 2 * (128 + 7 * 16 + 1)); // blue
    const io = reader(memory);
    const outcome = await createArtLoader(io.read).update(new View(held));
    if (outcome?.status !== "ready") throw new Error("not drawn");
    expect(outcome.art.link).toMatchObject({
      height: 8,
      width: 8,
      x: 40,
      y: 51,
    });
    expect((outcome.art.link?.pixels[0] ?? 0) >>> 0).toBe(0xffff_0000);
    expect(io.calls[1]).toContainEqual({ address: bus(0x10_8000), size: 0x40 });
  });
});

// Every range the loader reads is one of the memory map's
it("names ranges of the memory map", () => {
  for (const id of Object.keys(ranges())) {
    expect(MEMORY_RANGE[id as MemoryRangeId], id).toBeDefined();
  }
});
