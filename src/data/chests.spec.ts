import { describe, expect, it } from "vitest";
import { chests } from "@/data/chests";
import { items as baseItems } from "@/data/items";
import type { ItemState } from "@/data/logic";

const makeItems = (overrides: Partial<ItemState> = {}): ItemState =>
  ({ ...baseItems, ...overrides }) as ItemState;

/** Find a chest by the plain-text prefix of its (HTML-bearing) name. */
const chestNamed = (prefix: string) => {
  const chest = chests.find((candidate) => candidate.name.startsWith(prefix));
  if (!chest) throw new Error(`no chest named ${prefix}`);
  return chest;
};

describe("chest table", () => {
  it("declares every chest closed with usable coordinates", () => {
    expect(chests).toHaveLength(65);

    chests.forEach((chest) => {
      expect(chest.isOpened).toBe(false);
      expect(chest.name.length).toBeGreaterThan(0);
      expect(chest.x).toMatch(/^\d+(\.\d+)?%$/);
      expect(chest.y).toMatch(/^\d+(\.\d+)?%$/);
    });
  });

  it("keeps chest progress independent of the source table", () => {
    // The store clones chests; mutating a clone must not leak back here.
    const clone = { ...chests[0], isOpened: true };

    expect(clone.isOpened).toBe(true);
    expect(chests[0].isOpened).toBe(false);
  });
});

describe("chest availability (real logic)", () => {
  it("marks an unconditional chest available with nothing held", () => {
    expect(chestNamed("Tavern").isAvailable(makeItems())).toBe("available");
  });

  it("gates King's Tomb behind the boots plus a way in", () => {
    const kingsTomb = chestNamed("King's Tomb");

    expect(kingsTomb.isAvailable(makeItems({ boots: true }))).toBe(
      "unavailable",
    );
    expect(kingsTomb.isAvailable(makeItems({ glove: 2 }))).toBe("unavailable");
    expect(kingsTomb.isAvailable(makeItems({ boots: true, glove: 2 }))).toBe(
      "available",
    );
  });

  it("reports Mimic Cave as possible while the medallion is unknown", () => {
    const mimic = chestNamed("Mimic Cave");
    const reachable = {
      bombos: true,
      ether: true,
      hammer: true,
      mirror: true,
      moonpearl: true,
      quake: true,
      somaria: true,
    };
    const unknownMedallion = Array(10).fill(0);

    // Turtle Rock's requirement is unknown, and the fire rod is missing.
    expect(
      mimic.isAvailable(
        makeItems({ ...reachable, glove: 2 }),
        unknownMedallion,
      ),
    ).toBe("possible");

    // With the fire rod as well, the same state becomes fully available.
    expect(
      mimic.isAvailable(
        makeItems({ ...reachable, firerod: true, glove: 2 }),
        unknownMedallion,
      ),
    ).toBe("available");
  });

  it("refuses Mimic Cave when the required medallion is not held", () => {
    const mimic = chestNamed("Mimic Cave");
    const quakeRequired = Array(10).fill(0);
    quakeRequired[9] = 3; // Turtle Rock requires Quake

    expect(
      mimic.isAvailable(
        makeItems({
          bombos: true,
          firerod: true,
          glove: 2,
          hammer: true,
          mirror: true,
          moonpearl: true,
          somaria: true,
        }),
        quakeRequired,
      ),
    ).toBe("unavailable");
  });
});
