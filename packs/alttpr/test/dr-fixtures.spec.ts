// The Door Randomizer's own tests, imported as fixtures (import-dr, stage
// C): what they hold. The contract (upstream true is our yes, upstream
// false is not our yes) runs in dr-contract.spec.ts over each file
// upstream.json lists `ported`; the others stay `pending`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import drLocations from "../src/door-rando/locations.json" with {
  type: "json",
};
import regionData from "../src/door-rando/world/regions.json" with {
  type: "json",
};
import { loadManifest, PACK_DIR } from "./manifest";

type Case = [string, boolean, string[], string[]?];
interface Fixture {
  readonly file: string;
  readonly suite: string;
  readonly code?: readonly { name: string; line: number }[];
  readonly harness: {
    readonly mode: string;
    readonly logic: string;
    readonly keyLogic: string;
    readonly source: string;
    readonly extra: readonly string[];
    readonly startingRegions?: Record<string, string[]>;
  };
  readonly upstream: {
    readonly commit: string;
    readonly harness: { commit: string };
  };
  readonly tests: readonly {
    name: string;
    line: number;
    kind: "location" | "entrance";
    disabled?: boolean;
    startingRegions?: string[];
    cases: Case[];
  }[];
}

const DIR = join(PACK_DIR, "test/dr-upstream");
const manifest = loadManifest();

/** Every JSON under a directory, by its path from the pack. */
function jsonFiles(dir: string): string[] {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory()
        ? jsonFiles(path)
        : name.endsWith(".json")
          ? [path]
          : [];
    });
}

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8")) as T;
const fixtures = jsonFiles(DIR)
  .filter(
    (path) =>
      !path.includes("/suite/") &&
      !path.endsWith("pool.json") &&
      // KeyDoorShuffle.py's validator, held by key-analysis/analysis.spec.ts
      !path.endsWith("vanilla-key-logic.json"),
  )
  .map((path) => read<Fixture>(path));

/** A suite's cases, all, of entrances, of disabled tests. */
function countOf(suite: string) {
  const tests = fixtures
    .filter((f) => f.suite === suite)
    .flatMap((f) => f.tests);
  const sum = (list: typeof tests) =>
    list.reduce((n, t) => n + t.cases.length, 0);
  return {
    all: sum(tests),
    disabled: sum(tests.filter((t) => t.disabled)),
    entrance: sum(tests.filter((t) => t.kind === "entrance")),
  };
}

