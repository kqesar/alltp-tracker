import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  bus,
  busRange,
  busToPak,
  type MemoryMapping,
  PAK_REGIONS,
  pakRegion,
  pakToBus,
} from "./address";
import { DefinitionError } from "./errors";

describe("busToPak", () => {
  // Expected values follow alttpo/snes mapping/{lorom,hirom}/mapping.go,
  // but LoROM ROM spans 4 MiB here (address.ts, LOROM_ROM).
  it.each([
    [0x30_8213, "lorom", 0x18_0213], // the ALttPR race flag
    [0xb0_8213, "lorom", 0x18_0213], // its FastROM mirror
    [0x00_ffb0, "lorom", 0x00_7fb0], // internal header
    [0xdf_fef0, "lorom", 0x2f_fef0], // Map Rando's seed name, past 2 MiB
    [0x5f_fef0, "lorom", 0x2f_fef0],
    [0xc0_8000, "lorom", 0x20_0000],
    [0xff_ffff, "lorom", 0x3f_ffff], // the last byte of a 4 MiB LoROM
    [0x7e_f340, "lorom", 0xf5_f340], // WRAM
    [0x7f_ffff, "lorom", 0xf6_ffff],
    [0x00_0010, "lorom", 0xf5_0010], // low WRAM mirror
    [0x80_1fff, "lorom", 0xf5_1fff],
    [0x70_0000, "lorom", 0xe0_0000], // SRAM
    [0x71_0005, "lorom", 0xe0_8005],
    [0xf0_0010, "lorom", 0xe0_0010],
    [0xc0_ffb0, "hirom", 0x00_ffb0],
    [0x40_1234, "hirom", 0x00_1234],
    [0x00_8000, "hirom", 0x00_8000], // the upper half mirrors $C0:8000
    [0x80_ffc0, "hirom", 0x00_ffc0], // the header's FastROM mirror
    [0x20_6000, "hirom", 0xe0_0000], // HiROM SRAM window
    [0xa1_6005, "hirom", 0xe0_2005],
    [0x7e_0000, "hirom", 0xf5_0000],
    // ExHiROM, as the SMZ3 combined ROM uses it (alttp_sm_combo_randomizer_rom)
    [0xc0_ffc0, "exhirom", 0x00_ffc0],
    [0x80_ff50, "exhirom", 0x00_ff50], // samus.link's seed block
    [0x00_ffc0, "exhirom", 0x40_ffc0], // the header, in the second 4 MiB
    [0x40_003e, "exhirom", 0x40_003e],
    [0x7d_ffff, "exhirom", 0x7d_ffff],
    [0xa1_73fe, "exhirom", 0xe0_33fe], // which game runs, in SRAM
    [0xa0_6000, "exhirom", 0xe0_0000],
    [0xbf_7fff, "exhirom", 0xe3_ffff],
    [0x7e_d870, "exhirom", 0xf5_d870],
    [0x80_1fff, "exhirom", 0xf5_1fff],
  ] as const)("$%s under %s is $%s", (address, mapping, pak) => {
    expect(busToPak(address, mapping)).toBe(pak);
  });

  it.each([
    [0x00_2100, "lorom"], // PPU registers
    [0x80_4200, "lorom"],
    [0x00_6000, "lorom"],
    [0x80_6000, "hirom"], // no SRAM in $80-$9F
    [0x80_6000, "exhirom"],
    [0x3e_8000, "exhirom"], // ROM SNI sends elsewhere
    [0x3f_ffff, "exhirom"],
    [0x00_2100, "exhirom"],
    [0x1_000000, "lorom"],
    [-1, "lorom"],
    [1.5, "hirom"],
  ] as const)("$%s under %s is unmapped", (address, mapping) => {
    expect(busToPak(address, mapping)).toBeUndefined();
  });
});

