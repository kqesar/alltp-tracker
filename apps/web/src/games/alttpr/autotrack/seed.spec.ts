import { describe, expect, it } from "vitest";
import { readingOf, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import {
  checkSeed,
  describeRun,
  promptText,
  seedLineText,
  switchedText,
} from "@/games/alttpr/autotrack/seed";
import { getPreset, logicModelled } from "@/games/alttpr/data/presets";
import {
  type SeedRom,
  writeSeedSettings,
} from "../../../../../../packs/alttpr/test/seed-rom";

/** The settings a seed's ROM holds, as the session decodes them. */
const seedOf = (rom: SeedRom, { race = false } = {}) =>
  readingOf(writeSeedSettings(seedMemory({ race }), rom), { race }).seed;

/** A Mystery race seed: its ROM in Race Mode, its file hiding the rest. */
const mysterySeed = () => {
  const hidden = { known: false, why: "mystery" } as const;
  return {
    ...seedOf({}, { race: true }),
    accessibility: hidden,
    crystalsGanon: hidden,
    crystalsTower: hidden,
    goal: hidden,
    itemFunctionality: hidden,
    itemPlacement: hidden,
    itemPool: hidden,
    mode: hidden,
    swordless: hidden,
    wildBigKeys: hidden,
    wildCompasses: hidden,
    wildKeys: hidden,
    wildMaps: hidden,
  };
};

/** The tracker's run, on a run type's own settings. */
const run = (presetId: string) => ({
  presetId,
  settings: getPreset(presetId).settings,
});

describe("checkSeed", () => {
  it("names the seed's run type when the tracker's differs", () => {
    const check = checkSeed(seedOf({ dungeonItems: "full" }), run("open"));

    expect(check).toMatchObject({
      kind: "differs",
      presetId: "keysanity",
      runText: "Open",
      seed: "OPEN",
      seedText: "Keysanity (Open, Ganon, 7/7)",
      settings: getPreset("keysanity").settings,
    });
    if (check.kind !== "differs") throw new Error("expected differs");
    expect(promptText(check)).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7). The tracker is set to Open. Switch?",
    );
    expect(switchedText(check)).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7): the tracker switched to it.",
    );
  });

  it("finds the same run type, and says so", () => {
    expect(checkSeed(seedOf({}), run("open"))).toEqual({
      kind: "same",
      seed: "OPEN",
      text: "Open (Open, Ganon, 7/7)",
    });
    expect(
      checkSeed(seedOf({ swordless: true }), run("swordless")),
    ).toMatchObject({ kind: "same" });
  });

  it("carries the seed's crystals, and tells two runs of one name apart", () => {
    const check = checkSeed(
      seedOf({ crystalsGanon: 6, crystalsTower: 5 }),
      run("open"),
    );

    expect(check).toMatchObject({
      kind: "differs",
      presetId: "open",
      runText: "Open (Open, Ganon, 7/7)",
      seedText: "Open (Open, Ganon, 5/6)",
      settings: { crystalsGanon: 6, crystalsTower: 5 },
    });
  });

  it("reveals a Mystery run's settings in place, in its own world", () => {
    const check = checkSeed(
      seedOf({ crystalsTower: 5, dungeonItems: "mc", swordless: true }),
      run("mystery"),
    );
    expect(check).toMatchObject({
      change: {
        crystalsGanon: 7,
        crystalsTower: 5,
        dungeonItems: "mc",
        goal: "ganon",
        swordless: true,
      },
      kind: "reveals",
      seed: "OPEN",
    });
    if (check.kind !== "reveals") throw new Error("expected reveals");
    // What only the seed's file states stays hidden: no file here
    expect(check.change).not.toHaveProperty("itemPlacement");
    expect(seedLineText(check, false)).toBe(
      "This seed is Mystery (Open, Ganon, 5/7, MC Shuffle, Swordless): its settings are laid on your Mystery run.",
    );

    // The ROM tells NoGlitches apart: the hidden glitches are None
    const { enemyHealth, glitches, swords, ...change } = check.change;
    // Only the file states where the swords are and the enemies' health
    expect([enemyHealth, swords]).toEqual([undefined, undefined]);
    expect(glitches).toBe("none");

    // Once laid, the seed and the run agree
    const settings = {
      ...getPreset("mystery").settings,
      ...change,
      hidden: [
        "itemPlacement",
        "itemPool",
        "itemFunctionality",
        "accessibility",
      ],
    } as const;
    expect(
      checkSeed(
        seedOf({ crystalsTower: 5, dungeonItems: "mc", swordless: true }),
        {
          presetId: "mystery",
          settings,
        },
      ),
    ).toMatchObject({ kind: "same" });
  });

  it("switches a Mystery run of another world, as any run type", () => {
    expect(
      checkSeed(seedOf({ mode: "inverted" }), run("mystery")),
    ).toMatchObject({ kind: "differs", presetId: "inverted" });
  });

  it("names a mix no run type holds by the nearest, with what differs", () => {
    const check = checkSeed(
      seedOf({ dungeonItems: "full", mode: "standard" }),
      run("open"),
    );
    expect(check).toMatchObject({
      kind: "differs",
      presetId: "standard",
      seedText: "Standard (Standard, Ganon, 7/7, Full Shuffle)",
      settings: { dungeonItems: "full", mode: "standard" },
    });
    // The tracker's own run type wins a tie
    expect(
      checkSeed(
        seedOf({ dungeonItems: "full", mode: "standard" }),
        run("keysanity"),
      ),
    ).toMatchObject({ presetId: "keysanity" });
  });

  it("knows a retro seed by its generic keys: the Retro run type", () => {
    expect(checkSeed(seedOf({ mode: "retro" }), run("open"))).toMatchObject({
      kind: "differs",
      presetId: "retro",
      seedText: "Retro (Retro, Ganon, 7/7)",
    });
  });

  it("keeps the entrance shuffle the ROM does not state", () => {
    const check = checkSeed(seedOf({ goal: "fast_ganon" }), run("crosskeys"));
    expect(check).toMatchObject({
      kind: "differs",
      settings: { entranceShuffle: "crossed", goal: "fast-ganon" },
    });
  });

  it("takes the entrances a seed's file states: a Crosskeys seed is no Keysanity one", () => {
    const crosskeys = {
      ...seedOf({ dungeonItems: "full" }),
      entrances: { known: true, value: "crossed" },
    } as const;
    expect(checkSeed(crosskeys, run("keysanity"))).toMatchObject({
      kind: "differs",
      presetId: "crosskeys",
      runText: "Keysanity",
      seedText: "Crosskeys (Open, Ganon, 7/7)",
    });
    // A Mystery run takes them in place while its entrances are hidden
    const vanilla = {
      ...seedOf({}),
      entrances: { known: true, value: "none" },
    } as const;
    expect(
      checkSeed({ ...vanilla, entrances: crosskeys.entrances }, run("mystery")),
    ).toMatchObject({
      change: { entranceShuffle: "crossed" },
      kind: "reveals",
    });
    // Once set, a seed of other entrances is another run
    const mystery = getPreset("mystery").settings;
    expect(
      checkSeed(
        { ...vanilla, entrances: crosskeys.entrances },
        {
          presetId: "mystery",
          settings: {
            ...mystery,
            hidden: mystery.hidden?.filter((key) => key !== "entranceShuffle"),
          },
        },
      ),
    ).toMatchObject({ kind: "differs", seedText: /Crossworld entrances/ });
    // Without the file, the ROM says nothing of them: they stay hidden
    const rom = checkSeed(seedOf({}), run("mystery"));
    expect(rom).toMatchObject({ kind: "reveals" });
    if (rom.kind !== "reveals") throw new Error("expected reveals");
    expect(rom.change).not.toHaveProperty("entranceShuffle");
    expect(checkSeed(vanilla, run("open"))).toMatchObject({ kind: "same" });
  });

  it("takes the boss shuffle a seed's file states, and says it", () => {
    // alttpr.com's bGbbOaDWGP: Standard, boss shuffle "full"
    const shuffled = {
      ...seedOf({ mode: "standard" }),
      bossShuffle: { known: true, value: "full" },
    } as const;
    const check = checkSeed(shuffled, run("standard"));
    expect(check).toMatchObject({
      kind: "differs",
      presetId: "standard",
      seedText: "Standard (Standard, Ganon, 7/7, Full boss shuffle)",
      settings: { bossShuffle: "full" },
    });
    if (check.kind !== "differs") throw new Error("expected differs");
    expect(
      checkSeed(shuffled, { presetId: "standard", settings: check.settings }),
    ).toMatchObject({ kind: "same" });
    // None is the presets' own, said or not
    const none = {
      ...shuffled,
      bossShuffle: { known: true, value: "none" },
    } as const;
    expect(checkSeed(none, run("standard"))).toMatchObject({ kind: "same" });
    expect(
      checkSeed(none, {
        presetId: "standard",
        settings: { ...getPreset("standard").settings, bossShuffle: "none" },
      }),
    ).toMatchObject({ kind: "same" });
    // A Mystery run takes it in place, as what the file reveals
    const mystery = getPreset("mystery").settings;
    expect(
      checkSeed(shuffled, {
        presetId: "mystery",
        settings: { ...mystery, mode: "standard" },
      }),
    ).toMatchObject({
      change: { bossShuffle: "full" },
      kind: "reveals",
    });
  });

  it("holds a seed's maps and compasses, or its small keys too, outside their dungeons", () => {
    expect(
      checkSeed(seedOf({ dungeonItems: "mc" }), run("open")),
    ).toMatchObject({
      kind: "differs",
      presetId: "open",
      seedText: "Open (Open, Ganon, 7/7, MC Shuffle)",
      settings: { dungeonItems: "mc" },
    });
    expect(
      checkSeed(seedOf({ dungeonItems: "mcs" }), run("open")),
    ).toMatchObject({ settings: { dungeonItems: "mcs" } });
  });

  it("never rounds a seed the tracker cannot hold to a run type", () => {
    // Small keys out and maps in: a mix vt never writes (World.php:111-129)
    const keysOnly = {
      ...seedOf({}),
      wildKeys: { known: true, value: true },
    } as const;
    expect(checkSeed(keysOnly, run("open"))).toEqual({
      kind: "unsupported",
      reasons: ["only its small keys outside their dungeons"],
      seed: "OPEN",
    });
  });

  it("takes where the swords are and the enemies' health from the seed's file", () => {
    const seed = {
      ...seedOf({}),
      enemyHealth: { known: true, value: "hard" },
      weapons: { known: true, value: "assured" },
    } as const;
    expect(checkSeed(seed, run("open"))).toMatchObject({
      kind: "differs",
      seedText: "Open (Open, Ganon, 7/7, Assured swords, Hard enemy health)",
      settings: { enemyHealth: "hard", swords: "assured" },
    });
    // The ROM alone says neither: the run's own stand
    expect(checkSeed(seedOf({}), run("open"))).toMatchObject({ kind: "same" });
    // A Mystery run takes them in place
    expect(checkSeed(seed, run("mystery"))).toMatchObject({
      change: { enemyHealth: "hard", swords: "assured" },
      kind: "reveals",
    });
  });

  it("holds the Ganonhunt and Completionist goals", () => {
    expect(checkSeed(seedOf({ goal: "ganonhunt" }), run("open"))).toMatchObject(
      {
        kind: "differs",
        presetId: "ganonhunt",
        seedText: "Ganonhunt (Open, Ganonhunt, 7/7)",
      },
    );
    expect(
      checkSeed(seedOf({ goal: "completionist" }), run("open")),
    ).toMatchObject({
      kind: "differs",
      seedText: "Open (Open, Completionist, 7/7)",
      settings: { goal: "completionist" },
    });
  });

  it("leaves the run type to the player in Race Mode", () => {
    expect(
      checkSeed(seedOf({ dungeonItems: "full" }, { race: true }), run("open")),
    ).toEqual({ kind: "unread", why: "race-mode" });
  });

  it("offers a Mystery run for a Mystery seed, in the run's world", () => {
    const check = checkSeed(mysterySeed(), run("inverted"));

    expect(check).toEqual({
      kind: "differs",
      presetId: "mystery",
      runText: "Inverted",
      seed: "RACE",
      seedText: "Mystery (Inverted)",
      settings: { ...getPreset("mystery").settings, mode: "inverted" },
    });
    if (check.kind !== "differs") throw new Error("expected differs");
    expect(promptText(check)).toBe(
      "This seed is Mystery (Inverted). The tracker is set to Inverted. Switch?",
    );
  });

  it("leaves a Mystery run as it is for a Mystery seed", () => {
    const check = checkSeed(mysterySeed(), run("mystery"));

    expect(check).toEqual({ kind: "unread", why: "mystery" });
    expect(seedLineText(check, false)).toBe(
      "A Mystery seed: its settings stay hidden until you find them in game.",
    );
  });

  it("carries a glitched seed's logic, modelled once ported", () => {
    const check = checkSeed(
      seedOf({ logic: "OverworldGlitches" }),
      run("open"),
    );

    expect(check).toMatchObject({
      kind: "differs",
      presetId: "open",
      runText: "Open (Open, Ganon, 7/7)",
      seedText: "Open (Open, Ganon, 7/7, Overworld Glitches)",
      settings: {
        ...getPreset("open").settings,
        glitches: "overworld_glitches",
      },
    });
    if (check.kind !== "differs") throw new Error("expected differs");
    expect(logicModelled(check.settings)).toBe(true);
    // The same seed again is the run's
    expect(
      checkSeed(seedOf({ logic: "OverworldGlitches" }), {
        presetId: "open",
        settings: check.settings,
      }),
    ).toMatchObject({ kind: "same" });
  });

  it("takes a NoGlitches seed's logic off a glitched run", () => {
    const glitched = {
      presetId: "open",
      settings: {
        ...getPreset("open").settings,
        glitches: "major_glitches" as const,
      },
    };

    const check = checkSeed(seedOf({}), glitched);

    expect(check).toMatchObject({
      kind: "differs",
      seedText: "Open (Open, Ganon, 7/7)",
      settings: getPreset("open").settings,
    });
    if (check.kind !== "differs") throw new Error("expected differs");
    expect(check.settings).not.toHaveProperty("glitches");
  });

  it("keeps the run's logic when the seed does not state it", () => {
    const glitched = {
      presetId: "open",
      settings: {
        ...getPreset("open").settings,
        glitches: "no_logic" as const,
      },
    };
    const seed = {
      ...seedOf({}),
      logic: { known: false, why: "unrecognized" },
    } as const;

    expect(checkSeed(seed, glitched)).toMatchObject({ kind: "same" });
  });

  it("reveals a glitched Mystery seed's logic to a Mystery run that hides it", () => {
    const seed = {
      ...mysterySeed(),
      logic: { known: true, value: "HybridMajorGlitches" },
    } as const;

    const check = checkSeed(seed, run("mystery"));
    expect(check).toMatchObject({
      change: { glitches: "hybrid_major_glitches" },
      kind: "reveals",
      seedText: "Mystery (Open, Hybrid Major Glitches)",
    });
  });

  it("switches a Mystery run to a Door Randomizer's Mystery seed, never revealing into it", () => {
    const seed = {
      ...mysterySeed(),
      logic: { known: true, value: "HybridMajorGlitches" },
      randomizer: { kind: "door", overworld: false, version: "1.5.6" },
    } as const;

    expect(checkSeed(seed, run("mystery"))).toMatchObject({
      kind: "differs",
      presetId: "mystery",
      settings: { glitches: "hybrid_major_glitches", randomizer: "dr" },
    });
  });

  it("switches a Mystery run whose glitches are set to another logic's seed", () => {
    const seed = {
      ...mysterySeed(),
      logic: { known: true, value: "HybridMajorGlitches" },
    } as const;
    const mystery = getPreset("mystery").settings;
    expect(
      checkSeed(seed, {
        presetId: "mystery",
        settings: {
          ...mystery,
          hidden: mystery.hidden?.filter((key) => key !== "glitches"),
        },
      }),
    ).toMatchObject({
      kind: "differs",
      presetId: "mystery",
      seedText: "Mystery (Open, Hybrid Major Glitches)",
      settings: { glitches: "hybrid_major_glitches" },
    });
  });

  it("never reveals glitches from the ROM's Major Glitches, which three logics write", () => {
    const rom = checkSeed(seedOf({ logic: "MajorGlitches" }), run("mystery"));
    if (rom.kind !== "reveals") throw new Error("expected reveals");
    expect(rom.change).not.toHaveProperty("glitches");
    const overworld = checkSeed(
      seedOf({ logic: "OverworldGlitches" }),
      run("mystery"),
    );
    expect(overworld).toMatchObject({
      change: { glitches: "overworld_glitches" },
      kind: "reveals",
    });
  });

  it("reveals nothing in Race Mode, the glitches and entrances included", () => {
    const check = checkSeed(
      seedOf({ logic: "OverworldGlitches" }, { race: true }),
      run("mystery"),
    );
    expect(check).toEqual({ kind: "unread", why: "race-mode" });
    expect(checkSeed(mysterySeed(), run("mystery"))).toEqual({
      kind: "unread",
      why: "mystery",
    });
  });

  it("waits for settings not read yet, and refuses values no seed has", () => {
    const memory = writeSeedSettings(seedMemory({ race: false }), {});
    expect(
      checkSeed(
        readingOf(memory, { unread: ["tower-crystals"] }).seed,
        run("open"),
      ),
    ).toEqual({ kind: "unread", why: "not-read" });
    expect(
      checkSeed(readingOf(seedMemory({ race: false })).seed, run("open")),
    ).toEqual({
      kind: "unread",
      why: "unrecognized",
    });
    expect(
      checkSeed(
        readingOf(memory, { unread: ["rom-header"] }).seed,
        run("open"),
      ),
    ).toEqual({ kind: "unread", why: "not-read" });
  });
});