describe("the Door Randomizer's tests (test/dr-upstream)", () => {
  it("hold every case of each suite", () => {
    // Recounted by the importer: test/dungeons has 483, one more than a
    // grep of one-line cases finds (a case over two lines in TestSkullWoods)
    expect(countOf("vanilla")).toEqual({
      all: 573,
      disabled: 0,
      entrance: 112,
    });
    expect(countOf("inverted")).toEqual({
      all: 852,
      // TestInvertedTurtleRock.py:7, `return  # Door rando makes this harder`
      disabled: 186,
      entrance: 97,
    });
    expect(countOf("dungeons")).toEqual({ all: 483, disabled: 0, entrance: 0 });
    expect(countOf("owg")).toEqual({ all: 558, disabled: 0, entrance: 0 });
    expect(countOf("inverted_owg")).toEqual({
      all: 432,
      disabled: 0,
      entrance: 0,
    });
  });

  it("keep a test of no cases as code, with its line", () => {
    // TestInvertedBombRules: the bomb shop's rule at each door, code over
    // tables the entrance rewrite deleted (626691a rewrote it)
    expect(
      fixtures.flatMap((f) => (f.code ?? []).map((c) => `${f.file}:${c.line}`)),
    ).toEqual([
      "test/inverted/TestInvertedBombRules.py:17",
      "test/inverted/TestInvertedBombRules.py:30",
      "test/inverted/TestInvertedBombRules.py:36",
    ]);
  });

  it("run in the harness upstream restored them with, pinned", () => {
    const { commit } = manifest.doorRandomizer.testHarness;
    expect(commit).toMatch(/^626691a/);
    for (const f of fixtures) {
      expect(f.upstream.commit).toBe(manifest.doorRandomizer.commit);
      expect(f.upstream.harness.commit).toBe(commit);
      expect(f.harness.source).toMatch(/@626691a$/);
      expect(f.harness.keyLogic).toBe("partial");
    }
    const worlds = new Set(
      fixtures.map((f) => `${f.suite}: ${f.harness.mode} ${f.harness.logic}`),
    );
    expect([...worlds].sort()).toEqual([
      "dungeons: open noglitches",
      "inverted: inverted noglitches",
      "inverted_owg: inverted owglitches",
      "owg: open owglitches",
      "vanilla: open noglitches",
    ]);
  });

  it("name only locations, entrances and regions of DR's world", () => {
    const locations = new Set([
      ...regionData.regions.flatMap((r) => r.locations),
      ...drLocations.locations.map((l) => l.name),
    ]);
    const exits = new Set(regionData.regions.flatMap((r) => r.exits));
    const regions = new Set(regionData.regions.map((r) => r.name));
    const unknown: string[] = [];
    for (const f of fixtures)
      for (const t of f.tests) {
        for (const [name] of t.cases)
          if (!(t.kind === "entrance" ? exits : locations).has(name))
            unknown.push(`${f.file}: ${name}`);
        for (const start of t.startingRegions ?? [])
          for (const region of f.harness.startingRegions?.[start] ?? [start])
            if (!regions.has(region)) unknown.push(`${f.file}: ${region}`);
      }
    expect(unknown).toEqual([]);
  });

  it("draw everything-but cases from the tests' pool, cited", () => {
    const pool = read<{
      progression: { items: string[]; source: string }[];
      dungeonItems: { items: string[]; source: string };
      prizes: { items: string[]; source: string };
    }>(join(DIR, "pool.json"));
    const items = [
      ...pool.progression.flatMap((p) => p.items),
      ...pool.dungeonItems.items,
      ...pool.prizes.items,
    ];
    const count = (name: string) => items.filter((i) => i === name).length;
    expect(count("Progressive Sword")).toBe(4);
    expect(count("Progressive Glove")).toBe(2);
    expect(count("Bottle")).toBe(4);
    expect(count("Small Key (Palace of Darkness)")).toBe(6);
    expect(count("Crystal 7")).toBe(1);
    expect(count("Rupees (300)")).toBe(0);
    for (const p of [...pool.progression, pool.dungeonItems, pool.prizes])
      expect(p.source).toMatch(
        /^(ItemList|Dungeons)\.py:|^test\/TestBase\.py:/,
      );
  });

  it("hold the customizer seeds' verifications", () => {
    const seeds = jsonFiles(join(DIR, "suite")).map((path) =>
      read<{
        file: string;
        verifications: { locations: Record<string, boolean> }[];
      }>(path),
    );
    const checks = (file: RegExp) =>
      seeds
        .filter((s) => file.test(s.file))
        .reduce(
          (n, s) =>
            n +
            s.verifications.reduce(
              (m, v) => m + Object.keys(v.locations).length,
              0,
            ),
          0,
        );
    expect(checks(/partial_key_logic\.yaml$/)).toBe(7);
    expect(checks(/partial_key_logic_2\.yaml$/)).toBe(7);
    expect(checks(/partial_key_logic_3\.yaml$/)).toBe(113);
    expect(checks(/strict_key_logic\.yaml$/)).toBe(7);
    expect(checks(/default_key_logic\.yaml$/)).toBe(12);
    expect(checks(/lynel_test\.yaml$/)).toBe(2);
    expect(checks(/\/hmg\//)).toBe(80);
  });

  it("are listed in upstream.json, pending or held (dr-contract.spec.ts)", () => {
    const listed = manifest.doorRandomizer.tests;
    for (const t of listed) expect(["pending", "ported"]).toContain(t.status);
    expect(listed.map((t) => t.fixture).sort()).toEqual(
      jsonFiles(DIR)
        .filter((path) => !path.endsWith("pool.json"))
        .map((path) => path.slice(PACK_DIR.length).replace(/^\//, ""))
        .sort(),
    );
  });
});
