import { describe, expect, it } from "vitest";
import { chests, dungeons, type ItemState } from "@/data/chests";
import { items as baseItems } from "@/data/items";

/** A medallions array (length 10) with one dungeon's requirement set. */
const medallionsWith = (index: number, value: number): number[] => {
  const arr = Array(10).fill(0);
  arr[index] = value;
  return arr;
};

/**
 * These tests exercise the REAL dungeon accessibility logic (the functions
 * defined on the dungeon objects), not a mock. They lock in the documented
 * randomizer requirements for a few representative dungeons.
 */
const makeItems = (overrides: Partial<ItemState> = {}): ItemState =>
  ({ ...baseItems, ...overrides }) as ItemState;

describe("dungeon accessibility (real logic)", () => {
  describe("Eastern Palace (index 0)", () => {
    const eastern = dungeons[0];

    it("is available with the bow upgrade", () => {
      expect(eastern.isBeatable(makeItems({ bow: 2 }))).toBe("available");
    });

    it("is unavailable without the bow upgrade", () => {
      expect(eastern.isBeatable(makeItems({ bow: 0 }))).toBe("unavailable");
    });

    it("requires the big key when big keys are visible", () => {
      expect(
        eastern.isBeatable(makeItems({ bigkey0: false, bow: 2 }), [], true),
      ).toBe("unavailable");
      expect(
        eastern.isBeatable(makeItems({ bigkey0: true, bow: 2 }), [], true),
      ).toBe("available");
    });

    it("canGetChest is available with bow upgrade and remaining chests", () => {
      expect(eastern.canGetChest(makeItems({ bow: 2, chest0: 2 }))).toBe(
        "available",
      );
      expect(eastern.canGetChest(makeItems({ bow: 0, chest0: 3 }))).toBe(
        "possible",
      );
    });
  });

  describe("Desert Palace (index 1)", () => {
    const desert = dungeons[1];

    it("is available with glove + book + light + boots", () => {
      expect(
        desert.isBeatable(
          makeItems({ book: true, boots: true, glove: 1, lantern: true }),
        ),
      ).toBe("available");
    });

    it("is only possible without boots", () => {
      expect(
        desert.isBeatable(
          makeItems({ book: true, boots: false, glove: 1, lantern: true }),
        ),
      ).toBe("possible");
    });

    it("is unavailable without a glove", () => {
      expect(
        desert.isBeatable(
          makeItems({ book: true, boots: true, glove: 0, lantern: true }),
        ),
      ).toBe("unavailable");
    });
  });

  describe("Tower of Hera (index 2)", () => {
    const hera = dungeons[2];

    it("is available with glove + mirror + a light source", () => {
      expect(
        hera.isBeatable(makeItems({ glove: 1, lantern: true, mirror: true })),
      ).toBe("available");
    });

    it("is only possible without a light source", () => {
      expect(
        hera.isBeatable(
          makeItems({ firerod: false, glove: 1, lantern: false, mirror: true }),
        ),
      ).toBe("possible");
    });

    it("is unavailable with neither flute nor glove", () => {
      expect(
        hera.isBeatable(
          makeItems({ flute: false, glove: 0, lantern: true, mirror: true }),
        ),
      ).toBe("unavailable");
    });
  });

  describe("Palace of Darkness (index 3)", () => {
    const pod = dungeons[3];

    it("is available with moonpearl + bow + hammer + glove", () => {
      expect(
        pod.isBeatable(
          makeItems({ bow: 2, glove: 1, hammer: true, moonpearl: true }),
        ),
      ).toBe("available");
    });

    it("is unavailable without moonpearl", () => {
      expect(
        pod.isBeatable(
          makeItems({ bow: 2, glove: 1, hammer: true, moonpearl: false }),
        ),
      ).toBe("unavailable");
    });

    it("is unavailable without the hammer", () => {
      expect(
        pod.isBeatable(
          makeItems({ bow: 2, glove: 1, hammer: false, moonpearl: true }),
        ),
      ).toBe("unavailable");
    });
  });

  describe("Misery Mire (index 8) - medallion gate", () => {
    const mire = dungeons[8];
    const baseReqs = {
      boots: true,
      flute: true,
      glove: 2,
      lantern: true,
      moonpearl: true,
      somaria: true,
    } satisfies Partial<ItemState>;

    it("is available when all medallions are owned (unknown requirement)", () => {
      expect(
        mire.isBeatable(
          makeItems({ ...baseReqs, bombos: true, ether: true, quake: true }),
          medallionsWith(8, 0),
        ),
      ).toBe("available");
    });

    it("is unavailable with no medallion items", () => {
      expect(mire.isBeatable(makeItems(baseReqs), medallionsWith(8, 0))).toBe(
        "unavailable",
      );
    });

    it("is unavailable when the required medallion is missing", () => {
      // requirement is Bombos (1) but only Ether is owned
      expect(
        mire.isBeatable(
          makeItems({ ...baseReqs, ether: true }),
          medallionsWith(8, 1),
        ),
      ).toBe("unavailable");
    });

    it("is possible when requirement unknown and not all medallions owned", () => {
      expect(
        mire.isBeatable(
          makeItems({ ...baseReqs, bombos: true }),
          medallionsWith(8, 0),
        ),
      ).toBe("possible");
    });
  });

  describe("Turtle Rock (index 9) - medallion gate", () => {
    const turtle = dungeons[9];
    const baseReqs = {
      firerod: true,
      glove: 2,
      hammer: true,
      hookshot: true,
      icerod: true,
      moonpearl: true,
      somaria: true,
    } satisfies Partial<ItemState>;

    it("is available with the required medallion satisfied", () => {
      expect(
        turtle.isBeatable(
          makeItems({ ...baseReqs, ether: true }),
          medallionsWith(9, 2),
        ),
      ).toBe("available");
    });

    it("is unavailable with no medallion items", () => {
      expect(turtle.isBeatable(makeItems(baseReqs), medallionsWith(9, 0))).toBe(
        "unavailable",
      );
    });
  });

  describe("Mimic Cave chest - medallion gate", () => {
    const mimic = chests.find((chest) => chest.name.includes("Mimic Cave"));
    const baseReqs = {
      glove: 2,
      hammer: true,
      mirror: true,
      moonpearl: true,
      somaria: true,
    } satisfies Partial<ItemState>;

    it("is available with medallions, mirror and the fire rod", () => {
      expect(
        mimic?.isAvailable(
          makeItems({ ...baseReqs, ether: true, firerod: true }),
          medallionsWith(9, 2),
        ),
      ).toBe("available");
    });

    it("is only possible without the fire rod", () => {
      expect(
        mimic?.isAvailable(
          makeItems({ ...baseReqs, ether: true, firerod: false }),
          medallionsWith(9, 2),
        ),
      ).toBe("possible");
    });
  });
});
