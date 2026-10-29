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
  getPreset,
  logicModelled,
  type RunSettings,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import { counterMax, smallKeysMax } from "@/games/alttpr/logic/settings";

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

  it("borrows v31 where DR's world does not reach, and says it borrows it", () => {
    for (const change of [
      { randomizer: "owr" },
      { bossShuffle: "full" },
      { hidden: ["goal"] },
    ] as const) {
      const run = with_(DR, change);
      expect(doorLogic(run), JSON.stringify(change)).toBe(false);
      expect(logicModelled(run), JSON.stringify(change)).toBe(true);
    }
    expect(doorNotes(with_(DR, { randomizer: "owr" }), "borrowed")).toEqual([
      "Door Randomizer seed: dungeon logic from alttpr.com's v31 until DR's own is ported.",
    ]);
    expect(
      doorNotes(with_(DR, { dropShuffle: "keys" }), "borrowed")[1],
    ).toMatch(/show as maybe until then/);
    expect(doorNotes(with_(DR, { dropShuffle: "keys" }), "door")[1]).toMatch(
      /whether their room is reached/,
    );
  });

  it("keeps the crossed logic for DR's Crosskeys, with the note the owner asked for", () => {
    expect(crossedLogic(DR_CROSSKEYS)).toBe(true);
    expect(doorLogic(DR_CROSSKEYS)).toBe(false);
    expect(doorNotes(DR_CROSSKEYS, "crossed")[0]).toBe(
      "Door Randomizer seed: entrance logic from the ALttP Entrance Randomizer until DR's own is ported.",
    );
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
    ];
    for (const [change, reason] of cases) {
      const run = with_(DR, change);
      expect(unmodelledReasons(run), reason).toContain(reason);
      expect(logicModelled(run), reason).toBe(false);
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
