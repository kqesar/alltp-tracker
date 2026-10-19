import { describe, expect, it } from "vitest";
import { writeSmz3 } from "../../test/smz3-rom";
import { MEMORY_RANGE, MEMORY_RANGES } from "./memory";
import { SMZ3_AUTOTRACK } from "./pack";
import { checkGame, decodeMode, readRaceFlag } from "./probes";

const header = (memory: Uint8Array) =>
  memory.subarray(
    MEMORY_RANGE["rom-header"].address,
    MEMORY_RANGE["rom-header"].address + 0x20,
  );

describe("the game check", () => {
  it("takes a samus.link seed's title, and says why it refuses another", () => {
    expect(checkGame(header(writeSmz3(new Uint8Array(0x100_0000))))).toEqual({
      ok: true,
    });
    expect(checkGame(new Uint8Array(0x20))).toMatchObject({
      code: "zero-filled",
      ok: false,
    });
    const other = new TextEncoder().encode("ALTTP+SM RANDOMIZER  ");
    expect(checkGame(other)).toMatchObject({ code: "not-smz3", ok: false });
  });
});

describe("the race flag", () => {
  it("is the first config word's bit 15, unknown when no seed wrote it", () => {
    expect(readRaceFlag(Uint8Array.of(0xb3, 0x80))).toBe("race");
    expect(readRaceFlag(Uint8Array.of(0xb3, 0x20))).toBe("open");
    expect(readRaceFlag(Uint8Array.of(0x00, 0x80))).toBe("unknown");
    expect(readRaceFlag(new Uint8Array(0))).toBe("unknown");
  });
});

describe("the mode", () => {
  it("is the game byte's: zero Zelda, negative Super Metroid, else the credits", () => {
    expect(decodeMode(Uint8Array.of(0x00, 0x00))).toBe("zelda");
    expect(decodeMode(Uint8Array.of(0xff, 0x00))).toBe("sm");
    expect(decodeMode(Uint8Array.of(0x11, 0x00))).toBe("credits");
    expect(decodeMode(new Uint8Array(0))).toBeNull();
  });
});

describe("the pack", () => {
  it("reads each game where it lives, and the requirements outside races only", () => {
    expect(SMZ3_AUTOTRACK.modes?.names).toEqual(["zelda", "sm", "credits"]);
    const forbidden = MEMORY_RANGES.filter(
      (_, index) => !SMZ3_AUTOTRACK.racePermitted[index],
    ).map(({ id }) => id);
    expect(forbidden).toEqual(["requirements", "tourian"]);
    const inMode = (mode: string) =>
      MEMORY_RANGES.filter(
        (range) =>
          !("modes" in range) ||
          (range.modes as readonly string[]).includes(mode),
      ).map(({ id }) => id);
    expect(inMode("credits")).toEqual([
      "seed",
      "rom-header",
      "requirements",
      "tourian",
      "current-game",
    ]);
    expect(inMode("zelda")).toContain("zelda-wram");
    expect(inMode("zelda")).toContain("sm-buffer");
    expect(inMode("sm")).toContain("zelda-sram");
    expect(inMode("sm")).toContain("sm-events");
  });
});
