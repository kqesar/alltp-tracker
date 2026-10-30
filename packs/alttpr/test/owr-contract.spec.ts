// The Overworld Randomizer's own tests (test/owr-upstream/, imported by
// scripts/import-dr.mjs --owr), held against DR's world built on OWR's
// data (src/door-world/, OWR_DATA): upstream `true` must be our `yes`,
// upstream `false` must not be. A file is held once upstream.json lists it
// `ported`; a case it holds otherwise is listed in owr-stale.ts with why,
// never skipped silently, and held to its reasons here. OWR's harness
// overrides the bomb check (TestBase.py:102, `overrideBombCheck`): a real
// run never does.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate, parse, type State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import rules from "../src/door-rando/owr/rules.json" with { type: "json" };
import { type DrWorld, drWorld, probeId } from "../src/door-world/index";
import { keyDropsOf } from "../src/door-world/keys";
import { OWR_DATA } from "../src/door-world/owr-data";
import { solveFacts } from "../src/facts";
import { contractHolds } from "./contract";
import { collect, eventsOf, itemsOf, poolOf, settingsOf } from "./dr-state";
import { loadManifest, PACK_DIR } from "./manifest";
import { OWR_EDGES } from "./owr-edges";
import { cutOf, type ProofStep, witnessOf } from "./owr-proof";
import { OWR_STALE, type Reason } from "./owr-stale";

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

/**
 * Why a proof's steps fail review: each must be in owr-edges.ts with the
 * rule the world gives it now, and worth `want` for the state.
 */
function unreviewed(
  steps: readonly ProofStep[],
  world: DrWorld,
  state: State,
  want: "yes" | "no",
): string[] {
  return steps.flatMap((step) => {
    const reviewed = OWR_EDGES[step.exit];
    if (reviewed === undefined)
      return [`${step.exit} [${step.rule}] is not reviewed`];
    if (reviewed[0] !== step.rule)
      return [`${step.exit} now reads ${step.rule}, reviewed ${reviewed[0]}`];
    const value = evaluate(parse(step.rule), state, world.compiled.rules);
    return want === "no" && value !== "no"
      ? [`${step.exit} is ${value} for the case`]
      : [];
  });
}

