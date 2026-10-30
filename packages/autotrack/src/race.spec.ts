import { describe, expect, it } from "vitest";
import { ALTTPR_RACE_PROFILE } from "../../../packs/alttpr/src/autotrack/race-profile";
import { DefinitionError, RaceViolationError } from "./errors";
import { planPieces, planReads, USB2SNES_LIMITS } from "./plan";
import { assertRaceSafe, covers, defineRaceProfile } from "./race";
import { raceStatus } from "./race-mode";

describe("ALTTPR_RACE_PROFILE", () => {
  it("permits exactly Race Mode's windows, in FX Pak Pro space", () => {
    // Race Mode's own windows (v2.0 lists none), LoROM, ends inclusive.
    expect(ALTTPR_RACE_PROFILE.permitted).toEqual([
      { address: 0x00_7fb0, size: 0x30 },
      { address: 0xf5_0010, size: 1 },
      { address: 0xf5_f000, size: 0x501 },
      // The Door Randomizer's pots, enemy drops and shop slots, $7F:6018-$7F:6517
      { address: 0xf6_6018, size: 0x500 },
      { address: 0x18_0213, size: 2 },
    ]);
    expect(ALTTPR_RACE_PROFILE.raceFlag).toEqual({
      address: 0x18_0213,
      openValue: 0,
      raceValue: 1,
    });
  });

  it("forbids what the profile forbids", () => {
    const forbidden = Object.entries(ALTTPR_RACE_PROFILE.categories)
      .filter(([, c]) => !c.permitted)
      .map(([name]) => name);
    expect(forbidden.sort()).toEqual([
      // The Overworld Randomizer's bonk drops, which no race reads
      "bonk-drops",
      "entrances",
      "hud",
      "navigation",
      "other",
      "prizes",
      "spheres",
    ]);
  });
});

describe("defineRaceProfile", () => {
  const base = {
    categories: { items: { permitted: true, rule: "items" } },
    id: "test",
    mapping: "lorom" as const,
    permitted: [[0x7e_f000, 0x7e_f0ff]] as const,
    source: "test",
    title: "test",
    version: "1",
  };

  it("rejects a profile that permits nothing or puts the flag outside", () => {
    expect(() =>
      defineRaceProfile({
        ...base,
        categories: { x: { permitted: false, rule: "" } },
      }),
    ).toThrow(DefinitionError);
    expect(() =>
      defineRaceProfile({
        ...base,
        raceFlag: { bus: 0x7e_f100, openValue: 0, raceValue: 1 },
      }),
    ).toThrow(/outside the permitted memory/);
  });
});

describe("covers", () => {
  it("joins abutting ranges and finds holes", () => {
    const ranges = [
      { address: 10, size: 5 },
      { address: 15, size: 5 },
    ];
    expect(covers(ranges, 10, 10)).toBe(true);
    expect(covers(ranges, 12, 8)).toBe(true);
    expect(covers(ranges, 9, 2)).toBe(false);
    expect(covers(ranges, 19, 2)).toBe(false);
  });
});

describe("assertRaceSafe", () => {
  const profile = ALTTPR_RACE_PROFILE;
  const items = { address: 0xf5_f340, size: 0x1c };
  const bottles = { address: 0xf5_f35c, size: 4 };
  const more = { address: 0xf5_f364, size: 0x10 };

  it("accepts a plan that only reads permitted ranges", () => {
    const plan = planReads([items, more], {
      barriers: [bottles],
      gap: 16,
      limits: USB2SNES_LIMITS,
    });
    expect(() => assertRaceSafe(plan, profile, [items, more])).not.toThrow();
  });

  it("refuses a plan that bridges into forbidden bytes", () => {
    const plan = planReads([items, more], { gap: 16, limits: USB2SNES_LIMITS });
    expect(() => assertRaceSafe(plan, profile, [items, more])).toThrow(
      /reads \$F5F35C, which no permitted range covers/,
    );
  });

  it("refuses a bridged byte no range names, though it is permitted memory", () => {
    // $7EF360, the rupee count, lies in the save window and in no range here:
    // reading it to discard it is still reading it
    const rupees = { address: 0xf5_f360, size: 4 };
    const plan = planReads([bottles, more], {
      gap: 16,
      limits: USB2SNES_LIMITS,
    });
    expect(planPieces(plan)).toEqual([{ address: 0xf5_f35c, size: 0x18 }]);
    expect(() => assertRaceSafe(plan, profile, [bottles, more])).toThrow(
      RaceViolationError,
    );
    // Allowed, the same bytes pass
    expect(() =>
      assertRaceSafe(plan, profile, [bottles, rupees, more]),
    ).not.toThrow();
  });

  it("refuses a plan that leaves permitted memory", () => {
    const plan = planReads([{ address: 0xf5_f4f0, size: 0x20 }], {
      gap: 0,
      limits: USB2SNES_LIMITS,
    });
    expect(() => assertRaceSafe(plan, profile, [])).toThrow(
      /outside the memory alttpr permits/,
    );
  });

  it("allows forbidden bytes a permitted range also covers", () => {
    // $7EF343 is both "has bombs" (permitted) and the bomb count (HUD).
    const plan = planReads([items], { gap: 0, limits: USB2SNES_LIMITS });
    expect(() => assertRaceSafe(plan, profile, [items])).not.toThrow();
  });
});

describe("raceStatus", () => {
  it.each([
    ["auto", "pending", true, false],
    ["auto", "race", true, false],
    ["auto", "open", false, false],
    ["auto", "unknown", true, false],
    ["auto", "unreadable", true, false],
    ["auto", "none", false, false],
    ["on", "open", true, false],
    ["off", "race", false, true],
    ["off", "pending", false, true],
    ["off", "open", false, false],
    ["off", "none", false, false],
  ] as const)(
    "%s with flag %s: active %s, overridden %s",
    (setting, flag, active, overridden) => {
      const status = raceStatus(setting, flag, true);
      expect(status.active).toBe(active);
      expect(status.overridden).toBe(overridden);
      expect(status.raceLegal).toBe(active);
      expect(raceStatus(setting, flag, false).raceLegal).toBe(true);
    },
  );
});
