// The Overworld Randomizer's own tests, imported as fixtures (import-dr
// --owr, stage C): what they hold. They run in the fork's own harness
// (its test/TestBase.py at the release: make_logic_test_world, the bomb
// check overridden), so no harness commit apart. Each stays `pending` in
// upstream.json until the fork's world holds it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadManifest, PACK_DIR } from "./manifest";

type Case = [string, boolean, string[], string[]?];
interface Fixture {
  readonly file: string;
  readonly suite: string;
  readonly code?: readonly { name: string; line: number }[];
  readonly harness: {
    readonly mode: string;
    readonly logic: string;
    readonly overrideBombCheck?: boolean;
    readonly source: string;
  };
  readonly upstream: { readonly commit: string; readonly version: string };
  readonly tests: readonly {
    kind: "location" | "entrance";
    disabled?: boolean;
    startingRegions?: string[];
    cases: Case[];
  }[];
}

const DIR = join(PACK_DIR, "test/owr-upstream");
const manifest = loadManifest();

/** Every JSON under a directory, by its path. */
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

const fixtures = jsonFiles(DIR)
  .filter((path) => !path.endsWith("pool.json"))
  .map((path) => JSON.parse(readFileSync(path, "utf8")) as Fixture);

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

describe("the Overworld Randomizer's tests (test/owr-upstream)", () => {
  it("hold every case of each suite", () => {
    // As many as DR's suites: the fork re-aimed the same cases
    expect(countOf("vanilla")).toEqual({
      all: 573,
      disabled: 0,
      entrance: 112,
    });
    expect(countOf("inverted")).toEqual({
      all: 852,
      // owr:test/inverted/TestInvertedTurtleRock.py:7, a `return` first
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
    expect(
      fixtures.flatMap((f) => (f.code ?? []).map((c) => `${f.file}:${c.line}`)),
    ).toEqual([
      "test/inverted/TestInvertedBombRules.py:17",
      "test/inverted/TestInvertedBombRules.py:30",
      "test/inverted/TestInvertedBombRules.py:36",
    ]);
  });

  it("run in the fork's own harness, its bomb check overridden", () => {
    for (const f of fixtures) {
      expect(f.upstream).toMatchObject({
        commit: manifest.doorRandomizer.overworld.commit,
        version: manifest.doorRandomizer.overworld.version,
      });
      expect(f.harness.overrideBombCheck, f.file).toBe(true);
      expect(f.harness.source).toMatch(/^test\/\w+\/Test\w+\.py:\d+@1ada5b5$/);
    }
    const modes = new Map(fixtures.map((f) => [f.suite, f.harness.mode]));
    expect(Object.fromEntries(modes)).toEqual({
      dungeons: "open",
      inverted: "inverted",
      inverted_owg: "inverted",
      owg: "open",
      vanilla: "open",
    });
    // The dungeons start in today's regions, no map of old names
    const starts = fixtures
      .filter((f) => f.suite === "dungeons")
      .flatMap((f) => f.tests.flatMap((t) => t.startingRegions ?? []));
    expect(starts).toContain("Eastern Lobby");
  });

  it("draw an 'everything but' case from the harness's pool", () => {
    const pool = JSON.parse(readFileSync(join(DIR, "pool.json"), "utf8")) as {
      prizes: { items: string[]; source: string };
    };
    expect(pool.prizes.items).toHaveLength(12);
    expect(pool.prizes.source).toMatch(/^test\/TestBase\.py:\d+$/);
  });

  it("are listed in upstream.json, pending until the world holds them", () => {
    const listed = manifest.doorRandomizer.overworld.tests;
    for (const t of listed) expect(["pending", "ported"]).toContain(t.status);
    expect(listed.map((t) => t.fixture).sort()).toEqual(
      jsonFiles(DIR)
        .filter((path) => !path.endsWith("pool.json"))
        .map((path) => path.slice(PACK_DIR.length).replace(/^\//, ""))
        .sort(),
    );
  });
});
