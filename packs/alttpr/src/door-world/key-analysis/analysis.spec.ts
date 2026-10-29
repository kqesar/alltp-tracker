// DR's key analysis on the vanilla world (analysis.ts), held to what
// KeyDoorShuffle.py's own validator expects of it
// (test/dr-upstream/vanilla-key-logic.json, written by import-dr.mjs from
// validate_vanilla_key_logic, :1919-2093). No code of DR calls that
// validator, so a check it fails on DR's own code is listed below with why.
import { describe, expect, it } from "vitest";
import fixture from "../../../test/dr-upstream/vanilla-key-logic.json" with {
  type: "json",
};
import { KEY_DROPS } from "../keys";
import { type DoorRule, type KeyLogic, vanillaKeyLogic } from "./analysis";
import type { KeyAnalysisSettings } from "./dungeon";

type Mode = KeyAnalysisSettings["mode"];
const MODES: readonly Mode[] = ["open", "standard", "inverted"];
const settingsOf = (
  mode: Mode,
  more: Partial<KeyAnalysisSettings> = {},
): KeyAnalysisSettings => ({
  accessibility: "items",
  bigKeyShuffle: false,
  dropShuffleNone: true,
  forcedDrops: new Set(KEY_DROPS.map((d) => d.location)),
  keyShuffle: "none",
  mode,
  ...more,
});
const LOGIC = new Map(MODES.map((m) => [m, vanillaKeyLogic(settingsOf(m))]));
const logicOf = (mode: Mode, dungeon: string): KeyLogic => {
  const found = LOGIC.get(mode)?.get(dungeon);
  if (found === undefined) throw new RangeError(`No ${dungeon}`);
  return found;
};
const ruleOf = (mode: Mode, dungeon: string, door: string): DoorRule => {
  const found = logicOf(mode, dungeon).doorRules.get(door);
  if (found === undefined) throw new RangeError(`No rule for ${door}`);
  return found;
};

/**
 * The validator's checks the port answers otherwise, by `function:line`,
 * each with why. All three are Ganons Tower's: its doors' numbers here
 * are DR's code's, a key above what the validator once expected, and
 * upstream doubts its own figures there ("should be 7?", "not sure about
 * this 6", :2071-2072).
 */
const STALE: Readonly<Record<string, string>> = {
  "val_ganons:2068":
    "GT Hookshot ES: 8 keys and the map chest allowed to hold its own key here, 7 and no allowance in the validator; the counters spend every other GT door first; a location with no allowance cannot be, check_for_self_lock_key sets both or neither (:871-874)",
  "val_ganons:2069":
    "GT Tile Room EN: 7 here; and vanilla_key_logic adds the Conveyor Star Pits door's big key locations to it (DoorShuffle.py:305-309) after the validator's era",
  "val_ganons:2070":
    "GT Firesnake Room SW: 8 here; the same adjustment adds the Conveyor Star Pits door's big key locations (DoorShuffle.py:305-307)",
};

/** What the validator asserts of a rule (val_rule, :2082-2092). */
const ruleHolds = (
  rule: DoorRule | undefined,
  check: (typeof fixture.dungeons)[number]["checks"][number],
): boolean => {
  const locations = (check.alternateBigKeyLoc ?? []) as readonly string[];
  return (
    rule !== undefined &&
    rule.smallKeyNum === check.smallKeyNum &&
    rule.allowSmall === check.allowSmall &&
    (rule.smallLocation?.name ?? null) === (check.smallLocation ?? null) &&
    rule.alternateSmallKey === (check.alternateSmallKey ?? null) &&
    rule.alternateBigKeyLoc.size === locations.length &&
    [...rule.alternateBigKeyLoc].every((loc) => locations.includes(loc.name))
  );
};

