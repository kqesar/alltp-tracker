import {
  OVERWORLD_RANDOMIZER_VERSION,
  type SeedSettingsReading,
} from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import {
  bonkDropsOf,
  DOOR_LOCATION_IDS,
  DOOR_OPTIONS,
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
  flipGroupsOf,
  forcedWhirlpoolOf,
  GOALS_NOT_KNOWN,
  isDoorSettings,
  OVERWORLD_NOT_KNOWN,
  OWR_VERSION_NOT_KNOWN,
  overworldShufflesOf,
  owrNotesOf,
  owrVersionOf,
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

// The run types with the bomb bag off (not known, it reads as on with its
// upgrade not known: a check that wants bombs is maybe)
const DR = { ...getPreset("door-randomizer").settings, bombBag: false };
const DR_CROSSKEYS = {
  ...getPreset("door-crosskeys").settings,
  bombBag: false,
};
/**
 * An OWR run of the fork's pinned release whose overworld, prize and
 * follower shuffles are set: none of any.
 */
const OWR = {
  customGoals: false,
  owCrossed: "none",
  owFluteShuffle: "vanilla",
  owLayout: "vanilla",
  owMixed: false,
  owrVersion: "0.8.0.2",
  owWhirlpool: false,
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

  it("holds an OWR run to the fork's release the pack ports", () => {
    // 0.8.0.0 and 0.8.0.1 ask the pearl to cross Paradox Cave's top and
    // Death Mountain Return Cave's right side (owr800:Rules.py:1816-1818),
    // 0.8.0.2 does not: the world, 0.8.0.2's, would read yes there
    expect(DOOR_OPTIONS.owrVersion[0][0]).toBe(OVERWORLD_RANDOMIZER_VERSION);
    expect(owrVersionOf("0.8.0.2-u")).toBe("0.8.0.2");
    expect(owrVersionOf("0.8.0.0")).toBe("other");
    expect(owrVersionOf("0.8.0.1-u")).toBe("other");
    expect(owrVersionOf("0.7.1.0")).toBe("other");
    expect(owrVersionOf("1.5.7")).toBeUndefined();
    expect(owrVersionOf(undefined)).toBeUndefined();
    const older = with_(DR, { ...OWR, owrVersion: "other" });
    expect(doorLogic(older)).toBe(false);
    expect(unmodelledReasons(older)).toEqual([
      "an Overworld Randomizer release other than 0.8.0.2",
    ]);
    const unknown = with_(DR, { ...OWR, owrVersion: undefined });
    expect(doorLogic(unknown)).toBe(false);
    expect(unmodelledReasons(unknown)).toEqual([OWR_VERSION_NOT_KNOWN]);
    expect(doorRows(unknown)).toContain("owrVersion");
    expect(doorRows(DR)).not.toContain("owrVersion");
    // A spoiler's meta names it (`versions.Overworld`), a ROM its table
    const meta = (version: string | undefined) =>
      ({
        doorExact: {
          doorShuffle: "vanilla",
          dropShuffle: "none",
          enemyShuffle: "none",
          overworld: {
            bonkDrops: false,
            crossed: "none",
            fluteShuffle: "vanilla",
            layout: "vanilla",
            mixed: false,
            version,
            whirlpool: false,
          },
          pottery: "none",
          shopsanity: false,
          takeAny: "none",
        },
        randomizer: { kind: "door", overworld: true, version: "1.5.6" },
      }) as unknown as SeedSettingsReading;
    expect(doorFromSeed(meta("0.8.0.0"), DR)).toMatchObject({
      owrVersion: "other",
    });
    expect(doorFromSeed(meta("0.8.0.2-u"), DR)).toMatchObject({
      owrVersion: "0.8.0.2",
    });
    expect(doorFromSeed(meta(undefined), DR)?.owrVersion).toBeUndefined();
    const rom = (overworld: boolean) =>
      ({
        door: {
          overworld: { version: { known: true, value: "0.8.0.0" } },
          version: { known: false, why: "unrecognized" },
        },
        randomizer: { kind: "door", overworld, version: "1.5.6" },
      }) as unknown as SeedSettingsReading;
    expect(doorFromSeed(rom(true), DR)).toMatchObject({ owrVersion: "other" });
    // A DR seed keeps none
    expect(doorFromSeed(rom(false), DR)?.owrVersion).toBeUndefined();
  });

  it("reads an OWR run's overworld not stated as not known, never off", () => {
    // Each of its shuffles unset: any may be on, so nothing vanilla holds
    for (const key of [
      "owLayout",
      "owCrossed",
      "owMixed",
      "owWhirlpool",
      "owFluteShuffle",
    ] as const) {
      const run = with_(DR, { ...OWR, [key]: undefined });
      expect(unmodelledReasons(run), key).toEqual([OVERWORLD_NOT_KNOWN]);
      expect(doorLogic(run), key).toBe(false);
      expect(doorValueText(key, run[key]), key).toBe("Not known");
    }
    // DR itself has no overworld shuffle: unset reads as none
    expect(unmodelledReasons(DR)).toEqual([]);
    // Bonk drops not known: no bonk bomb farm in the fork's world
    // (owr:ItemList.py:731-734), their places not listed, nothing else held
    const bonks = with_(DR, OWR);
    expect(unmodelledReasons(bonks)).toEqual([]);
    expect(bonkDropsOf(bonks)).toBe(false);
    expect(drSettingsOf(bonks)).toMatchObject({ bonkDrops: true });
    expect(drSettingsOf(with_(bonks, { bonkDrops: false }))).toMatchObject({
      bonkDrops: false,
    });
    // A meta that does not name one, or names a value the tracker does not
    // know: not known, never the run's default
    const seed = (overworld: Record<string, unknown>) =>
      ({
        doorExact: {
          doorShuffle: "vanilla",
          dropShuffle: "none",
          enemyShuffle: "none",
          overworld: { layout: "vanilla", version: "0.8.0.2", ...overworld },
          pottery: "none",
          shopsanity: false,
          takeAny: "none",
        },
        randomizer: { kind: "door", overworld: true, version: "1.5.7" },
      }) as unknown as SeedSettingsReading;
    const unnamed = doorFromSeed(seed({}), DR);
    for (const key of [
      "owCrossed",
      "owMixed",
      "owWhirlpool",
      "owFluteShuffle",
      "bonkDrops",
    ] as const)
      expect(unnamed?.[key], key).toBeUndefined();
    expect(unnamed).toMatchObject({ owLayout: "vanilla" });
    expect(
      doorFromSeed(seed({ crossed: "sideways", layout: "maze" }), DR),
    ).not.toHaveProperty("owCrossed");
    expect(doorFromSeed(seed({ layout: "maze" }), DR)).not.toHaveProperty(
      "owLayout",
    );
    // A ROM whose fork table is not recognized states none of them
    const unknown = { known: false, why: "unrecognized" };
    const rom = {
      door: {
        overworld: Object.fromEntries(
          [
            "bonkDrops",
            "crossed",
            "fluteShuffle",
            "followers",
            "layout",
            "mixed",
            "prizeShuffle",
            "version",
            "whirlpool",
          ].map((key) => [key, unknown]),
        ),
        version: unknown,
      },
      randomizer: { kind: "door", overworld: true, version: "1.5.7" },
    } as unknown as SeedSettingsReading;
    const read = doorFromSeed(rom, DR) ?? {};
    expect(read.owMixed).toBeUndefined();
    expect(unmodelledReasons(with_(DR, read))).toContain(OVERWORLD_NOT_KNOWN);
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
    // Keys or items placed nearby: the fork's own placement, not read
    expect(unmodelledReasons(with_(DR, { ...OWR, nearbyItems: true }))).toEqual(
      ["dungeon items placed nearby"],
    );
    // Mixed: its flips noted (none yet: nothing they decide in logic)
    const mixed = with_(DR, { ...OWR, owMixed: true });
    expect(unmodelledReasons(mixed)).toEqual([]);
    expect(owrNotesOf(mixed, {})).toEqual({ flips: {} });
    expect(owrNotesOf(mixed, { flips: { "44": true } })).toEqual({
      flips: { "44": true },
    });
    // The map says where the overworld waits for its notes
    expect(doorNotes(mixed)[1]).toBe(
      "Its overworld is shuffled (screens flipped by Mixed): the logic follows what you note in the Overworld tab, and what is not noted there leads nowhere.",
    );
    expect(
      doorNotes(
        with_(DR, {
          ...OWR,
          owCrossed: "grouped",
          owFluteShuffle: "random",
          owWhirlpool: true,
        }),
      )[1],
    ).toBe(
      "Its overworld is shuffled (whirlpools, flute spots and edges crossed): the logic follows what you note in the Overworld tab, and what is not noted there leads nowhere.",
    );
    expect(doorNotes(with_(DR, OWR))).toHaveLength(1);
    expect(overworldShufflesOf(mixed)).toEqual({
      crossings: false,
      flips: true,
      flute: false,
      whirlpools: false,
    });
    // Polar with Mixed: its edges stay vanilla, which the world reads
    expect(
      owrNotesOf(with_(DR, { ...OWR, owCrossed: "polar", owMixed: true }), {}),
    ).toEqual({ flips: {}, polar: true });
    // What the fork's world does not model yet stays named
    expect(unmodelledReasons(with_(DR, { ...OWR, owLayout: "wild" }))).toEqual([
      "the Wild overworld layout",
    ]);
    // Not known (a ROM that cannot tell none from dungeon, a race): never
    // read as none, each named until the player sets it
    expect(unmodelledReasons(with_(DR, { randomizer: "owr" }))).toEqual([
      OVERWORLD_NOT_KNOWN,
      OWR_VERSION_NOT_KNOWN,
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
    // shuffles by `doorEntrances`
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
    // Every shuffle of the fork, District among them, in its own world, by
    // its own pools (EntranceShuffle2.py `modes`, :2158-2768); alttpr.com's
    // names by `entranceShuffle`, the fork's others by `doorEntrances`
    for (const change of [
      { doorEntrances: "district" },
      { doorEntrances: "swapped" },
      { doorEntrances: "lite" },
      { doorEntrances: "lean" },
      { doorEntrances: "dungeonssimple" },
      { doorEntrances: "dungeonsfull" },
      { entranceShuffle: "simple" },
      { entranceShuffle: "restricted" },
      { entranceShuffle: "full" },
      { entranceShuffle: "crossed" },
      { entranceShuffle: "insanity" },
      { entranceShuffle: "crossed", mode: "inverted" },
      { entranceShuffle: "crossed", mode: "standard" },
      { doorEntrances: "lite", mode: "standard" },
      { doorShuffle: "crossed", entranceShuffle: "crossed" },
    ] as const) {
      const run = with_(DR, { ...OWR, ...change });
      expect(doorShuffleOf(run)).toBe(
        "doorEntrances" in change
          ? change.doorEntrances
          : change.entranceShuffle,
      );
      expect(doorLogic(run)).toBe(true);
      expect(unmodelledReasons(run)).toEqual([]);
      expect(entrancesKnown(run)).toBe(true);
    }
    // District is the fork's alone
    expect(doorShuffleOf(with_(DR, { doorEntrances: "district" }))).toBe(
      undefined,
    );
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
      // Below intensity 3, coupled, entrances vanilla: DR's own analysis
      // once a dungeon is noted whole (the pack's key-analysis/noted.ts)
      const coupled = { decoupledDoors: false, doorIntensity: "2" } as const;
      expect(doorNotes(with_(run, coupled))[1]).toBe(
        "Its doors are shuffled: the logic follows the doors you note in the Doors tab, a door not noted leads nowhere, and a key door asks every key of its dungeon until every door of the dungeon is noted, when DR's own key analysis counts them.",
      );
      // The coupling not known reads as decoupled (no analysis), as the
      // world reads it
      expect(doorNotes(with_(run, { doorIntensity: "2" }))[1]).toMatch(
        /asks every key of its dungeon\.$/,
      );
      expect(
        doorNotes(with_(run, { decoupledDoors: true, doorIntensity: "1" }))[1],
      ).toMatch(/asks every key of its dungeon\.$/);
      expect(
        doorNotes(with_(run, { ...coupled, doorEntrances: "lite" }))[1],
      ).toMatch(/asks every key of its dungeon\.$/);
      // DR's analysis reads DR's data alone: an OWR door shuffle's key doors
      // stay strict-safe
      expect(doorNotes(with_(run, { ...OWR, ...coupled }))[1]).toMatch(
        /asks every key of its dungeon\.$/,
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
    // Unset, the intensity reads as 3: every portal's lobby may move; the
    // coupling as decoupled: no way back is inferred from a door noted
    expect(doorShuffleSettingsOf(basic)).toEqual({
      decoupled: true,
      intensity: 3,
      shuffle: "basic",
      trapMode: "oneway",
    });
    expect(doorValueText("doorIntensity", undefined)).toBe("Not known");
    expect(doorValueText("decoupledDoors", undefined)).toBe("Not known");
    expect(
      doorShuffleSettingsOf(with_(basic, { decoupledDoors: false })),
    ).toMatchObject({ decoupled: false });
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

  it("models an OWR run's moved flute spots and whirlpools on the notes", () => {
    const run = with_(DR, {
      ...OWR,
      owFluteShuffle: "random",
      owWhirlpool: true,
    });
    expect(unmodelledReasons(run)).toEqual([]);
    expect(doorLogic(run)).toBe(true);
    // Nothing noted yet: each shuffle's own, none of it leading anywhere
    const none = {};
    expect(owrNotesOf(run, none)).toEqual({ flute: [], whirlpools: {} });
    expect(owrNotesOf(run, none)).toBe(owrNotesOf(run, none));
    const noted = { flute: [0x18], whirlpools: { a: "b" } };
    expect(owrNotesOf(run, noted)).toEqual(noted);
    // A shuffle off is linked as vanilla; DR has none of them
    expect(owrNotesOf(with_(DR, OWR), noted)).toEqual({});
    expect(owrNotesOf(DR, noted)).toBeUndefined();
    expect(
      unmodelledReasons(with_(DR, { owWhirlpool: true, randomizer: "dr" })),
    ).toContain("shuffled whirlpools");
  });

  it("models an OWR run's crossed edges on the crossings noted, Polar's as none", () => {
    for (const owCrossed of ["grouped", "unrestricted"] as const) {
      const run = with_(DR, { ...OWR, owCrossed });
      expect(unmodelledReasons(run), owCrossed).toEqual([]);
      expect(doorLogic(run)).toBe(true);
      expect(owrNotesOf(run, {})).toEqual({ crossings: {} });
      expect(overworldShufflesOf(run)).toEqual({
        crossings: true,
        flips: false,
        flute: false,
        whirlpools: false,
      });
      const noted = { crossings: { "Lost Woods SW": true } };
      expect(owrNotesOf(run, noted)).toEqual(noted);
    }
    // Polar crosses nothing without Mixed: linked as vanilla
    const polar = with_(DR, { ...OWR, owCrossed: "polar" });
    expect(unmodelledReasons(polar)).toEqual([]);
    expect(owrNotesOf(polar, {})).toEqual({});
    expect(overworldShufflesOf(polar)).toBeUndefined();
    // DR itself has no crossed overworld
    expect(
      unmodelledReasons(with_(DR, { owCrossed: "grouped", randomizer: "dr" })),
    ).toContain("a crossed overworld");
  });

  it("offers Mixed's groups that may flip, and pairs the whirlpools no shuffle chooses", () => {
    const mixed = with_(DR, { ...OWR, owMixed: true });
    const groups = flipGroupsOf(mixed);
    expect(groups).toHaveLength(27);
    expect(groups.some((g) => g.screens.includes(0x13))).toBe(false);
    // Crossed, the special screens stand apart
    expect(
      flipGroupsOf(with_(DR, { ...OWR, owCrossed: "grouped", owMixed: true }))
        .length,
    ).toBeGreaterThan(27);
    expect(flipGroupsOf(with_(DR, OWR))).toEqual([]);
    // OverworldShuffle.py:370-413
    const pools = with_(DR, { ...OWR, owWhirlpool: true });
    expect(forcedWhirlpoolOf("Qirn Jump Whirlpool", pools)).toBe(
      "Bomber Corner Whirlpool",
    );
    expect(forcedWhirlpoolOf("C Whirlpool", pools)).toBeUndefined();
    expect(
      forcedWhirlpoolOf(
        "Bomber Corner Whirlpool",
        with_(DR, {
          ...OWR,
          owCrossed: "polar",
          owMixed: true,
          owWhirlpool: true,
        }),
      ),
    ).toBe("Qirn Jump Whirlpool");
    for (const change of [
      { owCrossed: "grouped" as const },
      { owMixed: true },
      { owWhirlpool: false },
    ])
      expect(
        forcedWhirlpoolOf(
          "Qirn Jump Whirlpool",
          with_(DR, { ...OWR, owWhirlpool: true, ...change }),
        ),
      ).toBeUndefined();
  });

  it("names every cause it cannot model, and models none of them", () => {
    const cases: [Partial<RunSettings>, string][] = [
      [{ enemyShuffle: "shuffled" }, "shuffled enemies"],
      [{ owLayout: "grid", randomizer: "owr" }, "the Grid overworld layout"],
      [{ owMixed: true, randomizer: "dr" }, "a mixed overworld"],
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
    // Not of the kind: cave and key pots, never key pots, which would keep
    // Lite's and Lean's pottery caves vanilla (EntranceShuffle2.py:
    // 1064-1066) where cave pots or lottery shuffle them
    expect(doorFromSeed(pots, { pottery: "cave" })).toMatchObject({
      pottery: "cavekeys",
    });
    expect(doorFromSeed(pots, {})).toMatchObject({ pottery: "cavekeys" });
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
      // Stated off: kept, an OWR run's overworld having no default
      owMixed: false,
      // The fork's table names 0.8.0.0: not the release the pack ports
      owrVersion: "other",
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
    // FreeItemText's $40: a dungeon item kind placed nearby, a cause the
    // run then names; its absence none
    const nearby = (value: boolean) =>
      doorFromSeed(
        {
          ...rom,
          door: {
            ...rom.door,
            overworld: { ...rom.door?.overworld, nearbyItems: known(value) },
          },
        } as unknown as SeedSettingsReading,
        {},
      );
    expect(nearby(true)).toMatchObject({ nearbyItems: true });
    expect(nearby(false)).not.toHaveProperty("nearbyItems");
    expect(
      doorFromSeed(
        {
          doorExact: {
            doorShuffle: "vanilla",
            dropShuffle: "none",
            enemyShuffle: "none",
            overworld: {
              bonkDrops: false,
              crossed: "none",
              fluteShuffle: "vanilla",
              layout: "vanilla",
              mixed: false,
              nearbyItems: true,
              whirlpool: false,
            },
            pottery: "none",
            shopsanity: false,
            takeAny: "none",
          },
          randomizer: { kind: "door", overworld: true, version: "1.5.7" },
        } as unknown as SeedSettingsReading,
        {},
      ),
    ).toMatchObject({ nearbyItems: true });
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
    // An OWR run's overworld stated off is kept: it has no default
    expect(doorFromSeed(meta, { pottery: "keys" })).toEqual({
      bonkDrops: false,
      doorEntrances: "lite",
      doorVersion: "1.5.8",
      enemyShuffle: "shuffled",
      owCrossed: "polar",
      owFluteShuffle: "balanced",
      owLayout: "vanilla",
      owMixed: true,
      owWhirlpool: false,
      // A pottery mode the tracker has no option for: cave and key pots,
      // never the run's (another seed's)
      pottery: "cavekeys",
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
    // Partial is DR's default: left out; a name it does not know reads as
    // strict, which asks the most, never the run's (another seed's)
    expect(doorFromSeed(exact({ keyLogic: "partial" }, false), {})).toEqual({
      randomizer: "dr",
    });
    expect(
      doorFromSeed(exact({ keyLogic: "newer" }, false), {
        keyLogic: "dangerous",
      }),
    ).toEqual({ keyLogic: "strict", randomizer: "dr" });
    expect(
      doorFromSeed(exact({ doorEntrances: "district" }, false), {}),
    ).toEqual({ randomizer: "dr" });
    expect(
      doorFromSeed(exact({ doorEntrances: "district" }, true), {}),
    ).toEqual({ doorEntrances: "district", randomizer: "owr" });
  });

  it("lays none of an earlier run's settings on a seed", () => {
    // An OWR Mixed District run with its bonk drops, then a DR Crosskeys
    // seed loaded from its meta (bench seeds c0PDd2qiJ, toInhuUYy)
    const owr: RunSettings = {
      ...DR,
      ...OWR,
      bonkDrops: true,
      doorEntrances: "district",
      nearbyItems: true,
      owMixed: true,
      prizeShuffle: "wild",
      randomizer: "owr",
      shuffleFollowers: true,
      shuffleLinks: false,
    };
    const crosskeys = {
      doorExact: {
        doorShuffle: "vanilla",
        dropShuffle: "none",
        enemyShuffle: "none",
        keyLogic: "partial",
        pottery: "none",
        shopsanity: false,
        shuffleLinks: false,
        shuffleTavern: false,
        takeAny: "none",
      },
      entrances: { known: true, value: "crossed" },
      randomizer: { kind: "door", overworld: false, version: "1.5.8" },
    } as unknown as SeedSettingsReading;
    expect(doorFromSeed(crosskeys, owr)).toEqual({
      doorVersion: "1.5.8",
      randomizer: "dr",
      shuffleLinks: false,
      shuffleTavern: false,
    });
    // A DR ROM read on that run keeps none of the fork's either
    const rom = {
      door: { version: { known: false, why: "unrecognized" } },
      randomizer: { kind: "door", overworld: false, version: "1.5.8" },
    } as unknown as SeedSettingsReading;
    const read = doorFromSeed(rom, owr) ?? {};
    for (const key of [
      "bonkDrops",
      "customGoals",
      "doorEntrances",
      "nearbyItems",
      "owMixed",
      "owrVersion",
      "prizeShuffle",
      "shuffleFollowers",
    ] as const)
      expect(read, key).not.toHaveProperty(key);
    // Its own hand-set settings a ROM states none of stay
    expect(read).toMatchObject({ shuffleLinks: false });
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
    // On or not known, modelled: on with its upgrade not known
    expect(unmodelledReasons({ ...DR, bombBag: undefined })).toEqual([]);
    expect(unmodelledReasons({ ...DR, bombBag: true })).toEqual([]);
    expect(drSettingsOf({ ...DR, bombBag: undefined }).bombBag).toBe(true);
    expect(drSettingsOf({ ...DR, bombBag: false }).bombBag).toBe(false);
    // Not named: DR's default, never the run's (another seed's)
    expect(doorFromSeed(exact({}), { potShuffle: true })).toEqual({
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
