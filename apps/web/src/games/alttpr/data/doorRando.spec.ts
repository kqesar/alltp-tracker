import type { SeedSettingsReading } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  BOMB_BAG_NOT_KNOWN,
  DOOR_LOCATION_IDS,
  doorEntranceChange,
  doorEntranceModes,
  doorEntranceOf,
  doorEntranceText,
  doorFromSeed,
  doorLocationsOf,
  doorNotes,
  doorOf,
  doorPoolSettingsOf,
  doorReasons,
  doorRows,
  doorShuffleOf,
  doorShuffleSettingsOf,
  doorTablesOf,
  doorValueText,
  doorVersionOf,
  FOLLOWERS_NOT_KNOWN,
  GOALS_NOT_KNOWN,
  isDoorSettings,
  PRIZES_NOT_KNOWN,
  sameDoorSettings,
} from "@/games/alttpr/data/doorRando";
import {
  crossedLogic,
  doorLogic,
  entrancesKnown,
  entrancesShuffled,
  GLITCHES_LABELS,
  type Glitches,
  getPreset,
  HIDDEN_DOOR_SETTINGS,
  logicModelled,
  type RunSettings,
  unmodelledReasons,
} from "@/games/alttpr/data/presets";
import {
  counterMax,
  drSettingsOf,
  smallKeysMax,
} from "@/games/alttpr/logic/settings";

