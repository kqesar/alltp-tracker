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

  it("keeps the entrance shuffle the ROM does not state", () => {
    const check = checkSeed(seedOf({ goal: "fast_ganon" }), run("crosskeys"));
    expect(check).toMatchObject({
      kind: "differs",
      settings: { entranceShuffle: "crossed", goal: "fast-ganon" },
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
