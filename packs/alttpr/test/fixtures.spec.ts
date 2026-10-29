// Structural checks on the imported upstream tests. The fixtures are
// generated: when one of these fails after a re-import, read the upstream
// change it points at, never edit a fixture to make it pass.
import { describe, expect, it } from "vitest";
import { type CaseKind, loadFixtures } from "./fixtures";
import { collectionState } from "./upstream-state";

const fixtures = loadFixtures();

/** The logic each glitched directory's test classes build their world in. */
const LOGIC_OF_DIRECTORY = new Map([
  ["InvertedMajorGlitches", "MajorGlitches"],
  ["InvertedOverworldGlitches", "OverworldGlitches"],
  ["MajorGlitches", "MajorGlitches"],
  ["OverworldGlitches", "OverworldGlitches"],
]);
const cases = fixtures.flatMap((fixture) => fixture.cases);

describe("the upstream fixtures", () => {
  it("hold the cases of every NoGlitches, Inverted and glitched test class and the retro bow's, file by file", () => {
    const counts = Object.fromEntries(
      fixtures.map((f) => [f.path, f.cases.length]),
    );
    expect(counts).toEqual({
      "Inverted/DarkWorld/DeathMountain/East.json": 37,
      "Inverted/DarkWorld/DeathMountain/West.json": 40,
      "Inverted/DarkWorld/Mire.json": 12,
      "Inverted/DarkWorld/NorthEast.json": 50,
      "Inverted/DarkWorld/NorthWest.json": 33,
      "Inverted/DarkWorld/South.json": 8,
      "Inverted/DeathMountain/East.json": 182,
      "Inverted/DeathMountain/West.json": 21,
      "Inverted/DesertPalace.json": 167,
      "Inverted/EasternPalace.json": 143,
      "Inverted/GanonsTower.json": 489,
      "Inverted/HyruleCastleEscape.json": 73,
      "Inverted/HyruleCastleTower.json": 28,
      "Inverted/IcePalace.json": 234,
      "Inverted/LightWorld.json": 469,
      "Inverted/MiseryMire.json": 830,
      "Inverted/PalaceOfDarkness.json": 168,
      "Inverted/SkullWoods.json": 117,
      "Inverted/SwampPalace.json": 197,
      "Inverted/ThievesTown.json": 30,
      "Inverted/TowerOfHera.json": 78,
      "Inverted/TurtleRock.json": 165,
      "InvertedMajorGlitches/DarkWorld/DeathMountain/East.json": 15,
      "InvertedMajorGlitches/DarkWorld/DeathMountain/West.json": 22,
      "InvertedMajorGlitches/DarkWorld/Mire.json": 2,
      "InvertedMajorGlitches/DarkWorld/NorthEast.json": 20,
      "InvertedMajorGlitches/DarkWorld/NorthWest.json": 15,
      "InvertedMajorGlitches/DarkWorld/South.json": 7,
      "InvertedMajorGlitches/DeathMountain/East.json": 87,
      "InvertedMajorGlitches/DeathMountain/West.json": 4,
      "InvertedMajorGlitches/DesertPalace.json": 24,
      "InvertedMajorGlitches/EasternPalace.json": 20,
      "InvertedMajorGlitches/GanonsTower.json": 319,
      "InvertedMajorGlitches/HyruleCastleEscape.json": 109,
      "InvertedMajorGlitches/HyruleCastleTower.json": 11,
      "InvertedMajorGlitches/IcePalace.json": 89,
      "InvertedMajorGlitches/LightWorld.json": 438,
      "InvertedMajorGlitches/MiseryMire.json": 122,
      "InvertedMajorGlitches/PalaceOfDarkness.json": 54,
      "InvertedMajorGlitches/SkullWoods.json": 27,
      "InvertedMajorGlitches/SwampPalace.json": 435,
      "InvertedMajorGlitches/ThievesTown.json": 30,
      "InvertedMajorGlitches/TowerOfHera.json": 341,
      "InvertedMajorGlitches/TurtleRock.json": 56,
      "InvertedOverworldGlitches/DarkWorld/DeathMountain/East.json": 20,
      "InvertedOverworldGlitches/DarkWorld/DeathMountain/West.json": 22,
      "InvertedOverworldGlitches/DarkWorld/Mire.json": 4,
      "InvertedOverworldGlitches/DarkWorld/NorthEast.json": 21,
      "InvertedOverworldGlitches/DarkWorld/NorthWest.json": 14,
      "InvertedOverworldGlitches/DarkWorld/South.json": 7,
      "InvertedOverworldGlitches/DeathMountain/East.json": 35,
      "InvertedOverworldGlitches/DeathMountain/West.json": 5,
      "InvertedOverworldGlitches/DesertPalace.json": 32,
      "InvertedOverworldGlitches/EasternPalace.json": 35,
      "InvertedOverworldGlitches/GanonsTower.json": 390,
      "InvertedOverworldGlitches/HyruleCastleEscape.json": 47,
      "InvertedOverworldGlitches/HyruleCastleTower.json": 11,
      "InvertedOverworldGlitches/IcePalace.json": 218,
      "InvertedOverworldGlitches/LightWorld.json": 231,
      "InvertedOverworldGlitches/MiseryMire.json": 72,
      "InvertedOverworldGlitches/PalaceOfDarkness.json": 54,
      "InvertedOverworldGlitches/SkullWoods.json": 27,
      "InvertedOverworldGlitches/SwampPalace.json": 75,
      "InvertedOverworldGlitches/ThievesTown.json": 30,
      "InvertedOverworldGlitches/TowerOfHera.json": 40,
      "InvertedOverworldGlitches/TurtleRock.json": 56,
      "MajorGlitches/DarkWorld/DeathMountain/East.json": 54,
      "MajorGlitches/DarkWorld/DeathMountain/West.json": 42,
      "MajorGlitches/DarkWorld/Mire.json": 22,
      "MajorGlitches/DarkWorld/NorthEast.json": 73,
      "MajorGlitches/DarkWorld/NorthWest.json": 48,
      "MajorGlitches/DarkWorld/South.json": 71,
      "MajorGlitches/DeathMountain/East.json": 8,
      "MajorGlitches/DeathMountain/West.json": 12,
      "MajorGlitches/DesertPalace.json": 23,
      "MajorGlitches/EasternPalace.json": 21,
      "MajorGlitches/GanonsTower.json": 132,
      "MajorGlitches/HyruleCastleEscape.json": 16,
      "MajorGlitches/HyruleCastleTower.json": 1,
      "MajorGlitches/IcePalace.json": 208,
      "MajorGlitches/LightWorld.json": 102,
      "MajorGlitches/MiseryMire.json": 226,
      "MajorGlitches/Open.json": 33,
      "MajorGlitches/PalaceOfDarkness.json": 53,
      "MajorGlitches/SkullWoods.json": 41,
      "MajorGlitches/SwampPalace.json": 481,
      "MajorGlitches/ThievesTown.json": 144,
      "MajorGlitches/TowerOfHera.json": 28,
      "MajorGlitches/TurtleRock.json": 84,
      "NoGlitches/DarkWorld/DeathMountain/East.json": 54,
      "NoGlitches/DarkWorld/DeathMountain/West.json": 41,
      "NoGlitches/DarkWorld/Mire.json": 12,
      "NoGlitches/DarkWorld/NorthEast.json": 82,
      "NoGlitches/DarkWorld/NorthWest.json": 53,
      "NoGlitches/DarkWorld/South.json": 70,
      "NoGlitches/DeathMountain/East.json": 157,
      "NoGlitches/DeathMountain/West.json": 59,
      "NoGlitches/DesertPalace.json": 137,
      "NoGlitches/EasternPalace.json": 111,
      "NoGlitches/GanonsTower.json": 533,
      "NoGlitches/HyruleCastleEscape.json": 16,
      "NoGlitches/HyruleCastleTower.json": 2,
      "NoGlitches/IcePalace.json": 317,
      "NoGlitches/LightWorld.json": 169,
      "NoGlitches/MiseryMire.json": 146,
      "NoGlitches/Open.json": 33,
      "NoGlitches/PalaceOfDarkness.json": 146,
      "NoGlitches/SkullWoods.json": 215,
      "NoGlitches/SwampPalace.json": 198,
      "NoGlitches/ThievesTown.json": 124,
      "NoGlitches/TowerOfHera.json": 81,
      "NoGlitches/TurtleRock.json": 213,
      "OverworldGlitches/DarkWorld/DeathMountain/East.json": 29,
      "OverworldGlitches/DarkWorld/DeathMountain/West.json": 23,
      "OverworldGlitches/DarkWorld/Mire.json": 8,
      "OverworldGlitches/DarkWorld/NorthEast.json": 24,
      "OverworldGlitches/DarkWorld/NorthWest.json": 23,
      "OverworldGlitches/DarkWorld/South.json": 21,
      "OverworldGlitches/DeathMountain/East.json": 24,
      "OverworldGlitches/DeathMountain/West.json": 14,
      "OverworldGlitches/DesertPalace.json": 25,
      "OverworldGlitches/EasternPalace.json": 21,
      "OverworldGlitches/GanonsTower.json": 130,
      "OverworldGlitches/HyruleCastleEscape.json": 16,
      "OverworldGlitches/HyruleCastleTower.json": 2,
      "OverworldGlitches/IcePalace.json": 212,
      "OverworldGlitches/LightWorld.json": 104,
      "OverworldGlitches/MiseryMire.json": 75,
      "OverworldGlitches/Open.json": 33,
      "OverworldGlitches/PalaceOfDarkness.json": 102,
      "OverworldGlitches/SkullWoods.json": 48,
      "OverworldGlitches/SwampPalace.json": 74,
      "OverworldGlitches/ThievesTown.json": 46,
      "OverworldGlitches/TowerOfHera.json": 27,
      "OverworldGlitches/TurtleRock.json": 123,
      "RetroBow.json": 32,
    });
  });

  it("are of five kinds", () => {
    const kinds: Partial<Record<CaseKind, number>> = {};
    for (const c of cases) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
    expect(kinds).toEqual({
      fill: 804,
      location: 11667,
      regionComplete: 37,
      regionEnter: 164,
      regionFill: 720,
    });
  });

  it("record what they could not import, and nothing else", () => {
    const unsupported = fixtures.flatMap((f) =>
      f.unsupported.map((u) => [f.file, u.method, u.rows?.length ?? 0]),
    );
    expect(unsupported).toEqual([
      ["tests/Inverted/DesertPalaceTest.php", "testDungeonItemWrite", 8],
      [
        "tests/InvertedMajorGlitches/DesertPalaceTest.php",
        "testDungeonItemWrite",
        8,
      ],
      ["tests/MajorGlitches/DesertPalaceTest.php", "testDungeonItemWrite", 8],
      ["tests/NoGlitches/DesertPalaceTest.php", "testDungeonItemWrite", 8],
    ]);
  });

  it("give every case its provenance: the test file, line and method", () => {
    for (const fixture of fixtures) {
      const lines = new Set<number>();
      for (const c of fixture.cases) {
        const where = `${fixture.path}:${c.line}`;
        expect(c.file, where).toBe(fixture.file);
        expect(Number.isInteger(c.line) && c.line > 0, where).toBe(true);
        expect(c.method, where).toMatch(/^test[A-Z]\w+$/);
        expect(typeof c.expected, where).toBe("boolean");
        // One data row per line: a line points at one case
        expect(lines.has(c.line), `${where} twice`).toBe(false);
        lines.add(c.line);
      }
      // Sorted by line, as the importer writes them
      const sorted = fixture.cases.map((c) => c.line);
      expect(sorted, fixture.path).toEqual([...sorted].sort((a, b) => a - b));
    }
  });

  it("run in a Standard, Open, Inverted or retro world with the test rules, in their directory's logic", () => {
    for (const fixture of fixtures) {
      const world = fixture.worlds.world;
      expect(["inverted", "open", "retro", "standard"], fixture.path).toContain(
        world?.mode,
      );
      expect(world?.config, fixture.path).toEqual({
        difficulty: "test_rules",
        logic:
          LOGIC_OF_DIRECTORY.get(fixture.path.split("/")[0] ?? "") ??
          "NoGlitches",
      });
    }
    expect(
      fixtures
        .filter((f) => f.worlds.world?.mode === "open")
        .map((f) => f.file),
    ).toEqual([
      "tests/MajorGlitches/OpenTest.php",
      "tests/NoGlitches/OpenTest.php",
      "tests/OverworldGlitches/OpenTest.php",
    ]);
    expect(
      fixtures
        .filter((f) => f.worlds.world?.mode === "retro")
        .map((f) => f.file),
    ).toEqual(["tests/RetroBowTest.php"]);
    // Every Inverted test class, and only they, build an Inverted world
    for (const fixture of fixtures) {
      expect(fixture.worlds.world?.mode === "inverted", fixture.path).toBe(
        /^Inverted\w*\//.test(fixture.path),
      );
    }
  });

  it("override only the dungeon item settings of the world", () => {
    const keys = new Set(
      cases.flatMap((c) =>
        c.kind === "regionFill" ? Object.keys(c.config) : [],
      ),
    );
    expect([...keys].sort()).toEqual([
      "region.wildCompasses",
      "region.wildMaps",
    ]);
  });

  it("build a state from every case's items", () => {
    for (const fixture of fixtures) {
      for (const c of fixture.cases) {
        if (!("items" in c)) continue;
        expect(
          () => collectionState(c.items, fixture.setUp.collected),
          `${fixture.path}:${c.line}`,
        ).not.toThrow();
      }
    }
  });
});