describe("describeRun", () => {
  it("says a swordless or keyless departure from the run type", () => {
    expect(
      describeRun("keysanity", {
        ...getPreset("keysanity").settings,
        dungeonItems: "standard",
        swordless: true,
      }),
    ).toBe("Keysanity (Open, Ganon, 7/7, Standard dungeon items, Swordless)");
    expect(
      describeRun("swordless", {
        ...getPreset("swordless").settings,
        swordless: false,
      }),
    ).toBe("Swordless (Open, Ganon, 7/7, swords)");
  });

  it("names a Door Randomizer run's entrances in DR's words", () => {
    const dr = getPreset("door-randomizer").settings;
    expect(
      describeRun("door-randomizer", { ...dr, doorEntrances: "lite" }),
    ).toBe("Door Randomizer (Open, Ganon, 7/7, Lite entrances)");
    expect(
      describeRun("door-crosskeys", {
        ...getPreset("door-crosskeys").settings,
        entranceShuffle: "none",
      }),
    ).toMatch(/vanilla entrances/);
    expect(describeRun("door-randomizer", dr)).not.toMatch(/entrances/);
  });

  it("leaves out what a Mystery run has not found", () => {
    const mystery = getPreset("mystery").settings;
    expect(describeRun("mystery", mystery)).toBe("Mystery (Open)");
    expect(
      describeRun("mystery", {
        ...mystery,
        hidden: (mystery.hidden ?? []).filter(
          (setting) => setting !== "goal" && setting !== "crystalsGanon",
        ),
        swordless: true,
      }),
    ).toBe("Mystery (Open, Ganon, ?/7)");
  });
});

