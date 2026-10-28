import { describe, expect, it } from "vitest";
import {
  bossesMayMove,
  crossedLogic,
  DEFAULT_PRESET_ID,
  describeSettings,
  getPreset,
  logicModelled,
  presets,
} from "@/games/alttpr/data/presets";

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

  it("says a run's boss shuffle, and models none behind shuffled entrances", () => {
    const open = getPreset("open").settings;
    const bosses = (settings: typeof open) =>
      describeSettings(settings).find((row) => row.label === "Boss shuffle");
    expect(bosses(open)).toEqual({
      label: "Boss shuffle",
      setting: "bossShuffle",
      value: "None",
    });
    expect(bosses({ ...open, bossShuffle: "full" })?.value).toBe("Full");
    // Mystery hides it until the player finds it
    expect(bosses(getPreset("mystery").settings)?.value).toBe("?");
    expect(bossesMayMove(open)).toBe(false);
    expect(bossesMayMove(getPreset("mystery").settings)).toBe(true);
    // vt's logic reads the shuffle; the entrance randomizer's port does not
    expect(logicModelled({ ...open, bossShuffle: "random" })).toBe(true);
    const crosskeys = getPreset("crosskeys").settings;
    for (const settings of [
      { ...crosskeys, bossShuffle: "simple" as const },
      { ...crosskeys, hidden: ["bossShuffle" as const] },
    ]) {
      expect(crossedLogic(settings)).toBe(false);
      expect(logicModelled(settings)).toBe(false);
    }
    expect(crossedLogic({ ...crosskeys, bossShuffle: "none" })).toBe(true);
  });

  it("models no glitched logic, and says a run's in its summary", () => {
    const open = getPreset("open").settings;
    const glitched = { ...open, glitches: "major_glitches" as const };

    expect(logicModelled(glitched)).toBe(false);
    expect(
      logicModelled({
        ...getPreset("crosskeys").settings,
        glitches: "no_logic",
      }),
    ).toBe(false);
    const glitches = (settings: typeof open) =>
      describeSettings(settings).find((row) => row.label === "Glitches")?.value;
    expect(glitches(open)).toBe("None");
    expect(glitches(glitched)).toBe("Major Glitches");
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
