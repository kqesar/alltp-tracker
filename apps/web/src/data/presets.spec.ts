import { describe, expect, it } from "vitest";
import {
  crossedLogic,
  DEFAULT_PRESET_ID,
  getPreset,
  logicModelled,
  presets,
} from "@/data/presets";

describe("presets", () => {
  it("each preset has a unique id and the required fields", () => {
    const ids = new Set<string>();
    for (const preset of presets) {
      expect(preset.id).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(ids.has(preset.id)).toBe(false);
      ids.add(preset.id);
    }
  });

  it("models every run type's logic", () => {
    expect(
      presets
        .filter((preset) => !logicModelled(preset.settings))
        .map((preset) => preset.id),
    ).toEqual([]);
    // Crosskeys': the entrance randomizer's world
    const crosskeys = getPreset("crosskeys").settings;
    expect(crossedLogic(crosskeys)).toBe(true);
    expect(crossedLogic({ ...crosskeys, mode: "standard" })).toBe(true);
    // Not other shuffles, nor its keys kept in their dungeons, nor Inverted
    for (const settings of [
      { ...getPreset("open").settings, entranceShuffle: "full" as const },
      { ...crosskeys, dungeonItems: "mcs" as const },
      { ...crosskeys, mode: "inverted" as const },
    ]) {
      expect(crossedLogic(settings)).toBe(false);
      expect(logicModelled(settings)).toBe(false);
    }
  });

  it("getPreset returns the matching preset", () => {
    expect(getPreset("keysanity").id).toBe("keysanity");
  });

  it("getPreset falls back to the default for an unknown id", () => {
    expect(getPreset("nope").id).toBe(DEFAULT_PRESET_ID);
  });

  it("the keysanity preset enables keysanity", () => {
    expect(getPreset("keysanity").settings.dungeonItems).toBe("full");
  });

  it("the default preset exists", () => {
    expect(presets.some((preset) => preset.id === DEFAULT_PRESET_ID)).toBe(
      true,
    );
  });
});
