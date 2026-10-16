import { OPEN, STANDARD } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { getPreset, presets, type RunSettings } from "@/data/presets";
import { counterMax, dungeonAt, packSettings } from "@/logic/settings";

const run = (overrides: Partial<RunSettings> = {}): RunSettings => ({
  entranceShuffle: "none",
  goal: "ganon",
  keysanity: false,
  mode: "open",
  ...overrides,
});

describe("packSettings", () => {
  it("reads the Open and Standard presets as the site's default preset", () => {
    expect(packSettings(getPreset("open").settings)).toEqual(OPEN);
    expect(packSettings(getPreset("standard").settings)).toEqual(STANDARD);
  });

  it("turns every dungeon item wild for keysanity", () => {
    const settings = packSettings(getPreset("keysanity").settings);

    expect(settings).toMatchObject({
      wildBigKeys: true,
      wildCompasses: true,
      wildKeys: true,
      wildMaps: true,
    });
    expect(packSettings(run())).toMatchObject({
      wildBigKeys: false,
      wildCompasses: false,
      wildKeys: false,
      wildMaps: false,
    });
  });

  it.each([
    ["ganon", { fastGanonGoal: false, ganonGoal: true }],
    ["fast-ganon", { fastGanonGoal: true, ganonGoal: false }],
    ["all-dungeons", { dungeonsGoal: true, ganonGoal: false }],
    ["pedestal", { ganonGoal: false, pedestalGoal: true }],
    ["triforce-hunt", { ganonGoal: true }],
  ] as const)("gives the %s goal its pack goal", (goal, expected) => {
    expect(packSettings(run({ goal }))).toMatchObject(expected);
  });

  it("reads the worlds the pack does not model as Open", () => {
    expect(packSettings(run({ mode: "inverted" })).standardMode).toBe(false);
    expect(packSettings(run({ mode: "retro" })).standardMode).toBe(false);
    expect(packSettings(run({ mode: "standard" })).standardMode).toBe(true);
  });

  it("gives equal run settings the same object, so its world is kept", () => {
    expect(packSettings(run({ keysanity: true }))).toBe(
      packSettings(getPreset("keysanity").settings),
    );
    expect(packSettings(run())).not.toBe(
      packSettings(run({ mode: "standard" })),
    );
  });

  it("maps every preset without throwing", () => {
    for (const preset of presets) {
      expect(packSettings(preset.settings).crystalsTower, preset.id).toBe(7);
    }
  });
});

describe("counterMax", () => {
  it("counts a dungeon's items but the map, compass and keys it keeps", () => {
    expect(
      Array.from({ length: 10 }, (_, index) => counterMax(index, run())),
    ).toEqual([3, 2, 2, 5, 6, 2, 4, 3, 2, 5]);
  });

  it("counts every location with keysanity (config/item.php:94-147)", () => {
    expect(
      Array.from({ length: 10 }, (_, index) =>
        counterMax(index, run({ keysanity: true })),
      ),
    ).toEqual([6, 6, 6, 14, 10, 8, 8, 8, 8, 12]);
  });

  it("refuses an index past the ten dungeons", () => {
    expect(() => counterMax(10, run())).toThrow(RangeError);
    expect(() => dungeonAt(-1)).toThrow(RangeError);
    expect(dungeonAt(9)).toBe("turtle-rock");
  });
});
