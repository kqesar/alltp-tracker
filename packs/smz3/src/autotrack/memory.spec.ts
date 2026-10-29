import {
  assertRaceSafe,
  type ByteRange,
  planReads,
  RaceViolationError,
  USB2SNES_LIMITS,
} from "@alltp/autotrack";
import { describe, expect, it } from "vitest";
import { MEMORY_RANGE, MEMORY_RANGES, MODES } from "./memory";
import { SMZ3_AUTOTRACK } from "./pack";
import { SMZ3_RACE_PROFILE } from "./race-profile";

const CLOCK_IDS = [
  "clock-sm-live",
  "clock-sm-saved",
  "clock-zelda-live",
  "clock-zelda-saved",
] as const;
const clock = CLOCK_IDS.map((id) => MEMORY_RANGE[id]);

const overlaps = (a: ByteRange, b: ByteRange) =>
  a.address < b.address + b.size && b.address < a.address + a.size;

/** The pieces of a plan, as ranges. */
const piecesOf = (plan: ReturnType<typeof planReads>): ByteRange[] =>
  plan.requests.flatMap((request) =>
    Array.from({ length: request.pieces.length / 2 }, (_, i) => ({
      address: request.pieces[2 * i],
      size: request.pieces[2 * i + 1],
    })),
  );

/** A mode's slot in the pack's race bytes and barriers (0: unknown). */
const slot = (mode: string) => (MODES as readonly string[]).indexOf(mode) + 1;

/** What the poller reads in Race Mode in a mode: the permitted ranges only. */
const racePlan = (mode: string) =>
  planReads(
    MEMORY_RANGES.filter(
      (range, index) =>
        SMZ3_AUTOTRACK.racePermitted[index] &&
        (!("modes" in range) ||
          (range.modes as readonly string[]).includes(mode)),
    ),
    {
      barriers: SMZ3_AUTOTRACK.raceBarriers[slot(mode)],
      gap: SMZ3_AUTOTRACK.gap,
      limits: USB2SNES_LIMITS,
    },
  );

describe("the game time's ranges", () => {
  it("are one category, which the race profile forbids", () => {
    expect(clock.map((range) => range.category)).toEqual(
      CLOCK_IDS.map(() => "game-time"),
    );
    expect(SMZ3_RACE_PROFILE.categories["game-time"]?.permitted).toBe(false);
    for (const range of MEMORY_RANGES) {
      expect(SMZ3_RACE_PROFILE.categories[range.category]).toBeDefined();
    }
  });

  it("put each game's live counter where its game runs and the saved one where the other does", () => {
    expect(MEMORY_RANGE["clock-sm-live"].modes).toEqual(["sm"]);
    expect(MEMORY_RANGE["clock-zelda-live"].modes).toEqual(["zelda"]);
    expect(MEMORY_RANGE["clock-sm-saved"].modes).toEqual(["zelda", "credits"]);
    expect(MEMORY_RANGE["clock-zelda-saved"].modes).toEqual(["sm", "credits"]);
    // The buses are the sources': SRAM $A1:7A00 and $A0:643E, WRAM $7E:05B8
    // and $7E:F43E
    expect(MEMORY_RANGE["clock-sm-saved"].bus).toBe(0xa1_7a00);
    expect(MEMORY_RANGE["clock-zelda-saved"].bus).toBe(0xa0_643e);
    expect(MEMORY_RANGE["clock-sm-live"].bus).toBe(0x7e_05b8);
    expect(MEMORY_RANGE["clock-zelda-live"].bus).toBe(0x7e_f43e);
  });

  it("are read on every tick of the game's cadence", () => {
    for (const range of clock) expect(range.everyMs).toBe(1000);
  });
});

describe("the seed's guid range", () => {
  it("is its own category, which the race profile forbids", () => {
    expect(MEMORY_RANGE["seed-guid"].category).toBe("seed-guid");
    expect(MEMORY_RANGE["seed-guid"].bus).toBe(0x80_ff60);
    expect(MEMORY_RANGE["seed-guid"].size).toBe(0x20);
    expect(SMZ3_RACE_PROFILE.categories["seed-guid"]?.permitted).toBe(false);
  });

  it("lies after the seed block, in no permitted range", () => {
    const seedBlock = MEMORY_RANGE.seed;
    expect(MEMORY_RANGE["seed-guid"].address).toBeGreaterThanOrEqual(
      seedBlock.address + seedBlock.size,
    );
  });
});

