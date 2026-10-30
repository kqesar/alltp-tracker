// The Overworld Randomizer's own tests (test/owr-upstream/, imported by
// scripts/import-dr.mjs --owr), held against DR's world built on OWR's
// data (src/door-world/, OWR_DATA): upstream `true` must be our `yes`,
// upstream `false` must not be. A file is held once upstream.json lists it
// `ported`; a case it holds otherwise is listed in owr-stale.ts with why,
// never skipped silently. OWR's harness overrides the bomb check
// (TestBase.py:102, `overrideBombCheck`): a real run never does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import rules from "../src/door-rando/owr/rules.json" with { type: "json" };
import { type DrWorld, drWorld, probeId } from "../src/door-world/index";
import { OWR_DATA } from "../src/door-world/owr-data";
import { solveFacts } from "../src/facts";
import { contractHolds } from "./contract";
import { collect, eventsOf, itemsOf, poolOf, settingsOf } from "./dr-state";
import { loadManifest, PACK_DIR } from "./manifest";
import { OWR_STALE, WHY } from "./owr-stale";

type Case = readonly [
  name: string,
  access: boolean,
  items: readonly string[],
  allExcept?: readonly string[],
];
interface OwrFixture {
  readonly file: string;
  readonly suite: string;
  readonly harness: {
    readonly mode: "open" | "inverted";
    readonly logic: string;
    readonly overrideBombCheck: boolean;
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
const LISTED = loadManifest().doorRandomizer.overworld.tests;
const EVENTS = eventsOf(rules.events);
const POOLS = {
  inverted: poolOf("test/owr-upstream/pool.json", "inverted"),
  open: poolOf("test/owr-upstream/pool.json", "open"),
};

const caseKey = (
  file: string,
  line: number,
  index: number,
  [name, access]: Case,
) => `${file}:${line}#${index} ${name} ${access}`;

describe("the Overworld Randomizer's own tests", () => {
  const ported = LISTED.filter((t) => t.status === "ported");

  it("list each held case once, and only cases of ported files", () => {
    const files = new Set(ported.map((t) => t.file));
    for (const key of Object.keys(OWR_STALE))
      expect(files.has(key.split(":")[0] ?? ""), key).toBe(true);
  });

  for (const listed of ported) {
    const fixture = read<OwrFixture>(listed.fixture ?? "");
    const pool = POOLS[fixture.harness.mode];
    const worlds = new Map<string, DrWorld>();
    /** The world a test runs in: its suite's harness, its probes. */
    const worldOf = (test: OwrFixture["tests"][number]): DrWorld => {
      const start = test.startingRegions ?? [];
      const key = start.join("|");
      const known = worlds.get(key);
      if (known !== undefined) return known;
      const world = drWorld(
        {
          ...settingsOf(fixture.harness.mode),
          // OWR 0.8.0.2 builds on DR 1.5.7
          drVersion: 157,
          overrideBombCheck: fixture.harness.overrideBombCheck,
        },
        {
          data: OWR_DATA,
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
        },
      );
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
          const listedStale = OWR_STALE[key] !== undefined;
          const id =
            test.kind === "entrance"
              ? probeId(name)
              : (world.locationIds.get(name) ?? name);
          const got = solveFacts(
            world,
            collect(itemsOf(items, allExcept, pool), EVENTS),
          ).location(id);
          if (listedStale) {
            if (contractHolds(access, got))
              return [`${key}: listed, but holds`];
            // A case listed for its plain Ocarina holds with the flute
            // activated in its place
            const activated = items.map((item) =>
              item === "Ocarina" ? "Ocarina (Activated)" : item,
            );
            const flute = solveFacts(
              world,
              collect(itemsOf(activated, allExcept, pool), EVENTS),
            ).location(id);
            return OWR_STALE[key] === WHY.flute && !contractHolds(access, flute)
              ? [`${key}: listed for the flute, but fails activated`]
              : [];
          }
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
