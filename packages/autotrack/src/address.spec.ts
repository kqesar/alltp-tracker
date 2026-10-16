import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  bus,
  busRange,
  busToPak,
  PAK_REGIONS,
  pakRegion,
  pakToBus,
} from "./address";
import { DefinitionError } from "./errors";

describe("busToPak", () => {
  // Expected values follow alttpo/snes mapping/{lorom,hirom}/mapping.go.
  it.each([
    [0x30_8213, "lorom", 0x18_0213], // the ALttPR race flag
    [0xb0_8213, "lorom", 0x18_0213], // its FastROM mirror
    [0x00_ffb0, "lorom", 0x00_7fb0], // internal header
    [0x7e_f340, "lorom", 0xf5_f340], // WRAM
    [0x7f_ffff, "lorom", 0xf6_ffff],
    [0x00_0010, "lorom", 0xf5_0010], // low WRAM mirror
    [0x80_1fff, "lorom", 0xf5_1fff],
    [0x70_0000, "lorom", 0xe0_0000], // SRAM
    [0x71_0005, "lorom", 0xe0_8005],
    [0xf0_0010, "lorom", 0xe0_0010],
    [0xc0_ffb0, "hirom", 0x00_ffb0],
    [0x40_1234, "hirom", 0x00_1234],
    [0x00_8000, "hirom", 0x00_0000],
    [0x20_6000, "hirom", 0xe0_0000], // HiROM SRAM window
    [0xa1_6005, "hirom", 0xe0_2005],
    [0x7e_0000, "hirom", 0xf5_0000],
  ] as const)("$%s under %s is $%s", (address, mapping, pak) => {
    expect(busToPak(address, mapping)).toBe(pak);
  });

  it.each([
    [0x00_2100, "lorom"], // PPU registers
    [0x80_4200, "lorom"],
    [0x00_6000, "lorom"],
    [0x80_6000, "hirom"], // no SRAM in $80-$9F
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
      fc.integer({ max: 0x3f_ffff, min: 0 }),
      fc.integer({ max: 0xed_ffff, min: 0xe0_0000 }),
      fc.integer({ max: 0xf6_ffff, min: 0xf5_0000 }),
    );
    fc.assert(
      fc.property(
        pak,
        fc.constantFrom("lorom", "hirom" as const),
        (address, mapping) => {
          // alttpo/snes's LoROM bus side masks banks with $3F: 2 MiB of ROM.
          if (mapping === "lorom" && address < 0xe0_0000)
            fc.pre(address < 0x20_0000);
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
            mapping === "hirom" &&
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
