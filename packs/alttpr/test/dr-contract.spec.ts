// The Door Randomizer's own tests (test/dr-upstream/, imported by
// scripts/import-dr.mjs, stage C), held against the pack's port of its
// world (src/door-world/) as the pack holds vt's and the entrance
// randomizer's: upstream `true` must be our `yes`, upstream `false` must
// not be. A file is held once upstream.json lists it `ported`; a case it
// holds otherwise is listed in dr-stale.ts with why, never skipped
// silently, and a dungeon case is held to its reasons here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { DR_DATA } from "../src/door-world/dr-data";
import { type DrWorld, drWorld, probeId } from "../src/door-world/index";
import { keyDropsOf } from "../src/door-world/keys";
import { solveFacts } from "../src/facts";
import { contractHolds } from "./contract";
import { type Reason, STALE } from "./dr-stale";
import { collect, itemsOf, POOL, settingsOf } from "./dr-state";
import { loadManifest, PACK_DIR } from "./manifest";
import { witnessOf } from "./owr-proof";

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
 * What a true dungeon case wants for each reason it is listed for: items
 * to add, every key of its dungeon (the pool's and each drop's fact), or
 * the events swept (a world that sweeps, as TestDungeon never does).
 */
const FIXES: Partial<
  Record<
    Reason,
    { readonly add?: readonly string[]; keys?: true; sweep?: true }
  >
> = {
  beetles: { add: ["Progressive Sword"] },
  bunny: { add: ["Moon Pearl"] },
  events: { sweep: true },
  keys: { keys: true },
  mirror: { add: ["Magic Mirror"] },
  tileRoom: { add: ["Magic Powder"] },
  wizzrobes: { add: ["Fire Rod", "Magic Upgrade (1/2)"] },
};

/** The dungeon a dungeon test's file is about, as its keys name it. */
const DUNGEON_OF_FILE: Readonly<Record<string, string>> = {
  TestAgahnimsTower: "Agahnims Tower",
  TestDarkPalace: "Palace of Darkness",
  TestDesertPalace: "Desert Palace",
  TestEasternPalace: "Eastern Palace",
  TestGanonsTower: "Ganons Tower",
  TestIcePalace: "Ice Palace",
  TestMiseryMire: "Misery Mire",
  TestSkullWoods: "Skull Woods",
  TestSwampPalace: "Swamp Palace",
  TestThievesTown: "Thieves Town",
  TestTowerOfHera: "Tower of Hera",
};

const caseKey = (
  file: string,
  line: number,
  index: number,
  [name, access]: Case,
) => `${file}:${line}#${index} ${name} ${access}`;

