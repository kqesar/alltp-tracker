import { describe, expect, it } from "vitest";
import {
  bossesMayMove,
  crossedLogic,
  DEFAULT_PRESET_ID,
  describeSettings,
  getPreset,
  logicModelled,
  noLogicRun,
  presets,
  TUNING,
  unmodelledReasons,
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

  it("names why a run's logic is not modelled, from one place", () => {
    const open = getPreset("open").settings;
    const crosskeys = getPreset("crosskeys").settings;
    expect(unmodelledReasons(open)).toEqual([]);
    expect(unmodelledReasons(crosskeys)).toEqual([]);
    // Every glitched logic is modelled, but not behind shuffled entrances,
    // which alttpr.com never generates (the entrance randomizer is
    // NoGlitches)
    expect(unmodelledReasons({ ...open, glitches: "major_glitches" })).toEqual(
      [],
    );
    expect(
      unmodelledReasons({ ...crosskeys, glitches: "overworld_glitches" }),
    ).toEqual(["Overworld Glitches with shuffled entrances"]);
    expect(crossedLogic({ ...crosskeys, glitches: "overworld_glitches" })).toBe(
      false,
    );
    expect(crossedLogic({ ...crosskeys, glitches: "no_logic" })).toBe(true);
    expect(unmodelledReasons({ ...open, entranceShuffle: "insanity" })).toEqual(
      ["Insanity entrance shuffle"],
    );
    expect(
      unmodelledReasons({
        ...open,
        entranceShuffle: "full",
        glitches: "no_logic",
      }),
    ).toEqual(["Full entrance shuffle"]);
    // No Logic is read with the glitches it is played with
    expect(
      unmodelledReasons({
        ...open,
        glitches: "no_logic",
        playGlitches: "major_glitches",
      }),
    ).toEqual([]);
    expect(unmodelledReasons({ ...crosskeys, dungeonItems: "mcs" })).toEqual([
      "Crossworld entrances with dungeon items kept in their dungeons",
    ]);
    expect(unmodelledReasons({ ...crosskeys, mode: "inverted" })).toEqual([
      "Crossworld entrances in the Inverted world",
    ]);
    expect(unmodelledReasons({ ...crosskeys, bossShuffle: "full" })).toEqual([
      "shuffled bosses behind Crossworld entrances",
    ]);
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

  it("models every glitched logic, No Logic by what it is played with", () => {
    const open = getPreset("open").settings;
    const glitched = { ...open, glitches: "major_glitches" as const };
    const noLogic = { ...open, glitches: "no_logic" as const };

    expect(logicModelled(glitched)).toBe(true);
    expect(logicModelled(noLogic)).toBe(true);
    expect(logicModelled({ ...open, glitches: "hybrid_major_glitches" })).toBe(
      true,
    );
    expect(noLogicRun(noLogic)).toBe(true);
    expect(noLogicRun(glitched)).toBe(false);
    const row = (settings: typeof open, label: string) =>
      describeSettings(settings).find((r) => r.label === label);
    expect(row(open, "Glitches")).toEqual({
      label: "Glitches",
      setting: "glitches",
      value: "None",
    });
    expect(row(glitched, "Glitches")?.value).toBe("Major Glitches");
    // A No Logic run alone says what it is played with, none at first
    expect(row(open, "Played with")).toBeUndefined();
    expect(row(noLogic, "Played with")).toEqual({
      label: "Played with",
      setting: "playGlitches",
      value: "None",
    });
    expect(TUNING.playGlitches.map(([value]) => value)).toEqual([
      "none",
      "overworld_glitches",
      "hybrid_major_glitches",
      "major_glitches",
    ]);
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
