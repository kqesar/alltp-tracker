import { MARKERS } from "@alltp/pack-alttpr";
import { describe, expect, it } from "vitest";
import { getPreset } from "@/data/presets";
import {
  entranceById,
  entranceText,
  notesFor,
  placeMarkers,
  poolOf,
  targetById,
  targetsFor,
  targetText,
} from "@/logic/entrances";

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
    const shop = entranceById("big-bomb-shop");
    expect(placed).toHaveLength(2);
    expect(placed[0]).toMatchObject({
      id: "blinds-hideout",
      x: shop?.x,
      y: (shop?.y ?? 0) - 2.6,
    });
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