describe("Race Mode", () => {
  it("never asks for the seed's guid, in any mode, and the guard stops a plan that does", () => {
    for (const mode of MODES) {
      const pieces = piecesOf(racePlan(mode));
      expect(
        pieces.some((piece) => overlaps(piece, MEMORY_RANGE["seed-guid"])),
        mode,
      ).toBe(false);
    }
    const reading = planReads([MEMORY_RANGE["seed-guid"]], {
      barriers: [],
      gap: SMZ3_AUTOTRACK.gap,
      limits: USB2SNES_LIMITS,
    });
    expect(() =>
      assertRaceSafe(reading, SMZ3_RACE_PROFILE, SMZ3_AUTOTRACK.permittedBytes),
    ).toThrow(RaceViolationError);
  });

  it("never asks for Super Metroid's counter or its saved copy, in any mode, and the guard passes", () => {
    for (const mode of MODES) {
      const plan = racePlan(mode);
      expect(() =>
        assertRaceSafe(
          plan,
          SMZ3_RACE_PROFILE,
          SMZ3_AUTOTRACK.raceBytes[slot(mode)],
        ),
      ).not.toThrow();
      const pieces = piecesOf(plan);
      // They lie in no permitted range: nothing of them is read
      for (const id of ["clock-sm-live", "clock-sm-saved"] as const) {
        expect(
          pieces.some((piece) => overlaps(piece, MEMORY_RANGE[id])),
          `${id} in ${mode}`,
        ).toBe(false);
      }
    }
  });

  it("reads Zelda's counter only inside the Zelda save it reads whole, as before", () => {
    // That 0x500-byte save is permitted, and the counter lies inside it: the
    // one overlap, which decodeGameClock never decodes in Race Mode
    const touching = (
      mode: string,
      id: "clock-zelda-live" | "clock-zelda-saved",
    ) =>
      piecesOf(racePlan(mode)).filter((piece) =>
        overlaps(piece, MEMORY_RANGE[id]),
      );
    for (const [mode, id, save] of [
      ["zelda", "clock-zelda-live", MEMORY_RANGE["zelda-wram"]],
      ["sm", "clock-zelda-saved", MEMORY_RANGE["zelda-sram"]],
    ] as const) {
      const pieces = touching(mode, id);
      expect(pieces).not.toHaveLength(0);
      for (const piece of pieces) {
        expect(piece.address).toBeGreaterThanOrEqual(save.address);
        expect(piece.address + piece.size).toBeLessThanOrEqual(
          save.address + save.size,
        );
      }
    }
    // In the credits neither is read
    expect(touching("credits", "clock-zelda-saved")).toHaveLength(0);
  });

  it("is stopped by the guard from a plan that does read Super Metroid's", () => {
    // Zelda's two lie inside the permitted Zelda save, which the guard lets
    // through by design; Super Metroid's lie in no permitted range
    for (const id of ["clock-sm-live", "clock-sm-saved"] as const) {
      const reading = planReads([MEMORY_RANGE[id]], {
        barriers: [],
        gap: SMZ3_AUTOTRACK.gap,
        limits: USB2SNES_LIMITS,
      });
      expect(() =>
        assertRaceSafe(
          reading,
          SMZ3_RACE_PROFILE,
          SMZ3_AUTOTRACK.permittedBytes,
        ),
      ).toThrow(RaceViolationError);
    }
  });
});

describe("a mode's two halves", () => {
  it("are read in one request, so a counter is paired with its game's other half", () => {
    for (const [mode, ids] of [
      ["sm", ["clock-zelda-saved", "clock-sm-live"]],
      ["zelda", ["clock-sm-saved", "clock-zelda-live"]],
      ["credits", ["clock-zelda-saved", "clock-sm-saved"]],
    ] as const) {
      const plan = planReads(
        ids.map((id) => MEMORY_RANGE[id]),
        { barriers: [], gap: SMZ3_AUTOTRACK.gap, limits: USB2SNES_LIMITS },
      );
      expect(plan.requests, mode).toHaveLength(1);
    }
  });
});
