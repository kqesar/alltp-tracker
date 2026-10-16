// The map markers: every check on exactly one, in the right world's half,
// at the legacy map's positions where it had a marker.
import type { Tri } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { LEGACY_CHESTS, LEGACY_DUNGEONS } from "./legacy";
import {
  LEGACY_CHEST_POSITIONS,
  LEGACY_DUNGEON_POSITIONS,
  MARKED_DUNGEONS,
  MARKERS,
  markerStatus,
} from "./markers";
import { regionModules } from "./pack";
import { OPEN, STANDARD } from "./settings";

/** Not checks: upstream places no item there (World::getTotalItemCount). */
const NO_CHECK = new Set(["fountain", "medallion", "prize", "trade"]);

describe("the markers", () => {
  it("have unique kebab-case ids and sit on the map", () => {
    const ids = MARKERS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MARKERS) {
      expect(m.id, m.name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(m.x, m.id).toBeGreaterThanOrEqual(0);
      expect(m.x, m.id).toBeLessThanOrEqual(100);
      expect(m.y, m.id).toBeGreaterThanOrEqual(0);
      expect(m.y, m.id).toBeLessThanOrEqual(100);
      expect(m.locations.length, m.id).toBeGreaterThan(0);
    }
  });

  it("put every check of either world on exactly one marker", () => {
    for (const settings of [OPEN, STANDARD]) {
      const checks = regionModules(settings).flatMap((mod) =>
        mod.regions.flatMap((r) =>
          r.locations.filter((l) => !NO_CHECK.has(l.kind)).map((l) => l.id),
        ),
      );
      const placed = MARKERS.flatMap((m) => m.locations);
      expect([...placed].sort()).toEqual([...checks].sort());
    }
  });

  it("sit in the half of the map of their world", () => {
    const regionOf = new Map(
      regionModules(STANDARD).flatMap((mod) =>
        mod.regions.flatMap((r) => r.locations.map((l) => [l.id, r.id])),
      ),
    );
    const DARK =
      /DarkWorld|^mire$|^(palaceOfDarkness|swampPalace|skullWoods|thievesTown|icePalace|miseryMire|turtleRock|ganonsTower)/;
    const across: string[] = [];
    for (const m of MARKERS) {
      for (const id of m.locations) {
        const dark = DARK.test(regionOf.get(id) ?? "");
        if (m.x >= 50 !== dark) across.push(`${m.id}: ${id}`);
      }
    }
    // The frog waits in the Dark World, the smiths reward in the Light
    expect(across).toEqual(["blacksmith: blacksmith"]);
  });

  it("keep the legacy map's positions and groups", () => {
    const chests = MARKERS.filter(
      (m) => "legacy" in m.position && m.position.legacy === "chest",
    );
    // Every legacy marker but "Bridge", which stands for nothing
    expect(chests).toHaveLength(63);
    for (const m of chests) {
      const { index } = m.position as { index: number };
      expect([m.x, m.y], m.id).toEqual(LEGACY_CHEST_POSITIONS[index]);
      expect(m.locations, m.id).toEqual(LEGACY_CHESTS[index]?.locations);
    }
    const dungeons = MARKERS.filter(
      (m) => "legacy" in m.position && m.position.legacy === "dungeon",
    );
    expect(dungeons.map((m) => m.dungeon)).toEqual([...LEGACY_DUNGEONS]);
    for (const [i, m] of dungeons.entries()) {
      expect([m.x, m.y]).toEqual(LEGACY_DUNGEON_POSITIONS[i]);
    }
    expect(LEGACY_CHEST_POSITIONS).toHaveLength(64);
  });

  it("add the places the legacy map lacked, each with where it was read", () => {
    const added = MARKERS.filter((m) => "source" in m.position);
    expect(added.map((m) => m.id)).toEqual([
      "waterfall-fairy",
      "castle-tower",
      "ganons-tower",
    ]);
    for (const m of added) {
      expect(m.position, m.id).toMatchObject({ why: expect.any(String) });
    }
    expect(MARKED_DUNGEONS).not.toContain("hyrule-castle");
    expect(MARKED_DUNGEONS).toHaveLength(12);
  });
});

describe("markerStatus", () => {
  it.each([
    [["yes"], "available"],
    [["yes", "yes"], "available"],
    [["yes", "maybe"], "possible"],
    [["yes", "no"], "possible"],
    [["maybe", "no"], "possible"],
    [["no", "no"], "unavailable"],
    [[], "unavailable"],
  ] as [Tri[], string][])("%j shows %s", (tris, status) => {
    expect(markerStatus(tris)).toBe(status);
  });
});
