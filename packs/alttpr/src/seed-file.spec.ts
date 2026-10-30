import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { seedFileReading } from "./seed-file";

/** A real seed file of alttpr.com's, its patch left out (test/seed-files). */
const seedFile = (hash: string) =>
  JSON.parse(
    readFileSync(
      new URL(`../test/seed-files/${hash}.json`, import.meta.url),
      "utf8",
    ),
  );

/** The Open seed's file with `meta` changed. */
const withMeta = (meta: Record<string, unknown>) => {
  const file = seedFile("9MQ9gO1wMD");
  return { ...file, spoiler: { meta: { ...file.spoiler.meta, ...meta } } };
};

describe("seedFileReading", () => {
  it("reads an Open seed's settings", () => {
    expect(seedFileReading(seedFile("9MQ9gO1wMD"))).toEqual({
      accessibility: { known: true, value: "items" },
      bossShuffle: { known: true, value: "none" },
      crystalsGanon: { known: true, value: 7 },
      crystalsTower: { known: true, value: 7 },
      enemyHealth: { known: true, value: "default" },
      // vt randomized it itself: its entrances are vanilla
      entrances: { known: true, value: "none" },
      goal: { known: true, value: "ganon" },
      itemFunctionality: { known: true, value: "normal" },
      itemPlacement: { known: true, value: "advanced" },
      itemPool: { known: true, value: "normal" },
      logic: { known: true, value: "NoGlitches" },
      mode: { known: true, value: "open" },
      seed: "9MQ9gO1wMD",
      swordless: { known: true, value: false },
      weapons: { known: true, value: "randomized" },
      wildBigKeys: { known: true, value: false },
      wildCompasses: { known: true, value: false },
      wildKeys: { known: true, value: false },
      wildMaps: { known: true, value: false },
    });
  });

  it("reads where the swords are and the enemies' health, which only the file states", () => {
    for (const value of ["assured", "vanilla", "swordless"]) {
      expect(seedFileReading(withMeta({ weapons: value }))?.weapons).toEqual({
        known: true,
        value,
      });
    }
    for (const value of ["easy", "hard", "expert"]) {
      expect(
        seedFileReading(withMeta({ "enemizer.enemy_health": value }))
          ?.enemyHealth,
      ).toEqual({ known: true, value });
    }
    expect(
      seedFileReading(withMeta({ "enemizer.enemy_health": "silly" }))
        ?.enemyHealth,
    ).toEqual({ known: false, why: "unrecognized" });
  });

  it("reads a boss-shuffled seed's boss shuffle, never its bosses", () => {
    // alttpr.com's bGbbOaDWGP: enemizer boss shuffle "full"
    const reading = seedFileReading(seedFile("bGbbOaDWGP"));

    expect(reading?.bossShuffle).toEqual({ known: true, value: "full" });
    expect(reading).toMatchObject({
      accessibility: { value: "locations" },
      itemPlacement: { value: "basic" },
      mode: { value: "standard" },
    });
    for (const value of ["simple", "random"]) {
      expect(
        seedFileReading(withMeta({ "enemizer.boss_shuffle": value }))
          ?.bossShuffle,
      ).toEqual({ known: true, value });
    }
    expect(
      seedFileReading(withMeta({ "enemizer.boss_shuffle": "madness" }))
        ?.bossShuffle,
    ).toEqual({ known: false, why: "unrecognized" });
  });

  it("reads a tournament seed's, whose spoiler is its meta alone", () => {
    const reading = seedFileReading(seedFile("eM43RgZ4Gj"));

    expect(reading).toMatchObject({
      crystalsGanon: { value: 7 },
      crystalsTower: { value: 4 },
      goal: { value: "fast_ganon" },
      itemFunctionality: { value: "hard" },
      itemPlacement: { value: "basic" },
      itemPool: { value: "hard" },
      mode: { value: "inverted" },
      seed: "eM43RgZ4Gj",
    });
  });

  it("lets out of the dungeons what dungeon_items says", () => {
    const wild = (dungeonItems: string) => {
      const reading = seedFileReading(
        withMeta({ dungeon_items: dungeonItems }),
      );
      return [
        reading?.wildMaps,
        reading?.wildCompasses,
        reading?.wildKeys,
        reading?.wildBigKeys,
      ].map((setting) => (setting?.known ? setting.value : null));
    };

    expect(wild("standard")).toEqual([false, false, false, false]);
    expect(wild("mc")).toEqual([true, true, false, false]);
    expect(wild("mcs")).toEqual([true, true, true, false]);
    expect(wild("full")).toEqual([true, true, true, true]);
  });

  it("reads swordless from the weapons", () => {
    expect(
      seedFileReading(withMeta({ weapons: "swordless" }))?.swordless,
    ).toEqual({ known: true, value: true });
    expect(
      seedFileReading(withMeta({ weapons: "vanilla" }))?.swordless,
    ).toEqual({ known: true, value: false });
  });

  it.each([
    "NoGlitches",
    "OverworldGlitches",
    "HybridMajorGlitches",
    "MajorGlitches",
    "NoLogic",
  ])("reads the logic %s, one alttpr.com offers", (logic) => {
    expect(seedFileReading(withMeta({ logic }))?.logic).toEqual({
      known: true,
      value: logic,
    });
  });

  it("leaves a logic alttpr.com never offers unrecognized", () => {
    expect(
      seedFileReading(withMeta({ logic: "MinorGlitches" }))?.logic,
    ).toEqual({ known: false, why: "unrecognized" });
  });

  it("leaves a value vt never writes unrecognized, and only that one", () => {
    const reading = seedFileReading(
      withMeta({ entry_crystals_tower: "random", mode: 3 }),
    );

    const unrecognized = { known: false, why: "unrecognized" };
    expect(reading?.crystalsTower).toEqual(unrecognized);
    expect(reading?.mode).toEqual(unrecognized);
    expect(reading?.goal).toEqual({ known: true, value: "ganon" });
  });

  it("reads a Crosskeys seed's entrances, which the entrance randomizer shuffled", () => {
    expect(seedFileReading(seedFile("0yAObedRMV"))).toMatchObject({
      entrances: { known: true, value: "crossed" },
      wildBigKeys: { known: true, value: true },
    });
    expect(
      seedFileReading(withMeta({ shuffle: "madness" }))?.entrances,
    ).toEqual({ known: false, why: "unrecognized" });
  });

  it("reads a Mystery race seed's settings as hidden by the seed", () => {
    const reading = seedFileReading(seedFile("xvJo0drkyJ"));

    const hidden = { known: false, why: "mystery" };
    expect(reading).toEqual({
      accessibility: hidden,
      bossShuffle: hidden,
      crystalsGanon: hidden,
      crystalsTower: hidden,
      enemyHealth: hidden,
      entrances: hidden,
      goal: hidden,
      itemFunctionality: hidden,
      itemPlacement: hidden,
      itemPool: hidden,
      logic: { known: true, value: "NoGlitches" },
      mode: hidden,
      seed: "xvJo0drkyJ",
      swordless: hidden,
      weapons: hidden,
      wildBigKeys: hidden,
      wildCompasses: hidden,
      wildKeys: hidden,
      wildMaps: hidden,
    });
  });

  it("reads a seed outside a race as it is, whatever its spoilers", () => {
    // vt strips a Mystery seed's file in tournaments only
    const reading = seedFileReading(
      withMeta({ spoilers: "mystery", tournament: false }),
    );
    expect(reading?.mode).toEqual({ known: true, value: "open" });
  });

  it("refuses what is not a seed file", () => {
    for (const json of [
      null,
      "9MQ9gO1wMD",
      {},
      { hash: "9MQ9gO1wMD" },
      { hash: "9MQ9gO1wMD", spoiler: {} },
      { hash: "../etc", spoiler: { meta: {} } },
    ]) {
      expect(seedFileReading(json)).toBeNull();
    }
  });
});
