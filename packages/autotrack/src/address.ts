// Address spaces. Every address this package handles is in the FX Pak Pro
// space, the one the usb2snes `GetAddress` opcode takes on SNI and QUsb2Snes
// alike: ROM, SRAM and WRAM laid out linearly, independent of the cartridge's
// memory mapping. Game packs usually know SNES A-bus addresses ($7E:F340);
// `bus()` translates them once, when the pack is defined.
//
// The translation is ported from alttpo/snes (the library SNI itself uses),
// mapping/lorom/mapping.go and mapping/hirom/mapping.go at commit
// 644082b79cd30cc28a8f02ed545da286b9c4984a. See README "Address spaces".

import { DefinitionError } from "./errors";

/** The cartridge memory mapping an A-bus address is read under. */
export type MemoryMapping = "lorom" | "hirom";

/** A named, linearly mapped block of the FX Pak Pro address space. */
export interface PakRegion {
  readonly name: PakRegionName;
  /** First address, inclusive. */
  readonly start: number;
  /** Last address, inclusive. */
  readonly end: number;
}

export type PakRegionName =
  | "rom"
  | "sram"
  | "wram"
  | "vram"
  | "apu"
  | "cgram"
  | "oam"
  | "misc"
  | "ppureg"
  | "cpureg";

/**
 * The FX Pak Pro address space, from SNI's README ("FX Pak Pro Address
 * Space") and the `AddressSpace` enum in protos/sni/sni.proto. Emulator
 * bridges serve ROM, SRAM and WRAM; the other regions exist on the FX Pak
 * Pro only.
 */
export const PAK_REGIONS: readonly PakRegion[] = [
  { end: 0xdf_ffff, name: "rom", start: 0x00_0000 },
  { end: 0xef_ffff, name: "sram", start: 0xe0_0000 },
  { end: 0xf6_ffff, name: "wram", start: 0xf5_0000 },
  { end: 0xf7_ffff, name: "vram", start: 0xf7_0000 },
  { end: 0xf8_ffff, name: "apu", start: 0xf8_0000 },
  { end: 0xf9_01ff, name: "cgram", start: 0xf9_0000 },
  { end: 0xf9_041f, name: "oam", start: 0xf9_0200 },
  { end: 0xf9_04ff, name: "misc", start: 0xf9_0420 },
  { end: 0xf9_06ff, name: "ppureg", start: 0xf9_0500 },
  { end: 0xf9_08ff, name: "cpureg", start: 0xf9_0700 },
];

/** Start of each region readers use most, for `PAK.wram + 0xf340`. */
export const PAK = { rom: 0x00_0000, sram: 0xe0_0000, wram: 0xf5_0000 };

/** The region holding an FX Pak Pro address, or undefined in a hole. */
export function pakRegion(address: number): PakRegion | undefined {
  for (const region of PAK_REGIONS) {
    if (address >= region.start && address <= region.end) return region;
  }
  return undefined;
}

// util.BankToLinear: a bank:offset address folded onto 32 KiB pages.
function bankToLinear(address: number): number {
  return (address >>> 16) * 0x8000 + (address & 0x7fff);
}

function loromBusToPak(bus: number): number | undefined {
  const low = bus & 0xffff;
  if (bus >= 0xf0_0000) {
    return bus & 0x8000
      ? bankToLinear(bus & 0x3f_7fff)
      : bankToLinear(bus - 0xf0_0000) + 0xe0_0000;
  }
  if (bus >= 0x80_0000) {
    if (bus & 0x8000) return bankToLinear(bus & 0x3f_7fff);
    return low < 0x2000 ? (bus & 0x1fff) + 0xf5_0000 : undefined;
  }
  if (bus >= 0x7e_0000) return bus - 0x7e_0000 + 0xf5_0000;
  if (bus >= 0x70_0000) {
    return bus & 0x8000
      ? bankToLinear(bus & 0x3f_7fff)
      : bankToLinear(bus - 0x70_0000) + 0xe0_0000;
  }
  if (bus & 0x8000) return bankToLinear(bus & 0x3f_7fff);
  return low < 0x2000 ? (bus & 0x1fff) + 0xf5_0000 : undefined;
}

