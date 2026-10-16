// Structural checks on the imported upstream tests. The fixtures are
// generated: when one of these fails after a re-import, read the upstream
// change it points at, never edit a fixture to make it pass.
import { describe, expect, it } from "vitest";
import { type CaseKind, loadFixtures } from "./fixtures";
import {
  allItemsExcept,
  collectionState,
  EXCEPT_GROUPS,
} from "./upstream-state";

const fixtures = loadFixtures();
const cases = fixtures.flatMap((fixture) => fixture.cases);

describe("the upstream fixtures", () => {
  it("hold the cases of every NoGlitches test class, file by file", () => {
    const counts = Object.fromEntries(
      fixtures.map((f) => [f.path, f.cases.length]),
    );
    expect(counts).toEqual({
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
    });
  });

  it("are of five kinds", () => {
    const kinds: Partial<Record<CaseKind, number>> = {};
    for (const c of cases) kinds[c.kind] = (kinds[c.kind] ?? 0) + 1;
    expect(kinds).toEqual({
      fill: 135,
      location: 2464,
      regionComplete: 1,
      regionEnter: 9,
      regionFill: 360,
    });
  });

  it("record what they could not import, and nothing else", () => {
    const unsupported = fixtures.flatMap((f) =>
      f.unsupported.map((u) => [f.file, u.method, u.rows?.length ?? 0]),
    );
    expect(unsupported).toEqual([
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

  it("run in a Standard or Open world with the test rules", () => {
    for (const fixture of fixtures) {
      const world = fixture.worlds.world;
      expect(["open", "standard"], fixture.path).toContain(world?.mode);
      expect(world?.config, fixture.path).toEqual({
        difficulty: "test_rules",
        logic: "NoGlitches",
      });
    }
    expect(
      fixtures
        .filter((f) => f.worlds.world?.mode === "open")
        .map((f) => f.file),
    ).toEqual(["tests/NoGlitches/OpenTest.php"]);
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

  // allItemsExcept leaves removed bottles and hearts where bottleCount() and
  // hasHealth() still count them (see test/upstream-state.ts); the port does
  // not. Only a case that removes some can tell, and there is one: Sick Kid
  // with no bottle, which reads hasABottle
  // (app/Region/Standard/LightWorld/NorthWest.php:124), where the port and
  // upstream agree.
  it("do not depend on the bottles and hearts allItemsExcept still counts", () => {
    const counted = new Set([
      ...(EXCEPT_GROUPS.get("AnyBottle") ?? []),
      "PieceOfHeart",
      "HeartContainer",
      "HeartContainerNoAnimation",
      "BossHeartContainer",
    ]);
    const removing = cases.flatMap((c) => {
      if (!("items" in c) || c.items.base !== "allItems") return [];
      const held = new Set(allItemsExcept(c.items.except ?? []));
      return [...counted].some((name) => !held.has(name))
        ? [["location" in c ? c.location : c.region, c.expected, c.items]]
        : [];
    });
    expect(removing).toEqual([
      ["Sick Kid", false, { add: [], base: "allItems", except: ["AnyBottle"] }],
    ]);
  });
});