describe("the Overworld Randomizer's own tests", () => {
  const ported = LISTED.filter((t) => t.status === "ported");

  it("list each held case once, and only cases of ported files", () => {
    const files = new Set(ported.map((t) => t.file));
    for (const key of Object.keys(OWR_STALE))
      expect(files.has(key.split(":")[0] ?? ""), key).toBe(true);
  });

  it("review each exit a proof reads once", () => {
    for (const [exit, [rule, source]] of Object.entries(OWR_EDGES)) {
      expect(() => parse(rule), exit).not.toThrow();
      expect(source, exit).toMatch(/\.py:\d+/);
    }
  });

  for (const listed of ported) {
    const fixture = read<OwrFixture>(listed.fixture ?? "");
    const pool = POOLS[fixture.harness.mode];
    const worlds = new Map<string, DrWorld>();
    /**
     * The world a test runs in: its suite's harness, its probes; a reason's
     * check may ask it sweeping events, or without the harness's bomb
     * override.
     */
    const worldOf = (
      test: OwrFixture["tests"][number],
      variant: { sweep?: boolean; override?: boolean } = {},
    ): DrWorld => {
      const start = test.startingRegions ?? [];
      // TestDungeon.py collects the items and never sweeps
      const sweep = variant.sweep ?? fixture.suite !== "dungeons";
      const override = variant.override ?? fixture.harness.overrideBombCheck;
      const key = `${start.join("|")}#${sweep}#${override}`;
      const known = worlds.get(key);
      if (known !== undefined) return known;
      const world = drWorld(
        {
          ...settingsOf(fixture.harness.mode),
          // OWR 0.8.0.2 builds on DR 1.5.7
          drVersion: 157,
          overrideBombCheck: override,
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
        const idIn = (w: DrWorld, name: string) =>
          test.kind === "entrance"
            ? probeId(name)
            : (w.locationIds.get(name) ?? name);
        const failures = test.cases.flatMap((c, index) => {
          const [name, access, items, allExcept] = c;
          const key = caseKey(fixture.file, test.line, index, c);
          const listedFor = OWR_STALE[key];
          const id = idIn(world, name);
          const state = collect(itemsOf(items, allExcept, pool), EVENTS);
          const got = solveFacts(world, state).location(id);
          if (listedFor === undefined)
            return contractHolds(access, got)
              ? []
              : [
                  `${key} with ${JSON.stringify(items)}${allExcept ? ` but ${JSON.stringify(allExcept)}` : ""}: ${got}`,
                ];
          if (contractHolds(access, got)) return [`${key}: listed, but holds`];
          const reasons: readonly Reason[] = [listedFor].flat();
          const why = reasonFails(reasons, {
            access,
            allExcept,
            id,
            items,
            key,
            state,
          });
          return why.map((w) => `${key}: ${w}`);
        });
        expect(failures).toEqual([]);
      });

      /** Why a listed case's reasons do not hold, if they do not. */
      function reasonFails(
        reasons: readonly Reason[],
        c: {
          readonly key: string;
          readonly access: boolean;
          readonly items: readonly string[];
          readonly allExcept?: readonly string[];
          readonly id: string;
          readonly state: State;
        },
      ): string[] {
        const failures: string[] = [];
        const solve = (w: DrWorld, s: State) => solveFacts(w, s).location(c.id);
        // A plain Ocarina in its place activated, the case holds
        if (reasons.includes("flute")) {
          const activated = c.items.map((item) =>
            item === "Ocarina" ? "Ocarina (Activated)" : item,
          );
          const s = collect(itemsOf(activated, c.allExcept, pool), EVENTS);
          if (!contractHolds(c.access, solve(worldOf(test), s)))
            failures.push("listed for the flute, but fails activated");
        }
        if (fixture.suite === "inverted") {
          // OWR's own answer, from its rules: a route, or a cut
          const world = worldOf(test);
          const proof = c.access
            ? cutOf(
                world,
                OWR_DATA,
                "inverted",
                solveFacts(world, c.state).regions(),
                c.id,
              )
            : witnessOf(world, OWR_DATA, "inverted", c.state, c.id);
          if (proof === undefined) return [...failures, "no route worth yes"];
          return [
            ...failures,
            ...unreviewed(proof, world, c.state, c.access ? "no" : "yes"),
          ];
        }
        if (c.access) {
          // Each reason's want given, the case holds
          const fixes = reasons.map((r) => FIXES[r]);
          if (fixes.some((f) => f === undefined))
            return [`no fix for ${reasons.join(", ")}`];
          const w = worldOf(test, {
            sweep: fixes.some((f) => f?.sweep) ? true : undefined,
          });
          const fixed: Record<string, number | boolean | undefined> = {
            ...collect(
              [
                ...itemsOf(c.items, c.allExcept, pool),
                ...fixes.flatMap((f) => f?.add ?? []),
                ...(fixes.some((f) => f?.keys)
                  ? pool.filter((i) => i.endsWith(` Key (${dungeon})`))
                  : []),
              ],
              EVENTS,
            ),
          };
          if (fixes.some((f) => f?.keys))
            for (const drop of keyDropsOf(OWR_DATA))
              if (drop.dungeon === dungeon) fixed[drop.fact] = 1;
          const got = solve(w, fixed);
          return got === "yes"
            ? failures
            : [...failures, `fails (${got}) with ${reasons.join(", ")} given`];
        }
        // A false case: its one reason's check
        const [reason] = reasons;
        if (reason === "bombs") {
          // Without the harness's bomb override, not yes
          const got = solve(worldOf(test, { override: false }), c.state);
          return got === "yes" ? [`yes without the bomb override`] : failures;
        }
        if (reason === "byrna") {
          // The Cane of Byrna taken out too, not yes
          const s = collect(
            itemsOf(c.items, [...(c.allExcept ?? []), "Cane of Byrna"], pool),
            EVENTS,
          );
          return solve(worldOf(test), s) === "yes"
            ? ["yes without the Cane of Byrna"]
            : failures;
        }
        if (reason === "pinball") {
          // The Moon Pearl taken out too, not yes
          const s = collect(
            itemsOf(c.items, [...(c.allExcept ?? []), "Moon Pearl"], pool),
            EVENTS,
          );
          return solve(worldOf(test), s) === "yes"
            ? ["yes without the Moon Pearl"]
            : failures;
        }
        if (reason === "overworld") {
          // Its route leaves the dungeon for the overworld
          const route = witnessOf(
            worldOf(test),
            OWR_DATA,
            "open",
            c.state,
            c.id,
          );
          const outside = route?.some((step) =>
            ["lw", "dw"].includes(
              OWR_DATA.regionByName.get(step.to)?.type ?? "",
            ),
          );
          return outside === true ? failures : ["its route stays inside"];
        }
        return [`no check for ${reason}`];
      }
    }
  }
});
