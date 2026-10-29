import type { State, Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import {
  type CaseWorld,
  type ContractSubject,
  contractHolds,
  runUpstreamCases,
} from "./contract";
import { type CaseKind, type Fixture, loadFixtures } from "./fixtures";
import { loadManifest, type Manifest } from "./manifest";
import { PACK } from "./pack-subject";

const manifest = loadManifest();
const fixtures = loadFixtures();

const ported = new Set(
  manifest.tests
    .filter((test) => test.status === "ported")
    .map((test) => test.file),
);
const portedCases = fixtures
  .filter((fixture) => ported.has(fixture.file))
  .flatMap((fixture) => fixture.cases);
const count = (kind: CaseKind) =>
  portedCases.filter((c) => c.kind === kind).length;

describe("the upstream contract", () => {
  const report = runUpstreamCases(fixtures, manifest, PACK);

  it("holds the pack to every case of the ported test files", () => {
    expect(report.failures).toEqual([]);
  });

  it("runs those files, and every case of theirs", () => {
    expect(report.files).toEqual(
      fixtures.filter((f) => ported.has(f.file)).map((f) => f.file),
    );
    expect(report.files).toContain("tests/NoGlitches/EasternPalaceTest.php");
    expect(report.skipped).toEqual({
      fill: 0,
      location: 0,
      regionComplete: 0,
      regionEnter: 0,
      regionFill: 0,
    });
    expect(report.ran).toEqual({
      fill: count("fill"),
      location: count("location"),
      regionComplete: count("regionComplete"),
      regionEnter: count("regionEnter"),
      regionFill: count("regionFill"),
    });
    // Location::canFill's cases: one per placement the tests try
    expect(report.ran.fill).toBe(804);
  });

  it("would catch a pack that answers maybe, or yes, to everything", () => {
    const always = (answer: Tri): ContractSubject => ({
      fill: () => answer,
      location: () => answer,
      regionComplete: () => answer,
      regionEnter: () => answer,
      regionFill: () => answer,
    });
    const answered = portedCases;
    expect(
      runUpstreamCases(fixtures, manifest, always("maybe")).failures,
    ).toHaveLength(answered.filter((c) => c.expected).length);
    expect(
      runUpstreamCases(fixtures, manifest, always("yes")).failures,
    ).toHaveLength(answered.filter((c) => !c.expected).length);
  });
});

describe("Hybrid Major Glitches, which upstream does not test", () => {
  // It turns on Overworld Glitches' flags and one more (config/logic.php:
  // 14-23), so whatever Overworld Glitches' cases find true, it does too
  const owg = fixtures.filter((f) => f.path.includes("OverworldGlitches/"));
  const hybrid: Fixture[] = owg.map((f) => ({
    ...f,
    cases: f.cases.filter((c) => c.expected),
    worlds: Object.fromEntries(
      Object.entries(f.worlds).map(([name, w]) => [
        name,
        { ...w, config: { ...w.config, logic: "HybridMajorGlitches" } },
      ]),
    ),
  }));

  it("holds every case Overworld Glitches' suites find true", () => {
    const report = runUpstreamCases(hybrid, manifest, PACK);
    expect(report.failures).toEqual([]);
    expect(report.files).toHaveLength(45);
    const ran = Object.values(report.ran).reduce((sum, n) => sum + n, 0);
    expect(ran).toBe(
      hybrid.reduce((sum, fixture) => sum + fixture.cases.length, 0),
    );
    expect(ran).toBeGreaterThan(1000);
  });
});

describe("contractHolds", () => {
  it.each([
    [true, "yes", true],
    [true, "maybe", false],
    [true, "no", false],
    [false, "yes", false],
    [false, "maybe", true],
    [false, "no", true],
  ] as [boolean, Tri, boolean][])(
    "upstream %s, ours %s: %s",
    (expected, got, holds) => {
      expect(contractHolds(expected, got)).toBe(holds);
    },
  );
});

describe("runUpstreamCases", () => {
  const FILE = "tests/NoGlitches/SampleTest.php";
  const header = fixtures[0]?.upstream;
  const fixture: Fixture = {
    cases: [
      {
        dataSet: 0,
        expected: true,
        file: FILE,
        items: { add: ["Lamp"], base: "setUp" },
        kind: "location",
        line: 10,
        location: "Lit Room",
        method: "testLocation",
      },
      {
        dataSet: 1,
        expected: false,
        file: FILE,
        items: { add: [], base: "allItems", except: ["Lamp"] },
        kind: "location",
        line: 11,
        location: "Lit Room",
        locationItems: { "Turtle Rock Medallion": "Quake" },
        method: "testLocation",
      },
      {
        dataSet: 0,
        expected: true,
        file: FILE,
        item: "BigKeyP3",
        items: { add: [], base: "allItems", except: ["BigKeyP3"] },
        kind: "fill",
        line: 20,
        location: "Lit Room",
        method: "testFillLocation",
      },
      {
        expected: true,
        file: FILE,
        items: { add: [], base: "setUp" },
        kind: "regionEnter",
        line: 30,
        method: "testEnter",
        region: "Tower of Hera",
      },
      {
        config: { "region.wildMaps": true },
        dataSet: 0,
        expected: false,
        file: FILE,
        item: "MapH2",
        kind: "regionFill",
        line: 40,
        method: "testRegionLockedItems",
        region: "Tower of Hera",
      },
    ],
    class: "NoGlitches\\SampleTest",
    file: FILE,
    generated: "by hand, for this spec",
    path: "NoGlitches/Sample.json",
    setUp: {
      bosses: { "Thieves Town": "Dummy Boss" },
      collected: ["RescueZelda"],
      line: 5,
      locationItems: { "Misery Mire Medallion": "Ether" },
    },
    unsupported: [],
    upstream: header ?? {
      commit: "",
      copyright: "",
      license: "",
      logic: 0,
      repo: "",
    },
    worlds: {
      world: { config: { logic: "NoGlitches" }, line: 6, mode: "open" },
    },
  };
  const ported = (status: "pending" | "ported"): Manifest => ({
    ...manifest,
    tests: [
      { file: FILE, fixture: "test/upstream/NoGlitches/Sample.json", status },
    ],
  });

  // Answers yes exactly when the lamp is held: right for the location cases
  const calls: { kind: string; state?: State; world: CaseWorld }[] = [];
  const lampSubject: ContractSubject = {
    fill: (_, __, state, world) => {
      calls.push({ kind: "fill", state, world });
      return "maybe";
    },
    location: (_, state, world) => {
      calls.push({ kind: "location", state, world });
      return state.lamp ? "yes" : "no";
    },
    regionFill: (_, __, world) => {
      calls.push({ kind: "regionFill", world });
      return "yes";
    },
  };

  it("checks each case of a ported file and reports the ones that break the contract", () => {
    calls.length = 0;
    const report = runUpstreamCases([fixture], ported("ported"), lampSubject);
    expect(report.files).toEqual([FILE]);
    expect(report.ran).toEqual({
      fill: 1,
      location: 2,
      regionComplete: 0,
      regionEnter: 0,
      regionFill: 1,
    });
    // The subject answers no region entry
    expect(report.skipped.regionEnter).toBe(1);
    // The fill wanted yes and got maybe; the region fill wanted no, got yes
    expect(report.failures).toEqual([
      {
        expected: true,
        file: FILE,
        got: "maybe",
        kind: "fill",
        line: 20,
        subject: "Lit Room <- BigKeyP3",
      },
      {
        expected: false,
        file: FILE,
        got: "yes",
        kind: "regionFill",
        line: 40,
        subject: "Tower of Hera <- MapH2",
      },
    ]);
  });

  it("builds each case's items and world as its test class does", () => {
    calls.length = 0;
    runUpstreamCases([fixture], ported("ported"), lampSubject);
    const [setUp, except, fill, regionFill] = calls;
    // setUp's RescueZelda, then the case's Lamp
    expect(setUp?.state).toEqual({ lamp: 1, rescueZelda: 1 });
    expect(setUp?.world).toEqual({
      bosses: { "Thieves Town": "Dummy Boss" },
      config: { logic: "NoGlitches" },
      locationItems: { "Misery Mire Medallion": "Ether" },
      mode: "open",
    });
    // Everything but the lamp, with the case's medallion on top of setUp's
    expect(except?.state).not.toHaveProperty("lamp");
    expect(except?.state).toMatchObject({ hammer: 1, sword: 4 });
    expect(except?.world.locationItems).toEqual({
      "Misery Mire Medallion": "Ether",
      "Turtle Rock Medallion": "Quake",
    });
    expect(fill?.state).not.toHaveProperty("bigKeyP3");
    expect(regionFill?.world.config).toEqual({
      logic: "NoGlitches",
      "region.wildMaps": true,
    });
  });

  it("leaves the cases of a pending file alone", () => {
    calls.length = 0;
    const report = runUpstreamCases([fixture], ported("pending"), lampSubject);
    expect(report.files).toEqual([]);
    expect(calls).toEqual([]);
    expect(report.failures).toEqual([]);
  });

  it("needs the world the cases run in", () => {
    const noWorld = { ...fixture, worlds: {} };
    expect(() =>
      runUpstreamCases([noWorld], ported("ported"), lampSubject),
    ).toThrow(/no \$this->world/);
  });
});
