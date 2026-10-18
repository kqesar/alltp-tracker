import { describe, expect, it } from "vitest";
import { getPreset } from "@/data/presets";
import {
  entranceById,
  entranceText,
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

  it("offers a hole the drops, a door everything else", () => {
    const hole = entranceById("kakariko-well-drop");
    const door = entranceById("kakariko-shop");
    if (hole === undefined || door === undefined) throw new Error("missing");
    expect(new Set(targetsFor(hole).map((t) => t.kind))).toEqual(
      new Set(["drop"]),
    );
    expect(targetsFor(door).map((t) => t.kind)).not.toContain("drop");
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
