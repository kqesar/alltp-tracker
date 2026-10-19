import { describe, expect, it } from "vitest";
import { SM_ITEMS, smItem } from "./items";
import { OBJECTIVES, objectiveByFlag } from "./objectives";
import { OBJECTIVE_PRESETS, presetName, SKILL_PRESETS } from "./settings";

describe("SM_ITEMS", () => {
  it("are Map Rando's items but Nothing, by its enum's indices", () => {
    expect(SM_ITEMS.map((i) => i.index)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      21, 23, 24,
    ]);
    expect(new Set(SM_ITEMS.map((i) => i.id)).size).toBe(SM_ITEMS.length);
  });

  it("count the game's full pool: 100 items", () => {
    expect(SM_ITEMS.reduce((n, i) => n + i.max, 0)).toBe(
      // 14 + 46 + 10 + 10 + 4 counted, 19 held or not
      14 + 46 + 10 + 10 + 4 + 19,
    );
    expect(smItem("morph").name).toBe("Morphing Ball");
    expect(() => smItem("bow")).toThrow(/No Super Metroid item/);
  });
});

describe("OBJECTIVES", () => {
  it("are the 19 Map Rando may ask for, each by a flag of its own", () => {
    expect(OBJECTIVES).toHaveLength(19);
    const flags = OBJECTIVES.map((o) => `${o.flag.address}:${o.flag.mask}`);
    expect(new Set(flags).size).toBe(OBJECTIVES.length);
    for (const { flag } of OBJECTIVES) {
      expect(flag.address).toBeGreaterThanOrEqual(0x7e_d820);
      expect(flag.address).toBeLessThan(0x7e_d830);
    }
  });

  it("are found by the flag the ROM's table lists, its address's low word", () => {
    expect(objectiveByFlag(0xd82b, 0x01)?.id).toBe("phantoon");
    expect(objectiveByFlag(0x7e_d822, 0x08)?.id).toBe("metroidRoom4");
    expect(objectiveByFlag(0xd82b, 0x02)).toBeUndefined();
  });
});

describe("presetName", () => {
  it("names a preset, Custom for 0, nothing for a byte none has", () => {
    expect(presetName(SKILL_PRESETS, 6)).toBe("Expert+");
    expect(presetName(OBJECTIVE_PRESETS, 0)).toBe("Custom");
    expect(presetName(OBJECTIVE_PRESETS, 8)).toBeNull();
  });
});