describe("the Door Randomizer's own tests", () => {
  // The test files' cases of the suites: the suite seeds, KeyDoorShuffle.py's
  // validator and the static key logic's tests have specs of their own
  const ported = LISTED.filter(
    (t) => t.status === "ported" && /^test\/(?!suite\/)[^/]+\//.test(t.file),
  );

  it("list each held case once, and only cases of ported files", () => {
    const files = new Set(ported.map((t) => t.file));
    for (const key of Object.keys(STALE))
      expect(files.has(key.split(":")[0] ?? ""), key).toBe(true);
  });

  for (const listed of ported) {
    const fixture = read<DrFixture>(listed.fixture ?? "");
    const worlds = new Map<string, DrWorld>();
    /**
     * The world a test runs in: its suite's harness, its probes; a reason's
     * check may ask it sweeping events, or with the bomb bag.
     */
    const worldOf = (
      test: DrFixture["tests"][number],
      variant: { sweep?: boolean; bombBag?: boolean } = {},
    ): DrWorld => {
      const start = (test.startingRegions ?? []).flatMap(
        (name) => fixture.harness.startingRegions?.[name] ?? [name],
      );
      // TestDungeon.py collects the items and never sweeps
      const sweep = variant.sweep ?? fixture.suite !== "dungeons";
      const bombBag = variant.bombBag ?? false;
      const key = `${start.join("|")}#${sweep}#${bombBag}`;
      const known = worlds.get(key);
      if (known !== undefined) return known;
      const world = drWorld(
        { ...settingsOf(fixture.harness.mode), bombBag },
        {
          data: DR_DATA,
          probes: [
            ...new Set(
              fixture.tests
                .filter((t) => t.kind === "entrance")
                .flatMap((t) => t.cases.map(([name]) => name)),
            ),
          ],
          start,
          sweepEvents: sweep,
        },
      );
      worlds.set(key, world);
      return world;
    };
    const dungeon =
      DUNGEON_OF_FILE[/(\w+)\.py$/.exec(fixture.file)?.[1] ?? ""] ?? "";
    for (const test of fixture.tests) {
      if (test.disabled === true) continue;
      it(`hold for ${fixture.file} ${test.name}`, () => {
        const world = worldOf(test);
        const failures = test.cases.flatMap((c, index) => {
          const [name, access, items, allExcept] = c;
          const key = caseKey(fixture.file, test.line, index, c);
          const listedFor = STALE[key];
          const id =
            test.kind === "entrance"
              ? probeId(name)
              : (world.locationIds.get(name) ?? name);
          const state = collect(itemsOf(items, allExcept));
          const got = solveFacts(world, state).location(id);
          if (listedFor === undefined)
            return contractHolds(access, got)
              ? []
              : [
                  `${key} with ${JSON.stringify(items)}${allExcept ? ` but ${JSON.stringify(allExcept)}` : ""}: ${got}`,
                ];
          // A listed case must still fail: once it holds, drop it
          if (contractHolds(access, got)) return [`${key}: listed, but holds`];
          if (fixture.suite !== "dungeons") return [];
          return reasonFails([listedFor].flat(), {
            access,
            allExcept,
            id,
            items,
            state,
          }).map((why) => `${key}: ${why}`);
        });
        expect(failures).toEqual([]);
      });

      /** Why a listed dungeon case's reasons do not hold, if they do not. */
      function reasonFails(
        reasons: readonly Reason[],
        c: {
          readonly access: boolean;
          readonly items: readonly string[];
          readonly allExcept?: readonly string[];
          readonly id: string;
          readonly state: State;
        },
      ): string[] {
        const solve = (w: DrWorld, s: State) => solveFacts(w, s).location(c.id);
        if (c.access) {
          // Each reason's want given, the case holds
          const fixes = reasons.map((r) => FIXES[r]);
          if (fixes.some((f) => f === undefined))
            return [`no fix for ${reasons.join(", ")}`];
          const w = worldOf(test, {
            sweep: fixes.some((f) => f?.sweep) ? true : undefined,
          });
          const fixed: Record<string, number | boolean | undefined> = {
            ...collect([
              ...itemsOf(c.items, c.allExcept),
              ...fixes.flatMap((f) => f?.add ?? []),
              ...(fixes.some((f) => f?.keys)
                ? POOL.filter((i) => i.endsWith(` Key (${dungeon})`))
                : []),
            ]),
          };
          if (fixes.some((f) => f?.keys))
            for (const drop of keyDropsOf(DR_DATA))
              if (drop.dungeon === dungeon) fixed[drop.fact] = 1;
          const got = solve(w, fixed);
          return got === "yes"
            ? []
            : [`fails (${got}) with ${reasons.join(", ")} given`];
        }
        // A false case: its one reason's check
        const [reason] = reasons;
        const without = (item: string) =>
          collect(itemsOf(c.items, [...(c.allExcept ?? []), item]));
        if (reason === "bombs")
          // With the bomb bag, bombs ask the +10 upgrade: not yes
          return solve(worldOf(test, { bombBag: true }), c.state) === "yes"
            ? ["yes with the bomb bag"]
            : [];
        if (reason === "byrna")
          return solve(worldOf(test), without("Cane of Byrna")) === "yes"
            ? ["yes without the Cane of Byrna"]
            : [];
        if (reason === "pinball")
          return solve(worldOf(test), without("Moon Pearl")) === "yes"
            ? ["yes without the Moon Pearl"]
            : [];
        if (reason === "overworld") {
          // Its route leaves the dungeon for the overworld
          const route = witnessOf(
            worldOf(test),
            DR_DATA,
            "open",
            c.state,
            c.id,
          );
          const outside = route?.some((step) =>
            ["lw", "dw"].includes(
              DR_DATA.regionByName.get(step.to)?.type ?? "",
            ),
          );
          return outside === true ? [] : ["its route stays inside"];
        }
        return [`no check for ${reason}`];
      }
    }
  }
});
