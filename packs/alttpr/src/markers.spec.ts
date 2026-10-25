// The map markers: every check on exactly one, in the right world's half,
// at the legacy map's positions where it had a marker.
import { solve } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import { LEGACY_CHESTS, LEGACY_DUNGEONS } from "./legacy";
import { markerStatus } from "./marker-status";
import {
  INVERTED_MARKERS,
  LEGACY_CHEST_POSITIONS,
  LEGACY_DUNGEON_POSITIONS,
  MAP_LOCATIONS,
  MARKED_DUNGEONS,
  MARKERS,
  markersOf,
} from "./markers";
import { compile, regionModules } from "./pack";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";

const INVERTED = settingsFromUpstream("inverted", {});

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
    // Every legacy marker but "Bridge", which stands for nothing, and the
    // four the map merged into two (below)
    expect(chests).toHaveLength(59);
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
      "sahasrahlas-hut",
      "hookshot-cave",
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

describe("the places the legacy map split in two", () => {
  const byId = (id: string) => {
    const marker = MARKERS.find((m) => m.id === id);
    if (marker === undefined) throw new RangeError(id);
    return marker;
  };
  const status = (id: string, items: Record<string, number>) => {
    const solution = solve(compile(OPEN), items);
    return markerStatus(byId(id).locations.map((l) => solution.location(l)));
  };

  it("stand as one marker each for all of the place's locations", () => {
    expect([...byId("hookshot-cave").locations].sort()).toEqual([
      "hookshot-cave/bottom-left",
      "hookshot-cave/bottom-right",
      "hookshot-cave/top-left",
      "hookshot-cave/top-right",
    ]);
    expect([...byId("sahasrahlas-hut").locations].sort()).toEqual([
      "sahasrahla",
      "sahasrahlas-hut/left",
      "sahasrahlas-hut/middle",
      "sahasrahlas-hut/right",
    ]);
    for (const gone of ["hookshot-cave-bottom-right", "sahasrahla"]) {
      expect(MARKERS.map((m) => m.id)).not.toContain(gone);
      expect(INVERTED_MARKERS.map((m) => m.id)).not.toContain(gone);
    }
  });

  it("leave the order of the locations shared links index by as it was", () => {
    const all = [...MAP_LOCATIONS];
    const legacy = LEGACY_CHESTS.flatMap((c) => c.locations);
    expect(all.slice(0, legacy.length)).toEqual(legacy);
    expect(all.indexOf("hookshot-cave/bottom-right")).toBeLessThan(
      all.indexOf("hookshot-cave/top-right"),
    );
  });

  it("show Hookshot Cave as only some when the boots cross without the hookshot", () => {
    const dark = {
      flute: 1,
      glove: 2,
      hammer: 1,
      magicMirror: 1,
      moonPearl: 1,
      rescueZelda: 1,
    };
    expect(status("hookshot-cave", dark)).toBe("unavailable");
    expect(status("hookshot-cave", { ...dark, pegasusBoots: 1 })).toBe(
      "possible",
    );
    expect(status("hookshot-cave", { ...dark, hookshot: 1 })).toBe("available");
  });

  it("show Sahasrahla's Hut as only some until the Pendant of Courage is held", () => {
    expect(status("sahasrahlas-hut", { rescueZelda: 1 })).toBe("possible");
    expect(
      status("sahasrahlas-hut", { pendantOfCourage: 1, rescueZelda: 1 }),
    ).toBe("available");
  });
});

describe("the Inverted markers", () => {
  const byId = (markers: typeof MARKERS) =>
    new Map(markers.map((m) => [m.id, m]));
  const inverted = byId(INVERTED_MARKERS);
  const open = byId(MARKERS);

  it("are a run's markers in an Inverted world only", () => {
    expect(markersOf(INVERTED)).toBe(INVERTED_MARKERS);
    expect(markersOf(OPEN)).toBe(MARKERS);
    expect(markersOf(STANDARD)).toBe(MARKERS);
  });

  it("put every check on exactly one marker, and the Bomb Merchant on its own", () => {
    const checks = regionModules(INVERTED).flatMap((mod) =>
      mod.regions.flatMap((r) =>
        r.locations.filter((l) => !NO_CHECK.has(l.kind)).map((l) => l.id),
      ),
    );
    const placed = INVERTED_MARKERS.flatMap((m) => m.locations);
    expect([...placed].sort()).toEqual([...checks, "bomb-merchant"].sort());
    expect(new Set(INVERTED_MARKERS.map((m) => m.id)).size).toBe(
      INVERTED_MARKERS.length,
    );
  });

  it("move only the doors Inverted moves, each with where it was read", () => {
    const moved = INVERTED_MARKERS.filter((m) => {
      const was = open.get(m.id);
      return was === undefined || was.x !== m.x || was.y !== m.y;
    });
    expect(moved.map((m) => m.id)).toEqual([
      "links-house",
      "bomb-merchant",
      "castle-tower",
      "ganons-tower",
    ]);
    const at = (map: typeof inverted, id: string) => {
      const m = map.get(id);
      return [m?.x, m?.y];
    };
    const [x, y] = at(open, "links-house");
    expect(at(inverted, "links-house")).toEqual([(x ?? 0) + 50, y]);
    expect(at(inverted, "bomb-merchant")).toEqual([x, y]);
    expect(at(inverted, "castle-tower")).toEqual(at(open, "ganons-tower"));
    expect(at(inverted, "ganons-tower")).toEqual(at(open, "castle-tower"));
    for (const m of moved) {
      expect(m.position, m.id).toMatchObject({
        source: expect.stringMatching(/^app\/Region\/Inverted\//),
        why: expect.any(String),
      });
    }
  });

  it("let a save of any run keep what it checked", () => {
    expect([...MAP_LOCATIONS].sort()).toEqual(
      [...new Set(INVERTED_MARKERS.flatMap((m) => m.locations))].sort(),
    );
    expect(MAP_LOCATIONS.has("bomb-merchant")).toBe(true);
  });
});
