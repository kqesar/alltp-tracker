import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadFixtures, loadItemTable, loadLocationIndex } from "./fixtures";
import {
  loadManifest,
  type Manifest,
  PACK_DIR,
  portedTooEarly,
  regionModule,
  rulesOfTest,
} from "./manifest";

const manifest = loadManifest();
const fixtures = loadFixtures();
const index = loadLocationIndex();
const entries = [...manifest.rules, ...manifest.tests];
const exists = (path: string) => existsSync(join(PACK_DIR, path));

describe("upstream.json", () => {
  it("pins one upstream commit, which every fixture was imported from", () => {
    expect(manifest.repo).toBe("sporchia/alttp_vt_randomizer");
    expect(manifest.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(Number.isInteger(manifest.logic)).toBe(true);
    const headers = [
      ...fixtures.map((f) => [f.path, f.upstream] as const),
      ["items.json", loadItemTable().upstream] as const,
      ["locations.json", index.upstream] as const,
    ];
    expect(headers).toHaveLength(138);
    for (const [path, upstream] of headers) {
      expect(
        [upstream.repo, upstream.commit, upstream.logic],
        `${path}: re-import it at the commit upstream.json pins`,
      ).toEqual([manifest.repo, manifest.commit, manifest.logic]);
    }
  });

  it("pins the entrance randomizer's commit, which its tables were imported from", () => {
    const er = JSON.parse(
      readFileSync(
        new URL("../src/entrances/er.json", import.meta.url),
        "utf8",
      ),
    ) as { upstream: { commit: string; repo: string } };
    expect(manifest.entranceRandomizer).toMatchObject({
      commit: er.upstream.commit,
      repo: er.upstream.repo,
    });
  });

  it("lists each file once, with a known status", () => {
    const files = entries.map((entry) => entry.file);
    expect(new Set(files).size).toBe(files.length);
    for (const entry of entries) {
      expect(["pending", "ported"], entry.file).toContain(entry.status);
    }
    for (const entry of manifest.rules) {
      expect(entry.module, entry.file).toMatch(/^src\/[a-z0-9/-]+\.ts$/);
    }
  });

  it("lists exactly the region files of the Standard, Open and Inverted worlds", () => {
    const worlds = new Set(
      index.regions.flatMap((r) =>
        r.extends ? [r.file, r.extends] : [r.file],
      ),
    );
    const listed = manifest.rules
      .map((entry) => entry.file)
      .filter((file) => file.startsWith("app/Region/"));
    // 26 Standard regions, Open's own escape and Inverted's 24 own
    expect(listed).toHaveLength(51);
    expect(new Set(listed)).toEqual(worlds);
  });

  it("maps each region file to its own module, mirroring its path", () => {
    const regions = manifest.rules.filter((e) =>
      e.file.startsWith("app/Region/"),
    );
    for (const entry of regions) {
      expect(entry.module, entry.file).toBe(regionModule(entry.file));
    }
    expect(regionModule("app/Region/Standard/LightWorld/NorthEast.php")).toBe(
      "src/regions/standard/light-world/north-east.ts",
    );
    expect(regionModule("app/Boss.php")).toBeUndefined();
    // A support file says which of its code the rules call
    for (const entry of manifest.rules) {
      if (!regions.includes(entry)) expect(entry.role, entry.file).toBeTruthy();
    }
  });

  it("has a module for each ported file, and none yet for a pending one but a region's", () => {
    const status = new Map<string, Set<string>>();
    for (const { module, status: s } of entries) {
      if (module === undefined) continue;
      status.set(module, (status.get(module) ?? new Set()).add(s));
    }
    for (const [module, statuses] of status) {
      // Files that share a module are ported together
      expect([...statuses], module).toHaveLength(1);
      // A region module exists from the start, as a stub while it is pending
      // (test/regions.spec.ts holds it to that), so the worlds can list it
      expect(exists(module), module).toBe(
        module.startsWith("src/regions/") || statuses.has("ported"),
      );
    }
  });

  it("lists the test file of every fixture, and a fixture for every test file", () => {
    const tests = new Map(manifest.tests.map((t) => [t.file, t]));
    expect(fixtures).toHaveLength(136);
    for (const fixture of fixtures) {
      expect(tests.get(fixture.file)?.fixture, fixture.file).toBe(
        `test/upstream/${fixture.path}`,
      );
    }
    const withFixture = manifest.tests.filter((t) => t.fixture !== undefined);
    expect(withFixture.map((t) => t.file).sort()).toEqual(
      fixtures.map((f) => f.file).sort(),
    );
    for (const test of withFixture) {
      expect(exists(test.fixture ?? ""), test.fixture).toBe(true);
    }
    expect(tests.get("tests/TestCase.php")?.module).toBe(
      "test/upstream-state.ts",
    );
  });
});

describe("porting a test file", () => {
  const hera = fixtures.find(
    (f) => f.file === "tests/NoGlitches/TowerOfHeraTest.php",
  );
  const open = fixtures.find((f) => f.file === "tests/NoGlitches/OpenTest.php");

  it("needs the regions its cases reach", () => {
    expect(hera && [...rulesOfTest(hera, index)].sort()).toEqual([
      // Only the regions its cases name: the way in (West Death Mountain)
      // and the support files are a lower bound this check cannot see
      "app/Region/Standard/TowerOfHera.php",
    ]);
    // Open's escape sets the rules of locations Standard's builds
    expect(open && [...rulesOfTest(open, index)].sort()).toEqual([
      "app/Region/Open/HyruleCastleEscape.php",
      "app/Region/Standard/HyruleCastleEscape.php",
    ]);
  });

  it("is refused while a region its cases reach is pending", () => {
    expect(portedTooEarly(manifest, fixtures, index)).toEqual([]);
    // Tower of Hera's test ported before its region, whatever upstream.json
    // says of either today. Inverted's tower extends Standard's, so its
    // tests (ported, Overworld Glitches' too) need Standard's too
    const early: Manifest = {
      ...manifest,
      rules: manifest.rules.map((r) =>
        r.file === "app/Region/Standard/TowerOfHera.php"
          ? { ...r, status: "pending" }
          : r,
      ),
      tests: manifest.tests.map((t) =>
        t.file === hera?.file ? { ...t, status: "ported" } : t,
      ),
    };
    expect(portedTooEarly(early, fixtures, index)).toEqual([
      "tests/NoGlitches/TowerOfHeraTest.php: app/Region/Standard/TowerOfHera.php is not ported",
      "tests/Inverted/TowerOfHeraTest.php: app/Region/Standard/TowerOfHera.php is not ported",
      "tests/InvertedOverworldGlitches/TowerOfHeraTest.php: app/Region/Standard/TowerOfHera.php is not ported",
      "tests/OverworldGlitches/TowerOfHeraTest.php: app/Region/Standard/TowerOfHera.php is not ported",
    ]);
  });

  it("finds every location and region the fixtures name", () => {
    for (const fixture of fixtures) {
      expect(() => rulesOfTest(fixture, index), fixture.file).not.toThrow();
    }
    const broken = hera && {
      ...hera,
      cases: [{ ...hera.cases[0], location: "Nowhere" } as never],
    };
    expect(() => broken && rulesOfTest(broken, index)).toThrow(
      /no location "Nowhere"/,
    );
  });
});
