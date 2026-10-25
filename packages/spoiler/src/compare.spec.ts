import { describe, expect, it } from "vitest";
import { compareRun, type Find } from "./compare";
import type { Placement } from "./model";

function place(
  location: string,
  item: string | null,
  sphere: number | null,
): Placement {
  return {
    area: null,
    item,
    itemName: item ?? "Rupees",
    location,
    locationName: location,
    sphere,
  };
}

const PLACEMENTS = [
  place("well", "lamp", 1),
  place("pond", "hookshot", 2),
  place("tower", "sword", 3),
  place("cave", "boots", 3),
  place("junk", null, null),
];

function states(result: ReturnType<typeof compareRun>) {
  return result.entries.map(
    (e) => `${e.placement.location}:${e.state}:${e.behind}`,
  );
}

describe("compareRun", () => {
  it("finds everything in order", () => {
    const finds: Find[] = [
      { at: 10, location: "well" },
      { at: 20, location: "pond" },
      { at: 30, location: "tower" },
      { at: 40, location: "cave" },
    ];
    const result = compareRun({ finds, placements: PLACEMENTS });
    expect(states(result)).toEqual([
      "well:found:0",
      "pond:found:0",
      "tower:found:0",
      "cave:found:0",
      "junk:missed:0",
    ]);
    expect(result.summary).toEqual({
      inOrder: 4,
      late: 0,
      missed: 0,
      required: 4,
      unknown: 0,
    });
    expect(result.unmatched).toEqual([]);
  });

  it("counts the items of later spheres found before one as its lateness", () => {
    // The sphere-1 lamp comes last, after the sphere-2 hookshot and a sphere-3 sword.
    const finds: Find[] = [
      { at: 5, location: "pond" },
      { at: 6, location: "tower" },
      { at: 7, location: "well" },
      { at: 8, location: "cave" },
    ];
    const result = compareRun({ finds, placements: PLACEMENTS });
    expect(states(result)).toEqual([
      "well:found:2",
      "pond:found:0",
      "tower:found:0",
      "cave:found:0",
      "junk:missed:0",
    ]);
    expect(result.summary).toMatchObject({ inOrder: 3, late: 1, required: 4 });
  });

  it("does not count the same sphere, nor a tie in time, as later", () => {
    const finds: Find[] = [
      { at: 1, location: "cave" },
      { at: 1, location: "tower" },
      { at: 1, location: "pond" },
    ];
    const result = compareRun({ finds, placements: PLACEMENTS });
    expect(result.entries.map((e) => e.behind)).toEqual([0, 0, 0, 0, 0]);
  });

  it("calls a never-found required item missed, and unknown where the tracker cannot tell", () => {
    const finds: Find[] = [{ at: 1, location: "well" }];
    const result = compareRun({
      finds,
      placements: PLACEMENTS,
      unknown: new Set(["pond", "junk"]),
    });
    expect(states(result)).toEqual([
      "well:found:0",
      "pond:unknown:0",
      "tower:missed:0",
      "cave:missed:0",
      "junk:unknown:0",
    ]);
    // junk is outside the playthrough: it is not in the summary.
    expect(result.summary).toEqual({
      inOrder: 1,
      late: 0,
      missed: 2,
      required: 4,
      unknown: 1,
    });
  });

  it("a find at a place still counts when the place is also unknown", () => {
    const result = compareRun({
      finds: [{ at: 1, location: "pond" }],
      placements: PLACEMENTS,
      unknown: new Set(["pond"]),
    });
    expect(result.entries[1]?.state).toBe("found");
  });

  it("keeps the earlier of two finds for one place and leaves the other unmatched", () => {
    const early = { at: 1, location: "well" };
    const late = { at: 9, location: "well" };
    const result = compareRun({ finds: [late, early], placements: PLACEMENTS });
    expect(result.entries[0]?.find).toBe(early);
    expect(result.unmatched).toEqual([late]);
  });

  describe("by item, for a find with no location", () => {
    const sword = [
      place("smith", "sword", 1),
      place("pyramid", "sword", 2),
      place("ganon", "sword", 4),
      place("extra", "sword", null),
    ];

    it("gives the k-th find of an item to the k-th placement in sphere order, marked inferred", () => {
      const finds: Find[] = [
        { at: 3, item: "sword" },
        { at: 1, item: "sword" },
      ];
      const result = compareRun({ finds, placements: sword });
      expect(
        result.entries.map((e) => [e.state, e.find?.at ?? null, e.inferred]),
      ).toEqual([
        ["found", 1, true],
        ["found", 3, true],
        ["missed", null, false],
        ["missed", null, false],
      ]);
      expect(result.summary).toMatchObject({
        inOrder: 2,
        missed: 1,
        required: 3,
      });
    });

    it("sorts placements by sphere, not by their order in the file", () => {
      const shuffled = [sword[2], sword[0], sword[1]].filter(
        (p) => p !== undefined,
      );
      const result = compareRun({
        finds: [{ at: 1, item: "sword" }],
        placements: shuffled,
      });
      expect(result.entries.map((e) => e.state)).toEqual([
        "missed",
        "found",
        "missed",
      ]);
    });

    it("leaves a placement matched by location out of the item queue", () => {
      const finds: Find[] = [
        { at: 1, item: "sword", location: "smith" },
        { at: 2, item: "sword" },
      ];
      const result = compareRun({ finds, placements: sword });
      expect(
        result.entries.map((e) => [e.find?.at ?? null, e.inferred]),
      ).toEqual([
        [1, false],
        [2, true],
        [null, false],
        [null, false],
      ]);
    });

    it("an item the seed never placed, a find of an unknown place and a surplus find are unmatched", () => {
      const stray = { at: 1, item: "bow" };
      const lost = { at: 2, location: "nowhere" };
      const surplus = [
        { at: 3, item: "sword" },
        { at: 4, item: "sword" },
        { at: 5, item: "sword" },
        { at: 6, item: "sword" },
        { at: 7, item: "sword" },
      ];
      const result = compareRun({
        finds: [stray, lost, ...surplus],
        placements: sword,
      });
      expect(result.unmatched).toEqual([stray, lost, surplus[4]]);
    });

    it("measures lateness over inferred matches too", () => {
      const placements = [place("a", "bow", 1), place("b", "net", 2)];
      const result = compareRun({
        finds: [
          { at: 1, item: "net" },
          { at: 2, item: "bow" },
        ],
        placements,
      });
      expect(result.entries.map((e) => e.behind)).toEqual([1, 0]);
    });

    it("never matches a placement of an item the pack has none for", () => {
      const result = compareRun({
        finds: [{ at: 1, item: "sword" }],
        placements: [place("rupee", null, 1)],
      });
      expect(result.entries[0]?.state).toBe("missed");
      expect(result.unmatched).toHaveLength(1);
    });
  });

  it("returns an empty comparison for nothing", () => {
    expect(compareRun({ finds: [], placements: [] })).toEqual({
      entries: [],
      summary: { inOrder: 0, late: 0, missed: 0, required: 0, unknown: 0 },
      unmatched: [],
    });
  });

  it("keeps the input order of the placements and does not mutate its input", () => {
    const finds = [
      { at: 9, location: "cave" },
      { at: 1, location: "well" },
    ];
    const copy = structuredClone(finds);
    const result = compareRun({ finds, placements: PLACEMENTS });
    expect(result.entries.map((e) => e.placement.location)).toEqual(
      PLACEMENTS.map((p) => p.location),
    );
    expect(finds).toEqual(copy);
  });
});
