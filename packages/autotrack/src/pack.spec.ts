import { describe, expect, it } from "vitest";
import { ALTTPR_RACE_PROFILE } from "../../../packs/alttpr/src/autotrack/race-profile";
import { SAMPLE_PACK, SAMPLE_SOURCE } from "../test/fixtures";
import { bus } from "./address";
import { DefinitionError } from "./errors";
import { type AutotrackPackSource, definePack } from "./pack";

function withRanges(
  ranges: AutotrackPackSource["ranges"],
  extra: Partial<AutotrackPackSource> = {},
) {
  return () =>
    definePack({ ...SAMPLE_SOURCE, gameCheck: undefined, ranges, ...extra });
}

const item = {
  address: bus(0x7e_f340),
  category: "items",
  everyMs: 500,
  id: "items",
  size: 4,
};

describe("definePack", () => {
  it("lays the cadences out as a cycle of due sets", () => {
    // Cadences 250, 500 and 1000 ms: a 250 ms tick, a 4-tick cycle.
    expect(SAMPLE_PACK.tickMs).toBe(250);
    expect(SAMPLE_PACK.cycle).toHaveLength(4);
    const due = (tick: number) =>
      SAMPLE_PACK.dueSets[SAMPLE_PACK.cycle[tick]].map(
        (i) => SAMPLE_PACK.ranges[i].id,
      );
    expect(due(0)).toEqual([
      "module",
      "items",
      "bottles",
      "items-more",
      "overworld",
      "dungeon-counts",
      "entrances",
    ]);
    expect(due(1)).toEqual(["module"]);
    expect(due(2)).toEqual(["module", "items", "bottles", "items-more"]);
    expect(due(3)).toEqual(["module"]);
  });

  it("sorts ranges into race-permitted and forbidden by category", () => {
    const permitted = SAMPLE_PACK.ranges
      .filter((_, i) => SAMPLE_PACK.racePermitted[i])
      .map((r) => r.id);
    expect(permitted).toEqual([
      "header",
      "module",
      "items",
      "items-more",
      "overworld",
    ]);
    expect(SAMPLE_PACK.forbiddenBytes).toEqual([
      { address: bus(0x7e_f35c), size: 4 },
      { address: bus(0x7e_f4c0), size: 0x10 },
      { address: bus(0x7e_1000), size: 0x40 },
    ]);
  });

  it("takes the race flag from the profile and decodes it", () => {
    const flag = SAMPLE_PACK.raceFlag;
    expect(flag?.address).toBe(0x18_0213);
    expect(flag?.decode(Uint8Array.of(1))).toBe("race");
    expect(flag?.decode(Uint8Array.of(0))).toBe("open");
    expect(flag?.decode(Uint8Array.of(7))).toBe("unknown");
    expect(
      definePack({ ...SAMPLE_SOURCE, raceFlag: null }).raceFlag,
    ).toBeNull();
  });

  it.each([
    ["a bad pack id", withRanges([item], { id: "Bad Id" }), /kebab-case/],
    ["a bad range id", withRanges([{ ...item, id: "Items" }]), /kebab-case/],
    ["a duplicate id", withRanges([item, item]), /defined twice/],
    ["an empty range", withRanges([{ ...item, size: 0 }]), /positive integer/],
    [
      "a range across regions",
      withRanges([{ ...item, address: 0xdf_fff0, size: 0x20 }]),
      /one FX Pak Pro memory region/,
    ],
    [
      "a range in a hole",
      withRanges([{ ...item, address: 0xf0_0000 }]),
      /one FX Pak Pro memory region/,
    ],
    [
      "an unknown category",
      withRanges([{ ...item, category: "loot" }]),
      /unknown category "loot"/,
    ],
    [
      "a permitted category outside permitted memory",
      withRanges([{ ...item, address: bus(0x7e_f4ff), size: 4 }]),
      /reaches outside the memory alttpr permits/,
    ],
    ["a bad cadence", withRanges([{ ...item, everyMs: 0 }]), /everyMs/],
    [
      "cadences that never line up",
      withRanges([
        { ...item, everyMs: 4999 },
        { ...item, everyMs: 4993, id: "other" },
      ]),
      /align them/,
    ],
    [
      "a game check on an unknown range",
      withRanges([item], {
        gameCheck: { ranges: ["nope"], verify: () => ({ ok: true }) },
      }),
      /unknown range "nope"/,
    ],
    [
      "a game check on a forbidden range",
      withRanges([{ ...item, category: "hud" }], {
        gameCheck: { ranges: ["items"], verify: () => ({ ok: true }) },
      }),
      /not race-permitted/,
    ],
    [
      "a race flag outside permitted memory",
      withRanges([item], {
        raceFlag: { address: bus(0x7e_2000), decode: () => "open", size: 1 },
      }),
      /race flag .* outside the permitted memory/,
    ],
    ["a negative gap", withRanges([item], { gap: -1 }), /gap/],
  ])("rejects %s", (_, define, message) => {
    expect(define).toThrow(DefinitionError);
    expect(define).toThrow(message);
  });

  it("accepts a forbidden category anywhere in memory", () => {
    const pack = definePack({
      id: "casual",
      profile: ALTTPR_RACE_PROFILE,
      ranges: [
        {
          address: bus(0x7e_2000),
          category: "entrances",
          everyMs: 1000,
          id: "doors",
          size: 8,
        },
      ],
    });
    expect(pack.forbiddenBytes).toHaveLength(1);
    expect(pack.tickMs).toBe(1000);
  });
});

describe("definePack modes", () => {
  const probe = {
    address: bus(0x7e_0010),
    category: "game-start",
    everyMs: 250,
    id: "game",
    size: 1,
  };
  const modes = { decode: () => "a", names: ["a", "b"], range: "game" };
  const define =
    (
      ranges: AutotrackPackSource["ranges"],
      extra: Partial<AutotrackPackSource> = {},
    ) =>
    () =>
      definePack({
        id: "combo",
        modes,
        profile: ALTTPR_RACE_PROFILE,
        ranges,
        ...extra,
      });

  it("gives each range the bits of its modes", () => {
    const pack = define([probe, { ...item, modes: ["b"] }])();
    expect(Array.from(pack.modeMasks)).toEqual([0xffff_ffff, 0b10]);
    expect(pack.modes?.probe).toBe(0);
  });

  it.each([
    [
      "no names",
      define([probe], { modes: { ...modes, names: [] } }),
      /1 to 31 distinct names/,
    ],
    [
      "a repeated name",
      define([probe], { modes: { ...modes, names: ["a", "a"] } }),
      /distinct names/,
    ],
    ["an unknown probe", define([item]), /unknown probe range "game"/],
    [
      "a forbidden probe",
      define([{ ...probe, category: "hud" }]),
      /not race-permitted/,
    ],
    [
      "a mode-bound probe",
      define([{ ...probe, modes: ["a"] }]),
      /read in every mode/,
    ],
    [
      "an unknown mode",
      define([probe, { ...item, modes: ["c"] }]),
      /unknown mode "c"/,
    ],
    [
      "modes without a probe",
      define([{ ...item, modes: ["a"] }], { modes: undefined }),
      /the pack has none/,
    ],
    [
      "a game check on a mode-bound range",
      define([probe, { ...item, modes: ["a"] }], {
        gameCheck: { ranges: ["items"], verify: () => ({ ok: true }) },
      }),
      /game check: range "items" must be read in every mode/,
    ],
  ])("rejects %s", (_, build, message) => {
    expect(build).toThrow(DefinitionError);
    expect(build).toThrow(message);
  });
});
