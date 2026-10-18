import { describe, expect, it } from "vitest";
import { readingOf, seedMemory } from "@/autotrack/fixtures";
import {
  checkSeed,
  describeRun,
  promptText,
  seedLineText,
  switchedText,
} from "@/autotrack/seed";
import { getPreset } from "@/data/presets";
import {
  type SeedRom,
  writeSeedSettings,
} from "../../../../packs/alttpr/test/seed-rom";

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

    // Once laid, the seed and the run agree
    const settings = {
      ...getPreset("mystery").settings,
      ...check.change,
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
    // Nor does a Mystery run take a seed of other entrances in place
    const vanilla = {
      ...seedOf({}),
      entrances: { known: true, value: "none" },
    } as const;
    expect(
      checkSeed({ ...vanilla, entrances: crosskeys.entrances }, run("mystery")),
    ).toMatchObject({ kind: "differs", seedText: /Crossworld entrances/ });
    expect(checkSeed(vanilla, run("open"))).toMatchObject({ kind: "same" });
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
    expect(checkSeed(seedOf({ goal: "ganonhunt" }), run("open"))).toEqual({
      kind: "unsupported",
      reasons: ["the Ganonhunt goal"],
      seed: "OPEN",
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
    expect(
      seedLineText(
        checkSeed(seedOf({ goal: "ganonhunt" }), run("open")),
        false,
      ),
    ).toBe(
      "No run type here holds this seed (the Ganonhunt goal): the run type stays yours.",
    );
    expect(
      seedLineText(checkSeed(seedOf({}, { race: true }), run("open")), false),
    ).toBe("Settings not read in Race Mode: the run type stays yours.");
    expect(seedLineText({ kind: "unread", why: "not-read" }, false)).toBe(
      "Seed settings not read yet.",
    );
    expect(seedLineText({ kind: "unread", why: "unrecognized" }, false)).toBe(
      "This seed's settings are not ones the tracker reads: the run type stays yours.",
    );
  });

  it("says why a race seed's file on alttpr.com gave no settings", () => {
    const raced = checkSeed(seedOf({}, { race: true }), run("open"));

    expect(seedLineText(raced, false, "not-found")).toBe(
      "Settings not read in Race Mode, and alttpr.com has no file for this seed: the run type stays yours.",
    );
    expect(seedLineText(raced, false, "unrecognized")).toBe(
      "Settings not read in Race Mode, and this seed's file on alttpr.com is not one the tracker reads: the run type stays yours.",
    );
  });
});
