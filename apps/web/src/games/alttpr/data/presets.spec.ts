import { describe, expect, it } from "vitest";
import {
  crossedLogic,
  DEFAULT_PRESET_ID,
  describeSettings,
  entrancesKnown,
  getPreset,
  glitchedLogic,
  HIDDEN_ENTRANCES,
  HIDEABLE,
  logicModelled,
  noLogicRun,
  presets,
  TUNING,
  tunedOf,
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
    // Mystery's entrances are not known until set: no logic is missing
    expect(
      presets
        .filter(
          (preset) =>
            !logicModelled({
              ...preset.settings,
              hidden: preset.settings.hidden?.filter(
                (key) => key !== "entranceShuffle",
              ),
            }),
        )
        .map((preset) => preset.id),
    ).toEqual([]);
    expect(unmodelledReasons(getPreset("mystery").settings)).toEqual([
      HIDDEN_ENTRANCES,
    ]);
    // Crosskeys': the entrance randomizer's world
    const crosskeys = getPreset("crosskeys").settings;
    expect(crossedLogic(crosskeys)).toBe(true);
    expect(crossedLogic({ ...crosskeys, mode: "standard" })).toBe(true);
    // Retro's is Open's, its arrows and keys bought
    expect(crossedLogic({ ...crosskeys, mode: "retro" })).toBe(true);
    expect(logicModelled({ ...crosskeys, mode: "retro" })).toBe(true);
    // Its keys kept in their dungeons: the pack's key model of that world
    expect(crossedLogic({ ...crosskeys, dungeonItems: "standard" })).toBe(true);
    // Every shuffle the pack ports reads that world: the randomizer's
    // rules never ask which shuffle made a seed
    for (const entranceShuffle of ["simple", "restricted", "full"] as const)
      for (const mode of ["open", "retro", "standard"] as const) {
        const settings = { ...crosskeys, entranceShuffle, mode };
        expect(crossedLogic(settings), `${entranceShuffle} ${mode}`).toBe(true);
        expect(logicModelled(settings)).toBe(true);
      }
    // Not Insanity, nor Inverted
    for (const settings of [
      { ...crosskeys, entranceShuffle: "insanity" as const },
      { ...crosskeys, mode: "inverted" as const },
      {
        ...crosskeys,
        entranceShuffle: "restricted" as const,
        mode: "inverted" as const,
      },
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
      ["the Insanity entrance shuffle"],
    );
    // No Logic behind shuffled entrances is the randomizer's NoGlitches
    expect(
      unmodelledReasons({
        ...crosskeys,
        entranceShuffle: "full",
        glitches: "no_logic",
      }),
    ).toEqual([]);
    // No Logic is read with the glitches it is played with
    expect(
      unmodelledReasons({
        ...open,
        glitches: "no_logic",
        playGlitches: "major_glitches",
      }),
    ).toEqual([]);
    // The entrance randomizer keeps the keys in their dungeons but in full
    // shuffle (EntranceRandomizer.php:69-71): the pack's key model reads them
    for (const dungeonItems of ["standard", "mc", "mcs"] as const) {
      expect(unmodelledReasons({ ...crosskeys, dungeonItems })).toEqual([]);
      expect(crossedLogic({ ...crosskeys, dungeonItems })).toBe(true);
    }
    expect(
      unmodelledReasons({
        ...crosskeys,
        dungeonItems: "standard",
        entranceShuffle: "simple",
      }),
    ).toEqual([]);
    expect(unmodelledReasons({ ...crosskeys, mode: "inverted" })).toEqual([
      "shuffled entrances in the Inverted world",
    ]);
    // Every cause that applies
    expect(
      unmodelledReasons({
        ...crosskeys,
        entranceShuffle: "insanity",
        mode: "inverted",
      }),
    ).toEqual([
      "the Insanity entrance shuffle",
      "shuffled entrances in the Inverted world",
    ]);
    expect(unmodelledReasons({ ...crosskeys, bossShuffle: "full" })).toEqual(
      [],
    );
  });

  it("says a run's boss shuffle, and models it behind shuffled entrances", () => {
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
    // vt's logic reads the shuffle, and so does the entrance randomizer's
    // port, its boss slots read alike
    expect(logicModelled({ ...open, bossShuffle: "random" })).toBe(true);
    const crosskeys = getPreset("crosskeys").settings;
    for (const settings of [
      { ...crosskeys, bossShuffle: "simple" as const },
      { ...crosskeys, hidden: ["bossShuffle" as const] },
      { ...crosskeys, bossShuffle: "none" as const },
    ]) {
      expect(crossedLogic(settings)).toBe(true);
      expect(logicModelled(settings)).toBe(true);
    }
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

  it("hides a Mystery run's glitches and entrance shuffle, as alttpr.com's weighted seeds roll them", () => {
    const mystery = getPreset("mystery").settings;
    expect(mystery.hidden).toEqual(expect.arrayContaining([...HIDEABLE]));
    expect(HIDEABLE).toContain("glitches");
    expect(HIDEABLE).toContain("entranceShuffle");
    const rows = Object.fromEntries(
      describeSettings(mystery).map((row) => [row.label, row]),
    );
    expect(rows.Entrances).toEqual({
      label: "Entrances",
      setting: "entranceShuffle",
      value: "?",
    });
    expect(rows.Glitches?.value).toBe("?");
    expect(TUNING.entranceShuffle.map(([value]) => value)).toEqual([
      "none",
      "simple",
      "restricted",
      "full",
      "crossed",
      "insanity",
    ]);
    expect(tunedOf(mystery, "entranceShuffle")).toBe("none");
    // A value standing in for a hidden one is never read
    const standIn = {
      ...getPreset("crosskeys").settings,
      glitches: "no_logic" as const,
      hidden: ["entranceShuffle", "glitches"] as const,
    };
    expect(crossedLogic(standIn)).toBe(false);
    expect(entrancesKnown(standIn)).toBe(false);
    expect(noLogicRun(standIn)).toBe(false);
    expect(glitchedLogic({ ...standIn, glitches: "major_glitches" })).toBe(
      false,
    );
    expect(unmodelledReasons(standIn)).toEqual([HIDDEN_ENTRANCES]);
    expect(
      describeSettings(standIn).some((row) => row.label === "Played with"),
    ).toBe(false);
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

describe("entrancesKnown", () => {
  const open = getPreset("open").settings;

  it("knows every ported shuffle's entrances in the Open, Retro and Standard worlds, whatever the dungeon items", () => {
    for (const entranceShuffle of [
      "simple",
      "restricted",
      "full",
      "crossed",
    ] as const)
      for (const mode of ["open", "retro", "standard"] as const)
        expect(
          entrancesKnown({ ...open, entranceShuffle, mode }),
          `${entranceShuffle} ${mode}`,
        ).toBe(true);
  });

  it("knows none of Insanity's, the Inverted world's, nor a run without shuffled entrances", () => {
    expect(entrancesKnown(open)).toBe(false);
    expect(entrancesKnown({ ...open, entranceShuffle: "insanity" })).toBe(
      false,
    );
    expect(
      entrancesKnown({ ...open, entranceShuffle: "simple", mode: "inverted" }),
    ).toBe(false);
  });
});
