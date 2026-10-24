import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MEMORY_RANGE } from "./memory";
import {
  ALTTPR_GAME_CHECK,
  ALTTPR_RACE_FLAG,
  checkGame,
  probeRaceFlag,
} from "./probes";
import { ALTTPR_RACE_PROFILE } from "./race-profile";

/**
 * The 32 header bytes from $FFC0: a 21-byte title, then the layout bytes,
 * of which $FFD5 (map mode), $FFD7 (ROM size) and $FFD8 (SRAM size) matter.
 */
function header(
  title: string,
  layout: { rom: number; map: number; sram: number },
) {
  const bytes = new Uint8Array(0x20);
  for (let i = 0; i < 21; i++) bytes[i] = title.charCodeAt(i) || 0x20;
  bytes[0x15] = layout.map;
  bytes[0x17] = layout.rom;
  bytes[0x18] = layout.sram;
  return bytes;
}

// LTTP_RND_GeneralBugfixes.asm:14-27: the original values, and the base
// patch's (fast LoROM, 16 Mbit, 32 KiB of SRAM).
const VANILLA = { map: 0x20, rom: 0x0a, sram: 0x03 };
const PATCHED = { map: 0x30, rom: 0x0b, sram: 0x05 };

describe("checkGame", () => {
  it("accepts an alttpr.com seed by its VT name", () => {
    expect(checkGame(header("VT 7P4KZ0QW3B", PATCHED))).toEqual({ ok: true });
  });

  it("rejects the original game, saying so", () => {
    expect(checkGame(header("THE LEGEND OF ZELDA", VANILLA))).toEqual({
      code: "vanilla-alttp",
      message:
        "This is the original A Link to the Past, not a randomizer seed: load a seed from alttpr.com.",
      ok: false,
    });
  });

  it("rejects a patched ROM that alttpr.com did not name", () => {
    expect(checkGame(header("THE LEGEND OF ZELDA", PATCHED))).toMatchObject({
      code: "unnamed-randomizer",
      ok: false,
    });
    // Any size but the original's means the ROM was changed: 32 Mbit here.
    const expanded = { ...PATCHED, rom: 0x0c };
    expect(checkGame(header("THE LEGEND OF ZELDA", expanded))).toMatchObject({
      code: "unnamed-randomizer",
    });
  });

  it("rejects another game", () => {
    expect(
      checkGame(header("SUPER METROID", { map: 0x30, rom: 0x0c, sram: 0x03 })),
    ).toEqual({
      code: "not-alttpr",
      message:
        "The running game is not an alttpr.com seed of A Link to the Past.",
      ok: false,
    });
    // A seed name needs its space: "VTX..." is another title.
    expect(checkGame(header("VTX GAME", PATCHED))).toMatchObject({
      code: "not-alttpr",
    });
  });

  it("points an Archipelago seed to the Archipelago board", () => {
    // AP 0.6.8's title: "AP", the world's version, the player, the seed
    expect(checkGame(header("AP510_1_42424242424", PATCHED))).toEqual({
      code: "archipelago-rom",
      message:
        "This is an Archipelago seed of A Link to the Past: Archipelago's own client tracks it into its room. Follow your slot on the Archipelago board.",
      ok: false,
    });
    // Not every title starting AP: the digits and the player are AP's
    expect(checkGame(header("APPLE GAME", PATCHED))).toMatchObject({
      code: "not-alttpr",
    });
  });

  it("calls a header of zeros unreadable rather than another game", () => {
    expect(checkGame(new Uint8Array(0x20))).toMatchObject({
      code: "zero-filled",
      ok: false,
    });
  });

  it("answers any bytes with a sentence", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 0x30 }), (bytes) => {
        const result = checkGame(bytes);
        expect(result.ok ? "ok" : result.message).toMatch(/^(ok|[A-Z].*\.)$/);
      }),
    );
  });

  it("is the pack's game check, on the header range", () => {
    const bytes = header("VT 7P4KZ0QW3B", PATCHED);
    expect(ALTTPR_GAME_CHECK.ranges).toEqual(["rom-header"]);
    expect(
      ALTTPR_GAME_CHECK.verify(
        (id) => (id === "rom-header" ? bytes : new Uint8Array(0)),
        {
          device: { id: "ra://127.0.0.1:55355", kind: "retroarch" },
          flags: [],
          name: "retroarch",
          rom: "alttpr",
          romReadable: true,
          version: "1.22.2",
        },
      ),
    ).toEqual({ ok: true });
    expect(MEMORY_RANGE["rom-header"].size).toBe(bytes.length);
  });
});

describe("probeRaceFlag", () => {
  it("reads the pair the front end writes", () => {
    // vt app/Rom.php:908-920; the base patch's default (tables.asm:997-1001).
    expect(probeRaceFlag(Uint8Array.of(0x01, 0x00))).toEqual({ state: "race" });
    expect(probeRaceFlag(Uint8Array.of(0x00, 0x01))).toEqual({ state: "open" });
  });

  it("calls a zero flag with a zero complement unreadable", () => {
    expect(probeRaceFlag(Uint8Array.of(0x00, 0x00))).toEqual({
      reason:
        "The race flag and its complement both read $00: this memory is not readable on this device, so the seed may be a race seed.",
      state: "unreadable",
    });
  });

  it("calls any other pair unknown", () => {
    expect(probeRaceFlag(Uint8Array.of(0x01, 0x01))).toEqual({
      reason:
        "The race flag reads $01 with a complement of $01, which means neither race nor open.",
      state: "unknown",
    });
    expect(probeRaceFlag(Uint8Array.of(0xff))).toMatchObject({
      state: "unknown",
    });
  });
});

describe("ALTTPR_RACE_FLAG", () => {
  it("reads two bytes at 0x308213, as the transport takes it", () => {
    // LoROM $30:8213 is ROM offset 0x180213: FX Pak Pro space.
    expect(ALTTPR_RACE_FLAG).toMatchObject({ address: 0x18_0213, size: 2 });
    // Inside Race Mode's $30:8210-$30:823F, ROM 0x180210-0x18023F.
    const { address, size } = ALTTPR_RACE_FLAG;
    expect(
      ALTTPR_RACE_PROFILE.permitted.some(
        (range) =>
          range.address <= address &&
          address + size <= range.address + range.size,
      ),
    ).toBe(true);
    expect(ALTTPR_RACE_PROFILE.permitted).toContainEqual({
      address: 0x18_0210,
      size: 0x30,
    });
  });

  it("keeps Race Mode on for anything but a readable open seed", () => {
    const decode = (...bytes: number[]) =>
      ALTTPR_RACE_FLAG.decode(Uint8Array.from(bytes));
    expect(decode(0x01, 0x00)).toBe("race");
    expect(decode(0x00, 0x01)).toBe("open");
    // Zero fill: the 0x00 flag alone would have read "open".
    expect(decode(0x00, 0x00)).toBe("unknown");
    expect(decode(0x01, 0x01)).toBe("unknown");
  });
});