describe("pakToBus", () => {
  it.each([
    [0x18_0213, "lorom", 0xb0_8213],
    [0x00_7fb0, "lorom", 0x80_ffb0],
    [0xf5_f340, "lorom", 0x7e_f340],
    [0xe0_8005, "lorom", 0x71_0005],
    [0x00_ffb0, "hirom", 0xc0_ffb0],
    [0xe0_2005, "hirom", 0xa1_6005],
    // alttpo/snes mapping/exhirom/mapping_test.go
    [0x00_7fc0, "exhirom", 0xc0_7fc0],
    [0x80_7fc0, "exhirom", 0x00_ffc0],
    [0x80_0000, "exhirom", 0x00_8000],
    [0x9f_ffff, "exhirom", 0x3f_ffff],
    [0xbf_0000, "exhirom", 0xfe_8000], // past WRAM's banks
    [0x40_ffc0, "exhirom", 0x40_ffc0],
    [0x7e_0000, "exhirom", 0x3e_8000],
    [0xe0_33fe, "exhirom", 0xa1_73fe],
  ] as const)("$%s under %s is $%s", (pak, mapping, address) => {
    expect(pakToBus(pak, mapping)).toBe(address);
  });

  it("leaves the hole between SRAM and WRAM unmapped", () => {
    expect(pakToBus(0xf0_0000, "lorom")).toBeUndefined();
    expect(pakToBus(0xf4_ffff, "hirom")).toBeUndefined();
    expect(pakToBus(0x1_000000, "lorom")).toBeUndefined();
  });

  it("round-trips ROM, SRAM and WRAM through the bus", () => {
    const pak = fc.oneof(
      fc.integer({ max: 0x7d_ffff, min: 0 }),
      fc.integer({ max: 0xed_ffff, min: 0xe0_0000 }),
      fc.integer({ max: 0xf6_ffff, min: 0xf5_0000 }),
    );
    fc.assert(
      fc.property(
        pak,
        fc.constantFrom("lorom", "hirom", "exhirom" as const),
        (address, mapping) => {
          // ROM past 4 MiB is ExHiROM's alone
          if (mapping !== "exhirom")
            fc.pre(address < 0x40_0000 || address >= 0xe0_0000);
          // LoROM SRAM banks $70-$7D hold 448 KiB; $7E is WRAM.
          if (
            mapping === "lorom" &&
            address >= 0xe0_0000 &&
            address < 0xf0_0000
          ) {
            fc.pre(address < 0xe7_0000);
          }
          // HiROM SRAM windows ($A0-$BF:6000-7FFF) hold 256 KiB.
          if (
            mapping !== "lorom" &&
            address >= 0xe0_0000 &&
            address < 0xf0_0000
          ) {
            fc.pre(address < 0xe4_0000);
          }
          const onBus = pakToBus(address, mapping);
          expect(onBus).toBeDefined();
          expect(busToPak(onBus as number, mapping)).toBe(address);
        },
      ),
    );
  });
});

/**
 * The ROM byte a cartridge answers at an A-bus address, from the hardware's
 * memory maps rather than address.ts: where SNI's translation must land.
 * WRAM banks and the lower halves of LoROM banks hold no ROM here.
 */
const cartridgeRom = (
  address: number,
  mapping: MemoryMapping,
): number | undefined => {
  const bank = address >>> 16;
  const offset = address & 0xffff;
  if (bank === 0x7e || bank === 0x7f) return undefined;
  if (mapping === "lorom") {
    return offset >= 0x8000
      ? ((bank & 0x7f) << 15) | (offset & 0x7fff)
      : undefined;
  }
  // HiROM: banks $40-$7D and $C0-$FF whole, the others' upper halves
  const rom =
    bank & 0x40 || offset >= 0x8000
      ? ((bank & 0x3f) << 16) | offset
      : undefined;
  if (rom === undefined || mapping === "hirom") return rom;
  // ExHiROM: banks $00-$7D are the second 4 MiB
  return bank & 0x80 ? rom : rom | 0x40_0000;
};

describe("the bytes SNI reads back", () => {
  it.each(["lorom", "hirom", "exhirom"] as const)(
    "are the cartridge's own under %s, through every ROM mirror",
    (mapping) => {
      fc.assert(
        fc.property(fc.integer({ max: 0xff_ffff, min: 0 }), (address) => {
          const rom = cartridgeRom(address, mapping);
          const pak = busToPak(address, mapping);
          fc.pre(rom !== undefined && pak !== undefined && pak < 0xe0_0000);
          // SNI sends RetroArch the A-bus address of the Pak one
          const sent = pakToBus(pak as number, mapping) as number;
          expect(cartridgeRom(sent, mapping)).toBe(rom);
        }),
        { numRuns: 2000 },
      );
    },
  );
});

describe("bus and busRange", () => {
  it("translate pack definitions, and refuse what does not map", () => {
    expect(bus(0x7e_f340)).toBe(0xf5_f340);
    expect(busRange(0x7e_f000, 0x7e_f500)).toEqual({
      address: 0xf5_f000,
      size: 0x501,
    });
    expect(() => bus(0x00_2100)).toThrow(DefinitionError);
    // $00:FFFF and $01:8000 are one ROM page apart on the bus, adjacent in ROM.
    expect(busRange(0x00_fff0, 0x00_ffff)).toEqual({
      address: 0x7ff0,
      size: 16,
    });
    expect(() => busRange(0x00_fff0, 0x01_800f)).toThrow(
      /not one contiguous block/,
    );
    expect(() => busRange(0x7e_0010, 0x7e_0000)).toThrow(DefinitionError);
  });
});

describe("pakRegion", () => {
  it("finds every region and none in the holes", () => {
    for (const region of PAK_REGIONS) {
      expect(pakRegion(region.start)).toBe(region);
      expect(pakRegion(region.end)).toBe(region);
    }
    expect(pakRegion(0xf0_0000)).toBeUndefined();
    expect(pakRegion(0xf9_0900)).toBeUndefined();
  });
});