describe("DR's key analysis against validate_vanilla_key_logic", () => {
  it("is the validator no code calls", () => {
    expect(fixture.called).toBe(false);
    expect(fixture.dungeons).toHaveLength(13);
  });

  for (const { checks, dungeon, function: name } of fixture.dungeons)
    it(`holds ${name} (${dungeon})`, () => {
      const failures: string[] = [];
      for (const check of checks)
        for (const mode of check.modes as Mode[]) {
          const logic = logicOf(mode, dungeon);
          const holds =
            check.kind === "rule"
              ? ruleHolds(logic.doorRules.get(check.door ?? ""), check)
              : check.kind === "bkRestricted"
                ? [...logic.bkRestricted].some((l) => l.name === check.location)
                : logic.bkRestricted.size === check.count;
          const key = `${name}:${check.line}`;
          if (STALE[key] !== undefined) {
            if (holds) failures.push(`${key} ${mode}: listed, but holds`);
          } else if (!holds)
            failures.push(`${key} ${mode}: ${JSON.stringify(check)}`);
        }
      expect(failures).toEqual([]);
    });
});

describe("DR's key analysis", () => {
  it("caps the worst case at the rule's own number, partial's figure", () => {
    // Mire's spikes: the worst case spends 3 keys first, the drop behind
    // the door gives one back (create_rule, :842-858)
    const spikes = ruleOf("open", "Misery Mire", "Mire Spikes NW");
    expect([spikes.worstCase, spikes.smallKeyNum]).toEqual([4, 3]);
  });

  it("makes vanilla_key_logic's adjustments", () => {
    // The escape's doors once the drops are forced (DoorShuffle.py:279-288)
    expect(
      ruleOf("open", "Hyrule Castle", "Sewers Dark Cross Key Door N").worstCase,
    ).toBe(2);
    const shuffled = vanillaKeyLogic(
      settingsOf("open", { dropShuffleNone: false }),
    );
    expect(
      shuffled
        .get("Hyrule Castle")
        ?.doorRules.get("Sewers Dark Cross Key Door N")?.worstCase,
    ).toBe(3);
    // Palace of Darkness's front door asks one key, not six (:290-293)
    expect(
      ruleOf("open", "Palace of Darkness", "PoD Middle Cage N"),
    ).toMatchObject({ smallKeyNum: 1, worstCase: 1 });
    // Mire's blue barriers: two keys from either state (:294-303)
    expect(
      ruleOf("inverted", "Misery Mire", "Mire Hub Top Blue Barrier")
        .crystalAlternative,
    ).toBe(2);
  });

  it("lets no key lock itself in when every location must be reached", () => {
    // check_for_self_lock_key only below accessibility locations (:867)
    const hera = (accessibility: KeyAnalysisSettings["accessibility"]) =>
      vanillaKeyLogic(settingsOf("open", { accessibility }))
        .get("Tower of Hera")
        ?.doorRules.get("Hera Lobby Key Stairs")?.allowSmall;
    expect([hera("items"), hera("locations")]).toEqual([true, false]);
  });

  it("leaves universal keys to the shops, but Standard's escape", () => {
    const universal = vanillaKeyLogic(
      settingsOf("open", { keyShuffle: "universal" }),
    );
    expect(
      [...universal.values()].reduce((n, l) => n + l.doorRules.size, 0),
    ).toBe(0);
    const standard = vanillaKeyLogic(
      settingsOf("standard", { keyShuffle: "universal" }),
    );
    expect(standard.get("Hyrule Castle")?.doorRules.size).toBeGreaterThan(0);
  });

  it("names a rule for each door of the proposal some counter waits at", () => {
    // Desert's far sides are reached only through their doors: no rule
    const desert = logicOf("open", "Desert Palace");
    expect([...desert.doorRules.keys()].sort()).toEqual([
      "Desert Beamos Hall NE",
      "Desert East Wing Key Door EN",
      "Desert Tiles 1 Up Stairs",
      "Desert Tiles 2 NE",
    ]);
  });
});
