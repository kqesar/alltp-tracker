import { describe, expect, it } from "vitest";
import { type State, solve, type Tri } from "../src/index";
import { compileSample, SAMPLE_ITEMS } from "./alttp-sample";

const world = compileSample();
const at = (state: State) => solve(world, state);

const SIX_CRYSTALS = {
  crystal1: true,
  crystal2: true,
  crystal3: true,
  crystal4: true,
  crystal5: true,
  crystal6: true,
};

describe("ALttP sample world", () => {
  it("has the shape of a small game", () => {
    expect(world.regionIds).toHaveLength(9);
    expect(world.locationIds).toHaveLength(23);
  });

  it("starts with only the free Light World checks", () => {
    const solution = at({});
    expect(solution.regions()).toEqual({
      castleTower: "no",
      darkDeathMountain: "no",
      darkWorldNorthEast: "no",
      darkWorldNorthWest: "no",
      darkWorldSouth: "no",
      deathMountainEast: "no",
      deathMountainWest: "no",
      lightWorld: "yes",
      towerOfHera: "no",
    });
    expect(solution.location("linksUncle")).toBe("yes");
    expect(solution.location("sanctuary")).toBe("yes");
    expect(solution.location("library")).toBe("no");
    expect(solution.location("oldMan")).toBe("no");
  });

  it.each<[string, State, Tri, Tri]>([
    // [case, state, Death Mountain West, Old Man]
    ["glove, no lantern: the dark cave", { glove: 1 }, "maybe", "maybe"],
    ["glove and lantern", { glove: 1, lantern: true }, "yes", "yes"],
    // The flute skips the cave, but the Old Man still wants a light.
    ["flute only", { flute: true }, "yes", "maybe"],
    ["lantern alone", { lantern: true }, "no", "no"],
  ])(
    "reaches Death Mountain via the Old Man: %s",
    (_, state, region, oldMan) => {
      const solution = at(state);
      expect(solution.region("deathMountainWest")).toBe(region);
      expect(solution.location("spectacleRockCave")).toBe(region);
      expect(solution.location("oldMan")).toBe(oldMan);
    },
  );

  it("enters the Dark World through Agahnim, as a bunny without the pearl", () => {
    const bunny = at({ agahnim: true });
    expect(bunny.region("darkWorldNorthEast")).toBe("yes");
    expect(bunny.location("pyramidLedge")).toBe("yes");
    expect(bunny.location("catfish")).toBe("no");
    expect(bunny.region("darkWorldSouth")).toBe("no");

    const link = at({ agahnim: true, glove: 1, moonpearl: true });
    expect(link.location("catfish")).toBe("yes");
    expect(link.location("stumpy")).toBe("yes");
  });

  it.each<[State, Tri]>([
    [{ glove: 2, moonpearl: true }, "yes"],
    [{ glove: 1, hammer: true, moonpearl: true }, "yes"],
    [{ glove: 1, moonpearl: true }, "no"],
    [{ glove: 2 }, "no"],
  ])("opens the south Dark World portal with %j: %s", (state, expected) => {
    const solution = at(state);
    expect(solution.region("darkWorldSouth")).toBe(expected);
    expect(solution.location("chestGame")).toBe(expected);
  });

  it.each<[string, State, Tri, Tri]>([
    // [case, state, location, visible]
    ["nothing", {}, "no", "no"],
    ["the portal: seen from below", { glove: 2, moonpearl: true }, "no", "yes"],
    [
      "the portal and the cape",
      { cape: true, glove: 2, moonpearl: true },
      "yes",
      "yes",
    ],
  ])(
    "sees the Bumper Cave ledge before reaching it: %s",
    (_, state, location, visible) => {
      const solution = at(state);
      expect(solution.location("bumperCaveLedge")).toBe(location);
      expect(solution.visible("bumperCaveLedge")).toBe(visible);
    },
  );

  it.each<[string, State, Tri, Tri]>([
    // [case, state, location, visible]
    ["Death Mountain, no Book", { flute: true }, "no", "no"],
    ["the Book off the mountain", { book: true }, "no", "no"],
    ["the Book on Death Mountain", { book: true, flute: true }, "no", "yes"],
    // The dark cave: the mountain, and so the reading, is only a maybe.
    ["the Book through the dark cave", { book: true, glove: 1 }, "no", "maybe"],
    [
      "everything it needs",
      { book: true, flute: true, mirror: true, sword: 2 },
      "yes",
      "yes",
    ],
  ])(
    "reads the Ether tablet with the Book: %s",
    (_, state, location, visible) => {
      const solution = at(state);
      expect(solution.location("etherTablet")).toBe(location);
      expect(solution.visible("etherTablet")).toBe(visible);
    },
  );

  it("keeps visible equal to availability where no visible entry is given", () => {
    const solution = at({ book: true, flute: true, glove: 2, moonpearl: true });
    const { bumperCaveLedge, etherTablet, ...others } = solution.visibles();
    const {
      bumperCaveLedge: _b,
      etherTablet: _e,
      ...available
    } = solution.locations();
    expect(bumperCaveLedge).toBe("yes");
    expect(etherTablet).toBe("yes");
    expect(others).toEqual(available);
  });

  it("gates Ganon's Tower on count(crystal) >= 7", () => {
    const ddm = {
      boots: true,
      flute: true,
      glove: 2,
      hookshot: true,
      moonpearl: true,
    };
    expect(at({ ...ddm, ...SIX_CRYSTALS }).region("darkDeathMountain")).toBe(
      "yes",
    );
    expect(at({ ...ddm, ...SIX_CRYSTALS }).location("bobsTorch")).toBe("no");
    expect(
      at({ ...ddm, ...SIX_CRYSTALS, crystal7: true }).location("bobsTorch"),
    ).toBe("yes");
  });

  it("marks Agahnim's Tower maybe until the lantern lights the maze", () => {
    const sword = at({ sword: 2 });
    expect(sword.region("castleTower")).toBe("yes");
    expect(sword.location("castleTowerChests")).toBe("maybe");
    expect(sword.location("agahnimFight")).toBe("maybe");
    expect(at({ lantern: true, sword: 2 }).location("agahnimFight")).toBe(
      "yes",
    );
    // The cape gets in, but the fight still needs a sword or the net.
    expect(at({ cape: true, lantern: true }).location("agahnimFight")).toBe(
      "no",
    );
  });

  it("puts everything in logic with every item", () => {
    const everything = Object.fromEntries(
      SAMPLE_ITEMS.map((item) => [item, item === "sword" ? 4 : 2]),
    );
    const locations = at(everything).locations();
    expect(Object.keys(locations)).toHaveLength(23);
    expect(
      Object.entries(locations).filter(([, tri]) => tri !== "yes"),
    ).toEqual([]);
  });
});
