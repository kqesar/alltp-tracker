import type { SeedSettingsReading } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  DOOR_LOCATION_IDS,
  doorFromSeed,
  doorLocationsOf,
  doorNotes,
  doorReasons,
  doorTablesOf,
  isDoorSettings,
  sameDoorSettings,
} from "@/games/alttpr/data/doorRando";
import {
  crossedLogic,
  doorLogic,
  GLITCHES_LABELS,
  type Glitches,
  getPreset,
  logicModelled,
  type RunSettings,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import {
  counterMax,
  drSettingsOf,
  smallKeysMax,
} from "@/games/alttpr/logic/settings";

const DR = getPreset("door-randomizer").settings;
const DR_CROSSKEYS = getPreset("door-crosskeys").settings;
const with_ = (base: RunSettings, change: Partial<RunSettings>) => ({
  ...base,
  ...change,
});

/** Eastern Palace and Hyrule Castle by key index (logic/settings.ts). */
const EASTERN = 0;
const HYRULE_CASTLE = 10;

describe("a Door Randomizer run's logic", () => {
  it("takes DR's own world for vanilla doors and entrances, and says so", () => {
    expect(unmodelledReasons(DR)).toEqual([]);
    expect(logicModelled(DR)).toBe(true);
    expect(doorLogic(DR)).toBe(true);
    expect(doorNotes(DR, "door")).toEqual([
      "Door Randomizer seed: the logic is DR's own (1.5.6).",
    ]);
    expect(doorNotes(getPreset("open").settings, "door")).toEqual([]);
  });

  it("names what keeps a run out of DR's world, v31's rules being no stand-in", () => {
    // v31 asks less than DR in places (kill rooms, Ganons Tower's Tile
    // Room's powder, DR's key analysis): a yes there would be unsound
    const cases: [Partial<RunSettings>, string][] = [
      [{ randomizer: "owr" }, "the Overworld Randomizer's own rules"],
      [{ bossShuffle: "full" }, "shuffled bosses in a Door Randomizer seed"],
      [{ bossShuffle: "simple" }, "shuffled bosses in a Door Randomizer seed"],
    ];
    for (const [change, reason] of cases) {
      const run = with_(DR, change);
      expect(doorLogic(run), reason).toBe(false);
      expect(unmodelledReasons(run), reason).toEqual([reason]);
    }
    // An alttpr.com run's boss shuffle is vt's own
    expect(
      unmodelledReasons(
        with_(getPreset("open").settings, { bossShuffle: "full" }),
      ),
    ).toEqual([]);
  });

  it("borrows v31 for a Mystery run whose settings are not all known, and says so", () => {
    for (const change of [
      { hidden: ["goal"] },
      { bossShuffle: "full", hidden: ["bossShuffle"] },
    ] as const) {
      const run = with_(DR, change);
      expect(doorLogic(run), JSON.stringify(change)).toBe(false);
      expect(logicModelled(run), JSON.stringify(change)).toBe(true);
    }
    expect(doorNotes(with_(DR, { hidden: ["goal"] }), "borrowed")).toEqual([
      "Door Randomizer seed: dungeon logic from alttpr.com's v31 until DR's own is ported.",
    ]);
    expect(
      doorNotes(with_(DR, { dropShuffle: "keys" }), "borrowed")[1],
    ).toMatch(/show as maybe until then/);
    // DR's world gives them their rules: nothing more to say
    expect(doorNotes(with_(DR, { dropShuffle: "keys" }), "door")).toHaveLength(
      1,
    );
  });

  it("keeps the crossed logic for DR's Crosskeys, with the note the owner asked for", () => {
    expect(crossedLogic(DR_CROSSKEYS)).toBe(true);
    expect(doorLogic(DR_CROSSKEYS)).toBe(false);
    expect(doorNotes(DR_CROSSKEYS, "crossed")[0]).toBe(
      "Door Randomizer seed: entrance logic from the ALttP Entrance Randomizer until DR's own is ported.",
    );
  });

  it("reads strict and dangerous key logic, and names static as not modelled", () => {
    expect(drSettingsOf(with_(DR, { keyLogic: "strict" }))).toMatchObject({
      strictKeyLogic: true,
    });
    expect(drSettingsOf(DR)).toMatchObject({
      dangerousKeyLogic: false,
      strictKeyLogic: false,
    });
    // Each door at its worst case, uncapped (Rules.py:2393-2395)
    expect(drSettingsOf(with_(DR, { keyLogic: "dangerous" }))).toMatchObject({
      dangerousKeyLogic: true,
      strictKeyLogic: false,
    });
    expect(doorNotes(with_(DR, { keyLogic: "dangerous" }), "door")[1]).toBe(
      "Its dangerous key logic: a key door is in logic once the keys of its worst case are found.",
    );
    const fixed = with_(DR, { keyLogic: "static" });
    expect(unmodelledReasons(fixed)).toEqual(["DR's static key logic"]);
    expect(doorLogic(fixed)).toBe(false);
  });

  it("carries the pot shuffle, the boss items and the pyramid into DR's rules", () => {
    expect(drSettingsOf(DR)).toMatchObject({
      bombBag: false,
      openPyramid: false,
      potShuffle: false,
      restrictBossItems: false,
    });
    for (const change of [
      { potShuffle: true },
      { restrictBossItems: "mapcompass" },
      { restrictBossItems: "dungeon" },
      { openPyramid: "yes" },
      { openPyramid: "no" },
    ] as const) {
      expect(doorLogic(with_(DR, change)), JSON.stringify(change)).toBe(true);
    }
    expect(drSettingsOf(with_(DR, { potShuffle: true }))).toMatchObject({
      potShuffle: true,
    });
    expect(
      drSettingsOf(with_(DR, { restrictBossItems: "mapcompass" })),
    ).toMatchObject({ restrictBossItems: true });
    // is_pyramid_open (BaseClasses.py:299-311): auto opens it for the
    // crystals goal and ganonhunt with vanilla entrances
    const pyramid = (change: Partial<RunSettings>) =>
      drSettingsOf(with_(DR, change)).openPyramid;
    expect(pyramid({ goal: "fast-ganon" })).toBe(true);
    expect(pyramid({ goal: "ganonhunt" })).toBe(true);
    expect(pyramid({ goal: "ganon" })).toBe(false);
    expect(pyramid({ goal: "ganon", openPyramid: "yes" })).toBe(true);
    expect(pyramid({ goal: "fast-ganon", openPyramid: "no" })).toBe(false);
    expect(pyramid({ entranceShuffle: "crossed", goal: "fast-ganon" })).toBe(
      false,
    );
    // The pot shuffle moves pots, which the run's locations follow
    expect(
      doorLocationsOf(with_(DR, { potShuffle: true, pottery: "keys" }))
        .unflagged.size,
    ).toBeGreaterThan(0);
  });

  it("refuses District outside the Overworld fork", () => {
    expect(
      isDoorSettings({ doorEntrances: "district", randomizer: "dr" }),
    ).toBe(false);
    expect(
      isDoorSettings({ doorEntrances: "district", randomizer: "owr" }),
    ).toBe(true);
  });

  it("names every cause it cannot model, and models none of them", () => {
    const cases: [Partial<RunSettings>, string][] = [
      [{ doorShuffle: "crossed" }, "Crossed door shuffle"],
      [{ doorShuffle: "partitioned" }, "Partitioned door shuffle"],
      [{ enemyShuffle: "shuffled" }, "shuffled enemies"],
      [
        { doorEntrances: "swapped" },
        "the Door Randomizer's Swapped entrance shuffle",
      ],
      [{ owLayout: "grid", randomizer: "owr" }, "the Grid overworld layout"],
      [{ owMixed: true, randomizer: "owr" }, "a mixed overworld"],
      [{ owFluteShuffle: "random", randomizer: "owr" }, "shuffled flute spots"],
      // Bombs then need the +10 upgrade, which no cell records
      [{ bombBag: true }, "the bomb bag"],
    ];
    for (const [change, reason] of cases) {
      const run = with_(DR, change);
      expect(unmodelledReasons(run), reason).toContain(reason);
      expect(logicModelled(run), reason).toBe(false);
    }
  });

  it("names DR's glitched logics, which the pack does not port, as alttpr.com's it does", () => {
    const glitched: Glitches[] = [
      "overworld_glitches",
      "hybrid_major_glitches",
      "major_glitches",
      "no_logic",
    ];
    for (const glitches of glitched) {
      const reason = `the Door Randomizer's ${GLITCHES_LABELS[glitches]}`;
      for (const base of [DR, DR_CROSSKEYS]) {
        const run = with_(base, { glitches });
        expect(unmodelledReasons(run), glitches).toContain(reason);
        expect(logicModelled(run), glitches).toBe(false);
        expect(doorLogic(run), glitches).toBe(false);
        expect(crossedLogic(run), glitches).toBe(false);
      }
      // alttpr.com's own glitched logic is the pack's
      expect(
        unmodelledReasons(with_(getPreset("open").settings, { glitches })),
      ).toEqual([]);
    }
  });

  it("holds DR's shuffled entrances to its Crosskeys, as the entrance randomizer's world reads them", () => {
    const cases: [Partial<RunSettings>, string][] = [
      [
        { entranceShuffle: "simple" },
        "the Door Randomizer's Simple entrance shuffle",
      ],
      [
        { dungeonItems: "standard" },
        "Crossworld entrances with dungeon items kept in their dungeons",
      ],
      [{ mode: "retro" }, "Crossworld entrances in the Retro world"],
      [{ bossShuffle: "full" }, "shuffled bosses behind Crossworld entrances"],
    ];
    for (const [change, reason] of cases) {
      const run = with_(DR_CROSSKEYS, change);
      expect(crossedLogic(run), reason).toBe(false);
      expect(unmodelledReasons(run), reason).toEqual([reason]);
      // An alttpr.com seed of the same settings is that world's
      const vt = with_(getPreset("crosskeys").settings, change);
      expect(crossedLogic(vt), reason).toBe(true);
      expect(unmodelledReasons(vt), reason).toEqual([]);
    }
  });

  it("models key drops in DR's world, and with keys in their dungeons in v31's", () => {
    const keydrop = { dropShuffle: "keys", pottery: "keys" } as const;
    expect(unmodelledReasons(with_(DR, keydrop))).toEqual([]);
    // DR's world counts the drops' keys, wild or not
    const keysanity = with_(DR, { ...keydrop, dungeonItems: "full" });
    expect(doorLogic(keysanity)).toBe(true);
    expect(unmodelledReasons(keysanity)).toEqual([]);
    const crosskeys = with_(DR_CROSSKEYS, keydrop);
    expect(unmodelledReasons(crosskeys)).toEqual([
      "shuffled key drops with keys outside their dungeons",
    ]);
    // Not the crossed logic either, nor the bosses' reason by default
    expect(crossedLogic(crosskeys)).toBe(false);
    expect(doorReasons(crosskeys, true)).toHaveLength(1);
  });
});

describe("a Door Randomizer run's locations", () => {
  it("adds the key drops to the dungeons' counters, less their keys kept inside", () => {
    // Eastern Palace's dark square pot key and its Eyegore's key drop
    // (PotShuffle.py:1006-1007): two locations, two keys
    const keydrop = with_(DR, { dropShuffle: "keys", pottery: "keys" });
    expect(counterMax(EASTERN, keydrop)).toBe(counterMax(EASTERN, DR));
    const full = with_(keydrop, { dungeonItems: "full" });
    expect(counterMax(EASTERN, full)).toBe(
      counterMax(EASTERN, with_(DR, { dungeonItems: "full" })) + 2,
    );
    // Hyrule Castle's three guards and its big key drop: three small keys
    expect(smallKeysMax(HYRULE_CASTLE, keydrop)).toBe(
      smallKeysMax(HYRULE_CASTLE) + 3,
    );
    expect(smallKeysMax(EASTERN, keydrop)).toBe(2);
    expect(smallKeysMax(EASTERN, DR)).toBe(0);
  });

  it("reads only the tables its locations lie in", () => {
    expect(doorTablesOf(getPreset("open").settings)).toEqual(new Set());
    expect(doorTablesOf(DR)).toEqual(new Set());
    expect(doorTablesOf(with_(DR, { pottery: "keys" }))).toEqual(
      new Set(["door-pots"]),
    );
    expect(
      doorTablesOf(with_(DR, { dropShuffle: "underworld", shopsanity: true })),
    ).toEqual(new Set(["door-drops", "door-shops"]));
  });

  it("lists lottery's pots and every enemy, each an id saves know", () => {
    const { locations } = doorLocationsOf(
      with_(DR, { dropShuffle: "underworld", pottery: "lottery" }),
    );
    expect(locations.length).toBeGreaterThan(1400);
    expect(locations.every(({ id }) => DOOR_LOCATION_IDS.has(id))).toBe(true);
  });
});

describe("a Door Randomizer run's settings", () => {
  it("are known options, each only with a generator", () => {
    expect(isDoorSettings({ pottery: "keys", randomizer: "dr" })).toBe(true);
    expect(isDoorSettings({})).toBe(true);
    expect(isDoorSettings({ pottery: "keys" })).toBe(false);
    expect(isDoorSettings({ pottery: "pots", randomizer: "dr" })).toBe(false);
    expect(isDoorSettings({ randomizer: "vt" })).toBe(false);
  });

  it("compare by their values, a default absent or written", () => {
    expect(sameDoorSettings(DR, with_(DR, { pottery: "none" }))).toBe(true);
    expect(sameDoorSettings(DR, with_(DR, { pottery: "keys" }))).toBe(false);
    expect(sameDoorSettings(DR, getPreset("open").settings)).toBe(false);
  });
});

/** A reading as a DR ROM gives it outside Race Mode. */
const read = (door: Partial<NonNullable<SeedSettingsReading["door"]>>) =>
  ({
    door: {
      doorShuffle: { known: true, value: "vanilla" },
      dropShuffle: { known: true, value: "none" },
      pottery: { known: true, value: "none" },
      shopsanity: { known: true, value: false },
      takeAny: { known: true, value: false },
      version: { known: true, value: "1.5.6" },
      ...door,
    },
    randomizer: { kind: "door", overworld: false, version: "1.5.6" },
  }) as unknown as SeedSettingsReading;

describe("doorFromSeed", () => {
  it("lays what a DR ROM states, and no DR setting for an alttpr.com seed", () => {
    expect(
      doorFromSeed(
        read({ dropShuffle: { known: true, value: "underworld" } }),
        {},
      ),
    ).toEqual({ dropShuffle: "underworld", randomizer: "dr" });
    expect(
      doorFromSeed({ randomizer: { kind: "vt" } } as SeedSettingsReading, DR),
    ).toEqual({});
    expect(doorFromSeed({} as SeedSettingsReading, DR)).toBeNull();
  });

  it("keeps the run's mode where the ROM tells only its kind, and says so", () => {
    const pots = read({ pottery: { known: true, value: "beyond-caves" } });
    expect(doorFromSeed(pots, { pottery: "lottery" })).toMatchObject({
      pottery: "lottery",
    });
    expect(doorFromSeed(pots, { pottery: "cave" })).toMatchObject({
      pottery: "keys",
    });
    const doors = read({ doorShuffle: { known: true, value: "shuffled" } });
    expect(doorFromSeed(doors, { doorShuffle: "partitioned" })).toMatchObject({
      doorShuffle: "partitioned",
    });
    expect(doorFromSeed(doors, {})).toMatchObject({ doorShuffle: "crossed" });
  });

  it("lays an Overworld seed's overworld, by kind from its ROM, by name from its meta", () => {
    const known = <T>(value: T) => ({ known: true, value });
    const rom = {
      ...read({}),
      door: {
        ...read({}).door,
        overworld: {
          bonkDrops: known(true),
          crossed: known(true),
          fluteShuffle: known(true),
          layout: known("wild"),
          mixed: known(false),
          version: known("0.8.0.0"),
          whirlpool: known(true),
        },
      },
      randomizer: { kind: "door", overworld: true, version: "1.5.6" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(rom, { owCrossed: "grouped" })).toEqual({
      bonkDrops: true,
      owCrossed: "grouped",
      owFluteShuffle: "random",
      owLayout: "wild",
      owWhirlpool: true,
      randomizer: "owr",
    });
    const meta = {
      doorExact: {
        doorEntrances: "lite",
        doorShuffle: "vanilla",
        dropShuffle: "none",
        enemyShuffle: "shuffled",
        overworld: {
          bonkDrops: false,
          crossed: "polar",
          fluteShuffle: "balanced",
          layout: "vanilla",
          mixed: true,
          whirlpool: false,
        },
        pottery: "a mode of a newer DR",
        shopsanity: false,
        takeAny: "fixed",
      },
      randomizer: { kind: "door", overworld: true, version: "1.5.8" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(meta, { pottery: "keys" })).toEqual({
      doorEntrances: "lite",
      enemyShuffle: "shuffled",
      owCrossed: "polar",
      owFluteShuffle: "balanced",
      owMixed: true,
      // A pottery mode the tracker has no option for keeps the run's
      pottery: "keys",
      randomizer: "owr",
      takeAny: "fixed",
    });
  });

  it("takes a spoiler's key logic, and District from the Overworld fork alone", () => {
    const exact = (more: Record<string, unknown>, overworld: boolean) =>
      ({
        doorExact: {
          doorShuffle: "vanilla",
          dropShuffle: "none",
          enemyShuffle: "none",
          pottery: "none",
          shopsanity: false,
          takeAny: "none",
          ...more,
        },
        randomizer: { kind: "door", overworld, version: "1.5.6" },
      }) as unknown as SeedSettingsReading;
    expect(doorFromSeed(exact({ keyLogic: "static" }, false), {})).toEqual({
      keyLogic: "static",
      randomizer: "dr",
    });
    // Partial is DR's default: left out; a name it does not know keeps the run's
    expect(doorFromSeed(exact({ keyLogic: "partial" }, false), {})).toEqual({
      randomizer: "dr",
    });
    expect(
      doorFromSeed(exact({ keyLogic: "newer" }, false), { keyLogic: "strict" }),
    ).toEqual({ keyLogic: "strict", randomizer: "dr" });
    expect(
      doorFromSeed(exact({ doorEntrances: "district" }, false), {}),
    ).toEqual({ randomizer: "dr" });
    expect(
      doorFromSeed(exact({ doorEntrances: "district" }, true), {}),
    ).toEqual({ doorEntrances: "district", randomizer: "owr" });
  });

  it("takes a spoiler's bomb bag, pot shuffle, boss items and pyramid", () => {
    const exact = (more: Record<string, unknown>) =>
      ({
        doorExact: {
          doorShuffle: "vanilla",
          dropShuffle: "none",
          enemyShuffle: "none",
          pottery: "none",
          shopsanity: false,
          takeAny: "none",
          ...more,
        },
        randomizer: { kind: "door", overworld: false, version: "1.5.6" },
      }) as unknown as SeedSettingsReading;
    expect(
      doorFromSeed(
        exact({
          bombBag: true,
          openPyramid: "no",
          potShuffle: true,
          restrictBossItems: "dungeon",
        }),
        {},
      ),
    ).toEqual({
      bombBag: true,
      openPyramid: "no",
      potShuffle: true,
      randomizer: "dr",
      restrictBossItems: "dungeon",
    });
    // DR's defaults are left out; a meta without them keeps the run's
    expect(
      doorFromSeed(
        exact({
          bombBag: false,
          openPyramid: "auto",
          potShuffle: false,
          restrictBossItems: "none",
        }),
        { bombBag: true, randomizer: "dr" },
      ),
    ).toEqual({ randomizer: "dr" });
    expect(doorFromSeed(exact({}), { potShuffle: true })).toEqual({
      potShuffle: true,
      randomizer: "dr",
    });
  });

  it("keeps the run's own in Race Mode, the generator from the title", () => {
    const race = {
      door: {
        doorShuffle: { known: false, why: "race-mode" },
        dropShuffle: { known: false, why: "race-mode" },
        pottery: { known: false, why: "race-mode" },
        shopsanity: { known: false, why: "race-mode" },
        takeAny: { known: false, why: "race-mode" },
        version: { known: false, why: "race-mode" },
      },
      randomizer: { kind: "door", overworld: true, version: "1.5.6" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(race, { pottery: "keys" })).toEqual({
      pottery: "keys",
      randomizer: "owr",
    });
  });
});