// The run types with the bomb bag set, which no run type knows (the seed's
// ROM or spoiler, or the player, tells it)
const DR = { ...getPreset("door-randomizer").settings, bombBag: false };
const DR_CROSSKEYS = {
  ...getPreset("door-crosskeys").settings,
  bombBag: false,
};
/** An OWR run whose prize and follower shuffles are set: none of either. */
const OWR = {
  customGoals: false,
  prizeShuffle: "none",
  randomizer: "owr",
  shuffleFollowers: false,
} as const;
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
    expect(doorNotes(DR)).toEqual([
      "Door Randomizer seed: the logic is DR's own (1.5.8).",
    ]);
    expect(doorNotes(getPreset("open").settings)).toEqual([]);
  });

  it("takes the Overworld Randomizer's own world for its vanilla overworld", () => {
    for (const mode of ["open", "inverted"] as const) {
      const run = with_(DR, { ...OWR, bonkDrops: true, mode });
      expect(unmodelledReasons(run), mode).toEqual([]);
      expect(doorLogic(run), mode).toBe(true);
      expect(doorNotes(run)).toEqual([
        "Overworld Randomizer seed: the logic is the fork's own (0.8.0.2, on DR 1.5.7).",
      ]);
    }
    // Its prizes or followers moved: the fork's world reads neither
    expect(
      unmodelledReasons(with_(DR, { ...OWR, prizeShuffle: "nearby" })),
    ).toEqual(["shuffled dungeon prizes"]);
    expect(
      unmodelledReasons(with_(DR, { ...OWR, shuffleFollowers: true })),
    ).toEqual(["shuffled followers"]);
    // What the fork's world does not model yet stays named
    expect(unmodelledReasons(with_(DR, { ...OWR, owMixed: true }))).toEqual([
      "a mixed overworld",
    ]);
    // Not known (a ROM that cannot tell none from dungeon, a race): never
    // read as none, each named until the player sets it
    expect(unmodelledReasons(with_(DR, { randomizer: "owr" }))).toEqual([
      PRIZES_NOT_KNOWN,
      FOLLOWERS_NOT_KNOWN,
      GOALS_NOT_KNOWN,
    ]);
    // A customizer goal replaces a goal's rule, which the fork's world
    // does not read (Rules.py:71-73, :368-370, :536-538)
    expect(unmodelledReasons(with_(DR, { ...OWR, customGoals: true }))).toEqual(
      ["the customizer's goals"],
    );
    expect(
      unmodelledReasons(with_(DR, { ...OWR, shuffleFollowers: undefined })),
    ).toEqual([FOLLOWERS_NOT_KNOWN]);
    // DR itself has neither
    expect(unmodelledReasons(DR)).toEqual([]);
  });

  it("names what keeps a run out of DR's world, v31's rules being no stand-in", () => {
    // v31 asks less than DR in places (kill rooms, Ganons Tower's Tile
    // Room's powder, DR's key analysis): a yes there would be unsound
    const cases: [Partial<RunSettings>, string][] = [
      [
        { mode: "standard", ...OWR },
        "the Overworld Randomizer's Standard world",
      ],
      [
        { entranceShuffle: "crossed", ...OWR },
        "the Overworld Randomizer's entrance shuffles",
      ],
      [
        { doorShuffle: "basic", ...OWR },
        "a door shuffle in an Overworld Randomizer seed",
      ],
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

  it("names a Mystery run whose settings are not all known as not modelled, never v31's", () => {
    // v31 says yes where DR says no (the tile room's powder, kill rooms,
    // DR's key analysis): until the player sets the run, every check maybe
    // (the owner's decision of 2026-10-30)
    for (const change of [
      { hidden: ["goal"] },
      { bossShuffle: "full", hidden: ["bossShuffle"] },
      { entranceShuffle: "none", hidden: ["glitches", "entranceShuffle"] },
    ] as const) {
      const run = with_(DR, change);
      expect(doorLogic(run), JSON.stringify(change)).toBe(false);
      expect(logicModelled(run), JSON.stringify(change)).toBe(false);
    }
    expect(unmodelledReasons(with_(DR, { hidden: ["goal"] }))).toEqual([
      HIDDEN_DOOR_SETTINGS,
    ]);
    // A boss shuffle known and other settings hidden: both said
    expect(
      unmodelledReasons(
        with_(DR, { bossShuffle: "simple", hidden: ["crystalsGanon"] }),
      ),
    ).toEqual([
      "shuffled bosses in a Door Randomizer seed",
      HIDDEN_DOOR_SETTINGS,
    ]);
    // Set, it is DR's own world again
    expect(doorLogic(with_(DR, { hidden: [] }))).toBe(true);
    // DR's world gives the DR locations their rules: nothing more to say
    expect(doorNotes(with_(DR, { dropShuffle: "keys" }))).toHaveLength(1);
  });

  it("takes DR's own world for its shuffled entrances, Crosskeys among them", () => {
    // DR shuffles with its own pools (EntranceShuffle2.py), which its own
    // world reads: no longer the entrance randomizer's crossed logic
    expect(crossedLogic(DR_CROSSKEYS)).toBe(false);
    expect(doorLogic(DR_CROSSKEYS)).toBe(true);
    expect(unmodelledReasons(DR_CROSSKEYS)).toEqual([]);
    expect(entrancesKnown(DR_CROSSKEYS)).toBe(true);
    expect(doorShuffleOf(DR_CROSSKEYS)).toBe("crossed");
    expect(doorNotes(DR_CROSSKEYS)).toEqual([
      "Door Randomizer seed: the logic is DR's own (1.5.8).",
    ]);
    // Every DR shuffle, in every world, with its keys anywhere; DR's own
    // shuffles by `doorEntrances`, OWR's District not
    for (const run of [
      with_(DR_CROSSKEYS, { dungeonItems: "standard", mode: "inverted" }),
      with_(DR, { entranceShuffle: "insanity" }),
      with_(DR, { doorEntrances: "lite" }),
      with_(DR, { doorEntrances: "dungeonssimple", mode: "standard" }),
    ]) {
      expect(doorLogic(run)).toBe(true);
      expect(unmodelledReasons(run)).toEqual([]);
      expect(entrancesKnown(run)).toBe(true);
    }
    expect(doorShuffleOf(with_(DR, { doorEntrances: "lite" }))).toBe("lite");
    const district = with_(DR, {
      doorEntrances: "district",
      randomizer: "owr",
    });
    expect(doorShuffleOf(district)).toBeUndefined();
    expect(doorLogic(district)).toBe(false);
    expect(entrancesKnown(district)).toBe(false);
    expect(doorShuffleOf(getPreset("open").settings)).toBeUndefined();
    // Not known yet: no logic
    expect(
      doorLogic(with_(DR_CROSSKEYS, { hidden: ["entranceShuffle"] })),
    ).toBe(false);
  });

  it("reads Link's House and the Tavern's back into DR's pool", () => {
    // Unset (no ROM table states them): each may be moved, so the logic
    // waits for a note, never assumes them vanilla
    expect(doorPoolSettingsOf(DR_CROSSKEYS)).toMatchObject({
      mode: "open",
      shuffleLinks: true,
      shuffleTavern: true,
    });
    expect(doorPoolSettingsOf(DR).shuffleTavern).toBe(true);
    // Set, as a seed's meta or the player names them
    expect(
      doorPoolSettingsOf(
        with_(DR_CROSSKEYS, { shuffleLinks: false, shuffleTavern: false }),
      ),
    ).toMatchObject({ shuffleLinks: false, shuffleTavern: false });
    // The summary says so; a run name tells a set value only
    expect(doorValueText("shuffleLinks", undefined)).toBe("Not known");
    expect(doorValueText("shuffleLinks", false)).toBe("Off");
    expect(doorOf(DR_CROSSKEYS)).not.toHaveProperty("shuffleLinks");
    expect(
      doorPoolSettingsOf(
        with_(DR_CROSSKEYS, {
          mode: "inverted",
          pottery: "cave",
          shopsanity: true,
          shuffleLinks: true,
          shuffleTavern: true,
        }),
      ),
    ).toMatchObject({
      mode: "inverted",
      pottery: "cave",
      shopsanity: true,
      shuffleLinks: true,
      shuffleTavern: true,
    });
    expect(doorPoolSettingsOf(with_(DR, { mode: "standard" })).mode).toBe(
      "standard",
    );
    // The summary shows them while entrances are shuffled
    expect(doorRows(DR_CROSSKEYS)).toContain("shuffleLinks");
    expect(doorRows(with_(DR, { doorEntrances: "lean" }))).toContain(
      "shuffleTavern",
    );
    expect(doorRows(DR)).not.toContain("shuffleLinks");
  });

  it("takes DR's own world for a door shuffle, on the doors noted", () => {
    for (const doorShuffle of ["basic", "partitioned", "crossed"] as const) {
      const run = with_(DR, { doorShuffle });
      expect(doorLogic(run), doorShuffle).toBe(true);
      expect(unmodelledReasons(run), doorShuffle).toEqual([]);
      expect(doorNotes(run)[1]).toBe(
        "Its doors are shuffled: the logic follows the doors you note in the Doors tab, a door not noted leads nowhere, and a key door asks every key of its dungeon.",
      );
    }
    // A boss room never leaves its dungeon (dungeon_boss_sectors): its
    // restricted items stay its dungeon's in a pool too
    expect(
      doorLogic(
        with_(DR, { doorShuffle: "crossed", restrictBossItems: "mapcompass" }),
      ),
    ).toBe(true);
  });

  it("reads a door shuffle's intensity and coupling", () => {
    const basic = with_(DR, { doorShuffle: "basic" });
    // Shown while doors are shuffled, after the shuffle itself
    expect(doorRows(DR)).not.toContain("doorIntensity");
    expect(doorRows(basic).slice(0, 4)).toEqual([
      "doorVersion",
      "doorShuffle",
      "doorIntensity",
      "decoupledDoors",
    ]);
    // Unset, the intensity reads as 3: every portal's lobby may move
    expect(doorShuffleSettingsOf(basic)).toEqual({
      decoupled: false,
      intensity: 3,
      shuffle: "basic",
      trapMode: "oneway",
    });
    expect(doorValueText("doorIntensity", undefined)).toBe("Not known");
    expect(
      doorShuffleSettingsOf(
        with_(DR, {
          decoupledDoors: true,
          doorIntensity: "1",
          doorShuffle: "crossed",
        }),
      ),
    ).toMatchObject({ decoupled: true, intensity: 1, shuffle: "crossed" });
    expect(doorShuffleSettingsOf(DR)).toBeUndefined();
    expect(isDoorSettings({ doorIntensity: "4", randomizer: "dr" })).toBe(
      false,
    );
    // A spoiler's meta names them
    const seed = {
      doorExact: {
        decoupledDoors: true,
        doorIntensity: 2,
        doorShuffle: "partitioned",
        dropShuffle: "none",
        enemyShuffle: "none",
        pottery: "none",
        shopsanity: false,
        takeAny: "none",
      },
      randomizer: { kind: "dr", overworld: false, version: "1.5.8" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(seed, DR)).toMatchObject({
      decoupledDoors: true,
      doorIntensity: "2",
      doorShuffle: "partitioned",
    });
  });

  it("reads strict, dangerous and static key logic", () => {
    expect(drSettingsOf(with_(DR, { keyLogic: "strict" }))).toMatchObject({
      strictKeyLogic: true,
    });
    expect(drSettingsOf(DR)).toMatchObject({
      dangerousKeyLogic: false,
      strictKeyLogic: false,
    });
    // Each door at its worst case, uncapped (Rules.py:2399-2400)
    expect(drSettingsOf(with_(DR, { keyLogic: "dangerous" }))).toMatchObject({
      dangerousKeyLogic: true,
      strictKeyLogic: false,
    });
    expect(doorNotes(with_(DR, { keyLogic: "dangerous" }))[1]).toBe(
      "Its dangerous key logic: a key door is in logic once the keys of its worst case are found.",
    );
    // The entrance randomizer's key rules, in DR's world (static.ts)
    const fixed = with_(DR, { keyLogic: "static" });
    expect(unmodelledReasons(fixed)).toEqual([]);
    expect(doorLogic(fixed)).toBe(true);
    expect(drSettingsOf(fixed)).toMatchObject({
      staticKeyLogic: true,
      strictKeyLogic: false,
    });
    expect(doorNotes(fixed)[1]).toBe(
      "Its static key logic: each key door asks the entrance randomizer's number of keys, those from chests.",
    );
    // DR rolls none with key drops or key pots shuffled
    for (const change of [
      { dropShuffle: "keys" },
      { pottery: "keys" },
    ] as const)
      expect(unmodelledReasons(with_(fixed, change))).toEqual([
        "DR's static key logic with shuffled key drops",
      ]);
    expect(unmodelledReasons(with_(fixed, { pottery: "cave" }))).toEqual([]);
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
      [{ enemyShuffle: "shuffled" }, "shuffled enemies"],
      [
        { doorEntrances: "district", randomizer: "owr" },
        "the Door Randomizer's District entrance shuffle",
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

  it("reads every DR entrance shuffle in DR's world, never the entrance randomizer's", () => {
    const cases: Partial<RunSettings>[] = [
      { entranceShuffle: "simple" },
      { dungeonItems: "standard" },
      { mode: "retro" },
    ];
    for (const change of cases) {
      const run = with_(DR_CROSSKEYS, change);
      expect(crossedLogic(run)).toBe(false);
      expect(doorLogic(run)).toBe(true);
      expect(unmodelledReasons(run)).toEqual([]);
      // An alttpr.com seed of the same settings is that world's
      const vt = with_(getPreset("crosskeys").settings, change);
      expect(crossedLogic(vt)).toBe(true);
      expect(unmodelledReasons(vt)).toEqual([]);
    }
    // Its bosses moved: DR's world reads each dungeon's own
    expect(
      unmodelledReasons(with_(DR_CROSSKEYS, { bossShuffle: "full" })),
    ).toEqual(["shuffled bosses in a Door Randomizer seed"]);
  });

  it("models key drops in DR's world, and with keys in their dungeons in v31's", () => {
    const keydrop = { dropShuffle: "keys", pottery: "keys" } as const;
    expect(unmodelledReasons(with_(DR, keydrop))).toEqual([]);
    // DR's world counts the drops' keys, wild or not
    const keysanity = with_(DR, { ...keydrop, dungeonItems: "full" });
    expect(doorLogic(keysanity)).toBe(true);
    expect(unmodelledReasons(keysanity)).toEqual([]);
    // Crosskeys keydrop too, in DR's world on its noted entrances; v31's
    // key model would count too few keys, which the reason says where DR's
    // world does not hold a run
    const crosskeys = with_(DR_CROSSKEYS, keydrop);
    expect(unmodelledReasons(crosskeys)).toEqual([]);
    expect(doorLogic(crosskeys)).toBe(true);
    expect(crossedLogic(crosskeys)).toBe(false);
    expect(doorReasons(crosskeys, true)).toEqual([
      "shuffled key drops with keys outside their dungeons",
    ]);
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

  it("offer DR's own entrance shuffles, in DR's words and order", () => {
    // DR 1.5.8's GUI (resources/app/gui/randomize/entrando/widgets.json,
    // lang/en.json)
    expect(doorEntranceModes("dr").map(([, words]) => words)).toEqual([
      "Vanilla",
      "Simple",
      "Restricted",
      "Full",
      "Lite",
      "Lean",
      "Swapped",
      "Crossed",
      "Insanity",
      "Dungeons + Full",
      "Dungeons + Simple",
    ]);
    // The Overworld fork's adds District after Lean
    expect(doorEntranceModes("owr").map(([mode]) => mode)).toContain(
      "district",
    );
    expect(doorEntranceModes("owr")[6]?.[0]).toBe("district");
    expect(doorEntranceModes("dr").map(([mode]) => mode)).not.toContain(
      "district",
    );
    // A run's: DR's own, else alttpr.com's of the same name
    expect(doorEntranceOf(DR)).toBe("vanilla");
    expect(doorEntranceOf(DR_CROSSKEYS)).toBe("crossed");
    expect(doorEntranceOf(with_(DR, { doorEntrances: "lite" }))).toBe("lite");
    expect(doorEntranceText(DR_CROSSKEYS)).toBe("Crossed");
    expect(doorEntranceText(with_(DR, { doorEntrances: "dungeonsfull" }))).toBe(
      "Dungeons + Full",
    );
    // A change sets one and clears the other, so a run never holds two
    expect(doorEntranceChange("lean")).toEqual({
      doorEntrances: "lean",
      entranceShuffle: "none",
    });
    expect(doorEntranceChange("insanity")).toEqual({
      doorEntrances: undefined,
      entranceShuffle: "insanity",
    });
    expect(doorEntranceChange("vanilla")).toEqual({
      doorEntrances: undefined,
      entranceShuffle: "none",
    });
    // DR's own leave alttpr.com's at none, yet the entrances are shuffled
    expect(entrancesShuffled(with_(DR, { doorEntrances: "swapped" }))).toBe(
      true,
    );
    expect(entrancesShuffled(DR)).toBe(false);
    expect(entrancesShuffled(DR_CROSSKEYS)).toBe(true);
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

describe("the DR version a run keeps", () => {
  it("reads a version as the release whose logic it is, older and newer folded", () => {
    expect(
      ["1.5.2", "1.5.6-u", "1.5.7-u", "1.5.8", "1.5.10", "1.6.0"].map(
        doorVersionOf,
      ),
    ).toEqual(["1.5.6", "1.5.6", "1.5.7", "1.5.8", "1.5.8", "1.5.8"]);
    expect([null, undefined, "hth", ""].map(doorVersionOf)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("takes it from the seed, else keeps the run's, 1.5.6 when none", () => {
    // DRVersionInfo, the ROM's text
    expect(
      doorFromSeed(read({ version: { known: true, value: "1.5.7" } }), {}),
    ).toMatchObject({ doorVersion: "1.5.7" });
    // The title's digits when the text is not read (Race Mode)
    const title = {
      ...read({ version: { known: false, why: "race-mode" } }),
      randomizer: { kind: "door", overworld: false, version: "1.5.8" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(title, {})).toMatchObject({ doorVersion: "1.5.8" });
    // A title of a site's tag tells none: the run's stands
    const tag = {
      ...read({ version: { known: false, why: "race-mode" } }),
      randomizer: { kind: "door", overworld: true, version: null },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(tag, { doorVersion: "1.5.7" })).toMatchObject({
      doorVersion: "1.5.7",
    });
    // 1.5.6, the default, is left out of what a run holds
    expect(doorFromSeed(read({}), {})).not.toHaveProperty("doorVersion");
    expect(isDoorSettings({ doorVersion: "1.5.8", randomizer: "dr" })).toBe(
      true,
    );
    expect(isDoorSettings({ doorVersion: "1.5.9", randomizer: "dr" })).toBe(
      false,
    );
  });

  it("hands DR's world the release, the Inverted save point's way out with it", () => {
    expect(drSettingsOf(DR)).toMatchObject({ drVersion: 156 });
    expect(drSettingsOf(with_(DR, { doorVersion: "1.5.7" }))).toMatchObject({
      drVersion: 157,
    });
    expect(drSettingsOf(with_(DR, { doorVersion: "1.5.8" }))).toMatchObject({
      drVersion: 158,
    });
    expect(doorLogic(with_(DR, { doorVersion: "1.5.8" }))).toBe(true);
    // The fork's world is OWR 0.8.0.2's, on DR 1.5.7: never more, an older
    // or unknown base read as 1.5.6; its bonk drops as the run says
    const owr = with_(DR, { bonkDrops: true, randomizer: "owr" });
    expect(drSettingsOf(owr)).toMatchObject({
      bonkDrops: true,
      drVersion: 156,
    });
    for (const doorVersion of ["1.5.7", "1.5.8"] as const)
      expect(drSettingsOf(with_(owr, { doorVersion }))).toMatchObject({
        drVersion: 157,
      });
    expect(drSettingsOf(DR)).not.toHaveProperty("bonkDrops");
  });
});

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
          followers: known(false),
          layout: known("wild"),
          mixed: known(false),
          prizeShuffle: known("inside"),
          version: known("0.8.0.0"),
          whirlpool: known(true),
        },
      },
      randomizer: { kind: "door", overworld: true, version: "1.5.6" },
    } as unknown as SeedSettingsReading;
    // Prizes inside the dungeons: none or dungeon, which the ROM never
    // tells apart, so not known (unset) unless the run says which
    expect(doorFromSeed(rom, { owCrossed: "grouped" })).toEqual({
      bonkDrops: true,
      owCrossed: "grouped",
      owFluteShuffle: "random",
      owLayout: "wild",
      owWhirlpool: true,
      randomizer: "owr",
      shuffleFollowers: false,
    });
    expect(doorFromSeed(rom, { prizeShuffle: "dungeon" })).toMatchObject({
      prizeShuffle: "dungeon",
    });
    expect(doorFromSeed(rom, { prizeShuffle: "none" })).toMatchObject({
      prizeShuffle: "none",
    });
    expect(doorFromSeed(rom, { prizeShuffle: "wild" })).not.toHaveProperty(
      "prizeShuffle",
    );
    const moved = (prizes: string, followers: boolean) =>
      ({
        ...rom,
        door: {
          ...rom.door,
          overworld: {
            ...rom.door?.overworld,
            followers: known(followers),
            prizeShuffle: known(prizes),
          },
        },
      }) as unknown as SeedSettingsReading;
    expect(doorFromSeed(moved("nearby", true), {})).toMatchObject({
      prizeShuffle: "nearby",
      shuffleFollowers: true,
    });
    expect(doorFromSeed(moved("wild", false), {})).toMatchObject({
      prizeShuffle: "wild",
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
          followers: true,
          layout: "vanilla",
          mixed: true,
          prizeShuffle: "wild",
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
      doorVersion: "1.5.8",
      enemyShuffle: "shuffled",
      owCrossed: "polar",
      owFluteShuffle: "balanced",
      owMixed: true,
      // A pottery mode the tracker has no option for keeps the run's
      pottery: "keys",
      prizeShuffle: "wild",
      randomizer: "owr",
      shuffleFollowers: true,
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
    // DR's defaults are left out, the bomb bag kept (it has none: unset is
    // not known); a meta without them keeps the run's
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
    ).toEqual({ bombBag: false, randomizer: "dr" });
    // A ROM's item substitutions tell it; unread, the run's own, unset
    const rom = (bombBag: unknown) =>
      ({
        door: { bombBag, version: { known: false, why: "not-read" } },
        randomizer: { kind: "door", overworld: false, version: "1.5.6" },
      }) as unknown as SeedSettingsReading;
    expect(doorFromSeed(rom({ known: true, value: true }), {})).toEqual({
      bombBag: true,
      randomizer: "dr",
    });
    expect(doorFromSeed(rom({ known: false, why: "race-mode" }), {})).toEqual({
      randomizer: "dr",
    });
    expect(unmodelledReasons({ ...DR, bombBag: undefined })).toEqual([
      BOMB_BAG_NOT_KNOWN,
    ]);
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