describe("seedLineText", () => {
  it("says what the seed means for the run type, whatever its check", () => {
    const keysanity = checkSeed(seedOf({ dungeonItems: "full" }), run("open"));

    expect(seedLineText(keysanity, false)).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7). The tracker is set to Open.",
    );
    expect(seedLineText(keysanity, true)).toBe(
      "This seed is Keysanity (Open, Ganon, 7/7). You kept Open.",
    );
    expect(seedLineText(checkSeed(seedOf({}), run("open")), false)).toBe(
      "The run type matches this seed: Open (Open, Ganon, 7/7).",
    );
    const keysOnly = {
      ...seedOf({}),
      wildKeys: { known: true, value: true },
    } as const;
    expect(seedLineText(checkSeed(keysOnly, run("open")), false)).toBe(
      "No run type here holds this seed (only its small keys outside their dungeons): the run type stays yours.",
    );
    expect(
      seedLineText(checkSeed(seedOf({}, { race: true }), run("open")), false),
    ).toBe(
      "Settings not read in Race Mode, nor asked of alttpr.com: pick the run type yourself.",
    );
    expect(seedLineText({ kind: "unread", why: "not-read" }, false)).toBe(
      "Seed settings not read yet.",
    );
    expect(seedLineText({ kind: "unread", why: "unrecognized" }, false)).toBe(
      "This seed's settings are not ones the tracker reads: the run type stays yours.",
    );
  });
});
