import { MARKERS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { getPreset } from "@/games/alttpr/data/presets";
import {
  entranceById,
  entranceText,
  layoutOf,
  notesFor,
  placeMarkers,
  poolOf,
  targetById,
  targetsFor,
  targetText,
} from "@/games/alttpr/logic/entrances";

const crosskeys = getPreset("crosskeys").settings;

describe("the entrance assistant's model", () => {
  it("has a pool for runs with shuffled entrances in Open and Standard", () => {
    expect(poolOf(getPreset("open").settings)).toBeNull();
    expect(poolOf(crosskeys)?.entrances).toHaveLength(138);
    expect(
      poolOf({ ...crosskeys, mode: "standard" })?.entrances.length,
    ).toBeLessThan(138);
    // Inverted shuffles with tables of its own, not ported yet
    expect(poolOf({ ...crosskeys, mode: "inverted" })).toBeNull();
  });

  it("has a pool of its own for the full shuffle, and none for the shuffles it does not port", () => {
    const full = { ...crosskeys, entranceShuffle: "full" as const };
    expect(poolOf(full)).not.toBe(poolOf(crosskeys));
    expect(poolOf(full)?.entrances).toHaveLength(138);
    expect(poolOf({ ...full, mode: "inverted" })).toBeNull();
    // Simple, Restricted and Insanity mix other doors with other targets
    for (const entranceShuffle of ["simple", "restricted", "insanity"] as const)
      expect(poolOf({ ...crosskeys, entranceShuffle })).toBeNull();
  });

  const pool = poolOf(crosskeys);
  if (pool === null) throw new Error("no pool");

  it("offers each entrance what the shuffle may give it", () => {
    const hole = entranceById("kakariko-well-drop");
    const door = entranceById("kakariko-shop");
    if (hole === undefined || door === undefined) throw new Error("missing");
    expect(new Set(targetsFor(pool, hole).map((t) => t.kind))).toEqual(
      new Set(["drop"]),
    );
    expect(targetsFor(pool, door).map((t) => t.kind)).not.toContain("drop");
  });

  it("notes a hole with its cave's door", () => {
    expect(notesFor(pool, "kakariko-well-drop", "bat-cave-right")).toEqual({
      "kakariko-well-cave": "bat-cave-exit",
      "kakariko-well-drop": "bat-cave-right",
    });
    expect(notesFor(pool, "kakariko-shop", "blinds-hideout")).toEqual({
      "kakariko-shop": "blinds-hideout",
    });
  });

  it("moves the checks inside a place above the door noted to lead there", () => {
    const blinds = MARKERS.find((m) => m.id === "blinds-hideout");
    const tomb = MARKERS.find((m) => m.id === "kings-tomb");
    const island = MARKERS.find((m) => m.id === "lake-hylia-island");
    if (!blinds || !tomb || !island) throw new Error("missing");
    const markers = [blinds, tomb, island];
    // Nothing noted: the places' markers wait, an outdoor one stays
    expect(placeMarkers(pool, {}, markers)).toEqual([island]);
    // Blind's Hideout behind the Big Bomb Shop's door, in the Dark World
    const placed = placeMarkers(
      pool,
      { "big-bomb-shop": "blinds-hideout" },
      markers,
    );
    const shop = layoutOf(pool).get("big-bomb-shop");
    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({
      id: "blinds-hideout",
      x: shop?.x,
      y: (shop?.y ?? 0) - 2.6,
    });
  });

  it("draws doors side by side clear of one another, near their spot", () => {
    const layout = layoutOf(pool);
    const at = (id: string) => {
      const found = layout.get(id);
      if (found === undefined) throw new RangeError(id);
      return found;
    };
    // In world percents: a step across as long as one down
    const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot((a.x - b.x) * 2, a.y - b.y);
    // Good Bee Cave hid behind Ice Rod Cave, its neighbour in one cliff
    const bee = entranceById("good-bee-cave");
    const ice = entranceById("ice-rod-cave");
    if (bee === undefined || ice === undefined) throw new Error("missing");
    expect(apart(bee, ice)).toBeLessThan(3.5);
    expect(apart(at("good-bee-cave"), at("ice-rod-cave"))).toBeGreaterThan(3.5);
    for (const entrance of pool.entrances) {
      expect(apart(at(entrance.id), entrance)).toBeLessThanOrEqual(3.5001);
    }
  });

  it("says an entrance and where it leads", () => {
    const door = entranceById("blinds-hideout");
    const target = targetById("elder-house-exit-east");
    if (door === undefined || target === undefined) throw new Error("missing");
    expect(targetText(target)).toBe("Elder House (East)");
    expect(entranceText(door, target)).toBe(
      "Blind's Hideout: leads to Elder House (East)",
    );
    expect(entranceText(door, undefined)).toBe(
      "Blind's Hideout: not known yet",
    );
  });
});
