import { describe, expect, it } from "vitest";
import type { State } from "./evaluate";
import { ParseError } from "./parser";
import { DefinitionError } from "./rules";
import { solve } from "./solve";
import type { Tri } from "./tri";
import { compileWorld, type World } from "./world";

function definitionError(world: World): DefinitionError {
  try {
    compileWorld(world);
  } catch (error) {
    if (error instanceof DefinitionError) return error;
    throw error;
  }
  throw new Error("expected compileWorld to throw a DefinitionError");
}

describe("solve: the visible channel", () => {
  // A ledge item: collected from the ledge (behind the hookshot), seen from
  // the valley below, or read from the lookout with the Book.
  const world: World = {
    regions: [
      {
        exits: [
          { req: "hookshot", to: "ledge" },
          { req: "?lantern", to: "lookout" },
        ],
        id: "valley",
        locations: [
          { id: "plain" },
          { id: "chest", req: "boots" },
          { id: "secret", req: "boots", visible: { req: "?book & glasses" } },
        ],
      },
      {
        id: "ledge",
        locations: [
          { id: "ledgeItem", visible: { from: "valley" } },
          {
            id: "tablet",
            req: "sword",
            visible: { from: "lookout", req: "book" },
          },
        ],
      },
      { id: "lookout" },
    ],
    start: "valley",
  };
  const compiled = compileWorld(world);
  const at = (state: State) => solve(compiled, state);

  it("is the availability for a location without a visible entry", () => {
    for (const state of [{}, { boots: true }, { hookshot: true, sword: 1 }]) {
      const solution = at(state);
      for (const id of ["plain", "chest"]) {
        expect(solution.visible(id), id).toBe(solution.location(id));
      }
    }
  });

  it.each<[State, Tri, Tri]>([
    // [state, location, visible]: seen from the valley, hookshot or not.
    [{}, "no", "yes"],
    [{ hookshot: true }, "yes", "yes"],
  ])(
    "sees a ledge item from another region (%j)",
    (state, location, visible) => {
      const solution = at(state);
      expect(solution.region("ledge")).toBe(location);
      expect(solution.location("ledgeItem")).toBe(location);
      expect(solution.visible("ledgeItem")).toBe(visible);
    },
  );

  it.each<[State, Tri, Tri]>([
    [{}, "no", "no"],
    // The lookout is a dark climb: seen as maybe without the lantern.
    [{ book: true }, "no", "maybe"],
    [{ book: true, lantern: true }, "no", "yes"],
    // Available beats visible: max(location, ...), even with no lookout.
    [{ hookshot: true, sword: 1 }, "yes", "yes"],
  ])(
    "reads the tablet from the lookout with the Book (%j)",
    (state, location, visible) => {
      const solution = at(state);
      expect(solution.location("tablet")).toBe(location);
      expect(solution.visible("tablet")).toBe(visible);
    },
  );

  it.each<[State, Tri]>([
    [{}, "no"],
    [{ glasses: true }, "maybe"],
    [{ book: true, glasses: true }, "yes"],
  ])("takes the visible requirement's own maybe (%j)", (state, visible) => {
    const solution = at(state);
    expect(solution.location("secret")).toBe("no");
    expect(solution.visible("secret")).toBe(visible);
  });

  it("snapshots every location, and rejects ids the world does not have", () => {
    const visibles = at({ book: true }).visibles();
    expect(visibles).toEqual({
      chest: "no",
      ledgeItem: "yes",
      plain: "yes",
      secret: "no",
      tablet: "maybe",
    });
    expect(() => at({}).visible("nowhere")).toThrow(
      'Unknown location "nowhere"',
    );
  });

  it("can reach() another region in its requirement", () => {
    const solution = solve(
      compileWorld({
        regions: [
          {
            exits: [{ req: "flippers", to: "island" }],
            id: "shore",
            locations: [
              {
                id: "islandItem",
                req: "false",
                visible: { req: "reach(island) | ?glasses" },
              },
            ],
          },
          { id: "island" },
        ],
        start: "shore",
      }),
      { flippers: true },
    );
    expect(solution.location("islandItem")).toBe("no");
    expect(solution.visible("islandItem")).toBe("yes");
  });
});

describe("compileWorld: visible errors", () => {
  it("rejects a visible entry seen from an unknown region", () => {
    const error = definitionError({
      regions: [
        { id: "r", locations: [{ id: "l", visible: { from: "nowhere" } }] },
      ],
      start: "r",
    });
    expect(error.message).toBe(
      'Location "l" is visible from unknown region "nowhere"',
    );
  });

  it("names the visible requirement that does not parse", () => {
    const error = definitionError({
      regions: [
        { id: "r", locations: [{ id: "l", visible: { req: "book &" } }] },
      ],
      start: "r",
    });
    expect(error.message).toMatch(
      /^Location "l" \(visible\): .* at position 6$/,
    );
    expect(error.cause).toBeInstanceOf(ParseError);
  });
});