function hiromBusToPak(bus: number): number | undefined {
  const low = bus & 0xffff;
  if (bus >= 0xc0_0000) return bus & 0x3f_ffff;
  if (bus >= 0x80_0000 || (bus >= 0x00_0000 && bus < 0x40_0000)) {
    if (bus & 0x8000) return bankToLinear(bus & 0x3f_7fff);
    const bank = bus >>> 16;
    const sramBank =
      bank >= 0xa0 && bank < 0xc0
        ? bank - 0xa0
        : bank >= 0x20 && bank < 0x40
          ? bank - 0x20
          : -1;
    if (sramBank >= 0 && (bus & 0x7fff) >= 0x6000) {
      return sramBank * 0x2000 + (bus & 0x1fff) + 0xe0_0000;
    }
    return low < 0x2000 ? (bus & 0x1fff) + 0xf5_0000 : undefined;
  }
  if (bus >= 0x7e_0000) return bus - 0x7e_0000 + 0xf5_0000;
  return bus & 0x3f_ffff;
}

/**
 * Translates an SNES A-bus address to the FX Pak Pro space, or undefined for
 * an address no memory answers (an I/O register, an open-bus page). Mirrors
 * fold onto one address: $00:0010, $80:0010 and $7E:0010 all give $F50010.
 */
export function busToPak(
  bus: number,
  mapping: MemoryMapping,
): number | undefined {
  if (!Number.isInteger(bus) || bus < 0 || bus > 0xff_ffff) return undefined;
  return mapping === "lorom" ? loromBusToPak(bus) : hiromBusToPak(bus);
}

/**
 * Translates an FX Pak Pro address to the A-bus address SNI sends to
 * RetroArch, a Lua bridge or an NWA emulator (lorom/hirom PakAddressToBus).
 * ROM goes to the FastROM banks ($80+ LoROM, $C0+ HiROM), WRAM to $7E/$7F.
 */
export function pakToBus(
  pak: number,
  mapping: MemoryMapping,
): number | undefined {
  if (!Number.isInteger(pak) || pak < 0 || pak > 0xff_ffff) return undefined;
  if (pak >= 0xf5_0000) return ((pak - 0xf5_0000) & 0x1_ffff) + 0x7e_0000;
  if (mapping === "lorom") {
    if (pak >= 0xe0_0000 && pak < 0xf0_0000) {
      const linear = (pak - 0xe0_0000) & 0x7_ffff;
      const bank = (pak < 0xee_0000 ? 0x70 : 0xf0) + (linear >>> 15);
      return bank * 0x1_0000 + (linear & 0x7fff);
    }
    if (pak < 0xe0_0000) {
      const linear = pak & 0x3f_ffff;
      return (0x80 + (linear >>> 15)) * 0x1_0000 + ((linear & 0x7fff) | 0x8000);
    }
    return undefined;
  }
  if (pak >= 0xe0_0000 && pak < 0xf0_0000) {
    const linear = pak - 0xe0_0000;
    const bank = 0xa0 + ((linear >>> 13) & 0x1f);
    return bank * 0x1_0000 + (linear & 0x1fff) + 0x6000;
  }
  if (pak < 0xe0_0000) return 0xc0_0000 + (pak & 0x3f_ffff);
  return undefined;
}

/**
 * The FX Pak Pro address of an A-bus address, for pack definitions:
 * `bus(0x7ef340)` is $F5F340. Throws a DefinitionError for an unmapped
 * address, so a typo fails when the pack loads.
 */
export function bus(address: number, mapping: MemoryMapping = "lorom"): number {
  const pak = busToPak(address, mapping);
  if (pak === undefined) {
    throw new DefinitionError(
      `$${hex(address, 6)} is not mapped to memory under ${mapping}`,
    );
  }
  return pak;
}

/**
 * The FX Pak Pro block of the A-bus range `first..last` (inclusive, as specs
 * write ranges). Throws a DefinitionError when the range does not land on
 * one contiguous block: a LoROM range across a bank boundary, for instance.
 */
export function busRange(
  first: number,
  last: number,
  mapping: MemoryMapping = "lorom",
): { readonly address: number; readonly size: number } {
  const start = bus(first, mapping);
  const end = bus(last, mapping);
  const size = last - first + 1;
  if (size < 1 || end - start + 1 !== size) {
    throw new DefinitionError(
      `$${hex(first, 6)}..$${hex(last, 6)} is not one contiguous block under ${mapping}`,
    );
  }
  return { address: start, size };
}

/** Upper-case hexadecimal, zero-padded: `hex(0xf5f340, 6)` is "F5F340". */
export function hex(value: number, digits: number): string {
  return value.toString(16).toUpperCase().padStart(digits, "0");
}
