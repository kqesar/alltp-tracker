// The Door Randomizer's own tests (test/dr-upstream/, imported by
// scripts/import-dr.mjs, stage C), held against the pack's port of its
// world (src/door-world/) as the pack holds vt's and the entrance
// randomizer's: upstream `true` must be our `yes`, upstream `false` must
// not be. A file is held once upstream.json lists it `ported`; a case it
// holds otherwise is listed below with why, never skipped silently.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type DrWorld, drWorld, probeId } from "../src/door-world/index";
import { solveFacts } from "../src/facts";
import { contractHolds } from "./contract";
import { collect, itemsOf, settingsOf } from "./dr-state";
import { loadManifest, PACK_DIR } from "./manifest";

type Case = readonly [
  name: string,
  access: boolean,
  items: readonly string[],
  allExcept?: readonly string[],
];
interface DrFixture {
  readonly file: string;
  readonly suite: string;
  readonly harness: {
    readonly mode: "open" | "inverted";
    readonly logic: string;
    readonly startingRegions?: Readonly<Record<string, readonly string[]>>;
  };
  readonly tests: readonly {
    readonly name: string;
    readonly line: number;
    readonly kind: "location" | "entrance";
    readonly disabled?: boolean;
    readonly startingRegions?: readonly string[];
    readonly cases: readonly Case[];
  }[];
}

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(join(PACK_DIR, path), "utf8")) as T;
const LISTED = loadManifest().doorRandomizer.tests;

/**
 * Cases a ported file holds otherwise, by `file:line#index name access`
 * (the test's line, the case's index in its list), each with why.
 */
const STALE: Readonly<Record<string, string>> = {};

/**
 * Cases that need the key analysis (study step 4.10-4.12): a small key
 * door is maybe until then, where DR's partial key logic opens it with
 * fewer keys than all of the dungeon's.
 */
const KEY_PENDING: ReadonlySet<string> = new Set([
  // Through Turtle Rock's front with 2 of its 4 chest keys (and its 2 drop
  // keys swept): DR's partial rule asks fewer than all
  "test/vanilla/TestDeathMountain.py:40#9 Mimic Cave true",
]);

const caseKey = (
  file: string,
  line: number,
  index: number,
  [name, access]: Case,
) => `${file}:${line}#${index} ${name} ${access}`;

describe("the Door Randomizer's own tests", () => {
  const ported = LISTED.filter((t) => t.status === "ported");

  it("list each held case once, and only cases of ported files", () => {
    const files = new Set(ported.map((t) => t.file));
    for (const key of [...Object.keys(STALE), ...KEY_PENDING])
      expect(files.has(key.split(":")[0] ?? ""), key).toBe(true);
  });

  for (const listed of ported) {
    const fixture = read<DrFixture>(listed.fixture ?? "");
    const worlds = new Map<string, DrWorld>();
    /** The world a test runs in: its suite's harness, its probes. */
    const worldOf = (test: DrFixture["tests"][number]): DrWorld => {
      const start = (test.startingRegions ?? []).flatMap(
        (name) => fixture.harness.startingRegions?.[name] ?? [name],
      );
      const key = start.join("|");
      const known = worlds.get(key);
      if (known !== undefined) return known;
      const world = drWorld(settingsOf(fixture.harness.mode), {
        probes: [
          ...new Set(
            fixture.tests
              .filter((t) => t.kind === "entrance")
              .flatMap((t) => t.cases.map(([name]) => name)),
          ),
        ],
        start,
        // TestDungeon.py collects the items and never sweeps
        sweepEvents: fixture.suite !== "dungeons",
      });
      worlds.set(key, world);
      return world;
    };
    for (const test of fixture.tests) {
      if (test.disabled === true) continue;
      it(`hold for ${fixture.file} ${test.name}`, () => {
        const world = worldOf(test);
        const failures = test.cases.flatMap((c, index) => {
          const [name, access, items, allExcept] = c;
          const key = caseKey(fixture.file, test.line, index, c);
          if (STALE[key] !== undefined || KEY_PENDING.has(key)) return [];
          const id =
            test.kind === "entrance"
              ? probeId(name)
              : (world.locationIds.get(name) ?? name);
          const got = solveFacts(
            world,
            collect(itemsOf(items, allExcept)),
          ).location(id);
          return contractHolds(access, got)
            ? []
            : [
                `${key} with ${JSON.stringify(items)}${allExcept ? ` but ${JSON.stringify(allExcept)}` : ""}: ${got}`,
              ];
        });
        expect(failures).toEqual([]);
      });
    }
  }
});
