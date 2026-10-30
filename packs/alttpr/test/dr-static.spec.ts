// DR's static key logic (src/door-world/static.ts) held to DR's own tests
// of it: test/TestStaticKeyLogic.py's cases (test/dr-upstream/
// static-key-logic.json, written by scripts/import-dr.mjs). A case is
// `min_keys`, the fewest of a dungeon's keys, 0 to 6, with which a
// location is reached: with that many the world must say yes (upstream
// true), with one fewer not yes (upstream false). A case the test made with
// an item placed rests on that placement, which a tracker does not know:
// with one fewer key it is still not yes, and with that many not no (DR
// reaches it, so maybe at least). The tests' world keeps its keys in their
// dungeons, where the world reads a door short of its keys `maybe`; the
// static numbers do not depend on where keys lie (has_sm_key_strict counts
// those held), so the cases are asked again with the keys wild, where one
// key short is `no` but for an alternative that rests on a placement.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { drWorld } from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import { contractHolds } from "./contract";
import { collect, settingsOf } from "./dr-state";

interface Case {
  readonly location: string;
  readonly dungeon: string;
  readonly keys: number;
  readonly line: number;
  readonly without?: readonly string[];
  readonly placed?: Readonly<Record<string, string>>;
}

const FIXTURE = JSON.parse(
  readFileSync(
    new URL("dr-upstream/static-key-logic.json", import.meta.url),
    "utf8",
  ),
) as {
  readonly harness: {
    readonly items: readonly string[];
    readonly keys: Readonly<Record<string, string>>;
    readonly mode: "open";
    readonly starts: readonly string[];
  };
  readonly tests: readonly {
    readonly name: string;
    readonly line: number;
    readonly cases: readonly Case[];
  }[];
  readonly code: readonly { readonly name: string; readonly line: number }[];
};

describe("DR's static key logic against TestStaticKeyLogic.py", () => {
  const { harness } = FIXTURE;
  // build_vanilla_world(key_logic='static') at the release, the Menu
  // straight into six portals; its state collects each item, which sweeps
  // the events (CollectionState.collect, BaseClasses.py:1411-1413)
  const worlds = [false, true].map((wildKeys) =>
    drWorld(
      { ...settingsOf(harness.mode), staticKeyLogic: true, wildKeys },
      { start: harness.starts },
    ),
  );
  const answer = (world: (typeof worlds)[number], c: Case, keys: number) => {
    const key = harness.keys[c.dungeon];
    if (key === undefined) throw new RangeError(`No key of ${c.dungeon}`);
    const id = world.locationIds.get(c.location);
    if (id === undefined) throw new RangeError(`No location ${c.location}`);
    const items = [
      ...harness.items.filter((name) => !(c.without ?? []).includes(name)),
      ...Array.from({ length: keys }, () => key),
    ];
    return solveFacts(world, collect(items)).location(id);
  };

  it("reads its cases and keeps its fill's assertions as code", () => {
    expect(FIXTURE.tests.flatMap((t) => t.cases)).toHaveLength(65);
    expect(FIXTURE.code.map((c) => c.name)).toEqual([
      "test_hyrule_castle_open_mode",
      "test_turtle_rock_front_access",
      "test_requires_vanilla_doors",
      "test_requires_forbidden_special_enemies",
    ]);
  });

  for (const test of FIXTURE.tests)
    it(`holds ${test.name} (line ${test.line})`, () => {
      const failures = worlds.flatMap((world, wild) =>
        test.cases.flatMap((c) => {
          const at = `${wild ? "wild " : ""}${c.line} ${c.location}${c.placed ? ` with ${JSON.stringify(c.placed)}` : ""}`;
          const out: string[] = [];
          const enough = answer(world, c, c.keys);
          if (
            c.placed === undefined
              ? !contractHolds(true, enough)
              : enough === "no"
          )
            out.push(`${at}: ${c.keys} keys ${enough}`);
          if (c.keys > 0) {
            const fewer = answer(world, c, c.keys - 1);
            if (!contractHolds(false, fewer))
              out.push(`${at}: ${c.keys - 1} keys ${fewer}`);
          }
          return out;
        }),
      );
      expect(failures).toEqual([]);
    });
});
