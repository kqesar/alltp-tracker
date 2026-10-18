import type { State } from "@alltp/engine";
import { describe, expect, it } from "vitest";
import seed from "../test/er-seeds/0yAObedRMV.json" with { type: "json" };
import { entranceNamed, erLocationId, targetNamed } from "./entrances";
import {
  analyzeFacts,
  crossedConnections,
  type ErConnections,
  erWorld,
  solveFacts,
  solveFactsState,
  vanillaConnections,
} from "./er-world";
import { everything } from "./keys";
import { MARKERS } from "./markers";
import { OPEN, STANDARD, settingsFromUpstream } from "./settings";

const id = (name: string) => entranceNamed(name).id;
const target = (name: string) => targetNamed(name).id;

/** A location's answer in a world, with `state` held. */
const at = (
  connections: ErConnections,
  state: State,
  location: string,
  settings = OPEN,
) =>
  solveFacts(erWorld(settings, connections), state).location(
    erLocationId(location),
  );

/** Everything, but some items. */
const allBut = (...items: string[]): State => ({
  ...everything(OPEN),
  ...Object.fromEntries(items.map((item) => [item, 0])),
});

describe("the entrance randomizer's connections", () => {
  it("connect a cave both ways, a single door or a hole one way", () => {
    const connections = crossedConnections("open", {
      [id("Kakariko Shop")]: target("Elder House Exit (East)"),
      [id("Big Bomb Shop")]: target("Blinds Hideout"),
      [id("Kakariko Well Drop")]: target("Bat Cave (right)"),
      // An id this version does not know is left out
      unknown: "elder-house-exit-west",
    });
    expect(connections.get("Kakariko Shop")).toBe("Elder House");
    expect(connections.get("Elder House Exit (East)")).toBe("Light World");
    expect(connections.get("Big Bomb Shop")).toBe("Blinds Hideout");
    expect(connections.get("Kakariko Well Drop")).toBe("Bat Cave (right)");
    // What the shuffle keeps: Link's House, the Tavern's back door
    expect(connections.get("Links House")).toBe("Links House");
    expect(connections.get("Tavern North")).toBe("Tavern");
    expect(connections.has("Hyrule Castle Entrance (South)")).toBe(false);
    // Standard keeps the escape's doors
    expect(
      crossedConnections("standard", {}).get(
        "Hyrule Castle Secret Entrance Drop",
      ),
    ).toBe("Hyrule Castle Secret Entrance");
  });

  it("lead only through the doors noted", () => {
    const none = crossedConnections("open", {});
    // Outdoors, from Link's House
    expect(at(none, everything(OPEN), "Mushroom")).toBe("yes");
    // Behind the Tavern's back door, which the shuffle keeps
    expect(at(none, everything(OPEN), "Kakariko Tavern")).toBe("yes");
    // Behind a door not noted
    expect(at(none, everything(OPEN), "Blind's Hideout - Top")).toBe("no");
    const noted = crossedConnections("open", {
      [id("Kakariko Shop")]: target("Blinds Hideout"),
    });
    expect(at(noted, {}, "Blind's Hideout - Top")).toBe("yes");
  });
});

describe("the entrance randomizer's world", () => {
  const vanilla = vanillaConnections();

  it("holds an event once its location is reached", () => {
    // The floodgate's event opens the Sunken Treasure (Rules.py:136, 295)
    expect(at(vanilla, {}, "Sunken Treasure")).toBe("yes");
    expect(at(crossedConnections("open", {}), {}, "Sunken Treasure")).toBe(
      "no",
    );
  });

  it("takes the pearl in the dark world, the bunny's rules", () => {
    // Up the Dark World's mountain by the teleporter, no pearl asked; its
    // cave lies in the dark world once the regions are marked
    const location = erLocationId("Superbunny Cave - Top");
    const bunny = (marked: boolean) =>
      solveFacts(
        erWorld(OPEN, vanilla, { marked }),
        allBut("moonPearl"),
      ).location(location);
    expect(bunny(true)).toBe("no");
    expect(bunny(false)).toBe("yes");
  });

  it("asks the big bomb's route by where the shop's door is", () => {
    // The vanilla door is a southern Dark World one: the peg bridge, or the
    // mirror through the castle's gate (Rules.py:1263-1266)
    const solution = solveFacts(
      erWorld(OPEN, vanilla),
      allBut("hammer", "magicMirror"),
    );
    // The shop is reached, its bomb not brought back
    expect(solution.region("bigBombShop")).toBe("yes");
    expect(solution.location(erLocationId("Pyramid Fairy - Left"))).toBe("no");
    expect(at(vanilla, allBut("hammer"), "Pyramid Fairy - Left")).toBe("yes");
  });

  it("counts Turtle Rock's keys by what everything held reaches", () => {
    // Every part of it reached: its back door's rules, four keys
    const keys = (n: number) => ({ ...everything(OPEN), keyD7: n });
    expect(at(vanilla, keys(3), "Turtle Rock - Big Key Chest")).not.toBe("yes");
    expect(at(vanilla, keys(4), "Turtle Rock - Big Key Chest")).toBe("yes");
  });

  it("says what a check misses through its facts, in items", () => {
    // The Blacksmith wants the smith back (an event), who wants the frog
    // (another), whom only the Titan's Mitt and the pearl reach
    const world = erWorld(OPEN, vanilla);
    const { state } = solveFactsState(world, {});
    expect(state.openFloodgate).toBe(1);
    const analysis = analyzeFacts(world, state, { maxAtoms: 3 });
    expect(analysis.blockers("blacksmith", "yes")).toEqual({
      sets: [
        [
          { item: "glove", min: 2 },
          { item: "moonPearl", min: 1 },
        ],
      ],
      truncated: false,
    });
    expect(analysis.blockers("sunken-treasure", "yes").sets).toEqual([[]]);
  });

  it("starts Standard by the uncle", () => {
    expect(at(vanilla, {}, "Link's Uncle", STANDARD)).toBe("yes");
  });

  it("refuses the Inverted world", () => {
    expect(() => erWorld(settingsFromUpstream("inverted"), vanilla)).toThrow(
      /Inverted/,
    );
  });
});

describe("the pack's ids", () => {
  it("name every location of the map and every dungeon's prize", () => {
    const world = erWorld(OPEN, crossedConnections("open", {}));
    const ids = new Set(world.compiled.locationIds);
    const missing = [
      ...MARKERS.flatMap((marker) => marker.locations),
      "agahnim",
      "agahnim-2",
    ].filter((location) => !ids.has(location));
    expect(missing).toEqual([]);
  });
});

describe("a real Crosskeys seed, its entrances all noted", () => {
  const settings = settingsFromUpstream("open", { dungeonItems: "full" });
  // Link's House and the Tavern's back door stay, its Chris Houlihan room
  // is a way out (entrances.spec.ts)
  const fixed = new Set(["Links House", "Tavern North"]);
  const noted = Object.fromEntries(
    seed.entrances
      .filter((m) => m.direction !== "exit" && !fixed.has(m.entrance))
      .map((m) => [id(m.entrance), target(m.exit)]),
  );
  const connections = crossedConnections("open", noted);

  it("reaches every location with everything held", () => {
    const solution = solveFacts(
      erWorld(settings, connections),
      everything(settings),
    );
    const missed = Object.entries(solution.locations()).filter(
      ([, tri]) => tri !== "yes",
    );
    expect(Object.keys(solution.locations()).length).toBeGreaterThan(200);
    expect(missed).toEqual([]);
  });

  it("builds and solves within budget", () => {
    // Built once per entrance noted, solved on every click: the fastest of
    // a few runs, far above what a run takes, to catch a blow-up
    const fastest = (run: () => void) => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        run();
        best = Math.min(best, performance.now() - start);
      }
      return best;
    };
    const world = erWorld(settings, connections);
    expect(fastest(() => erWorld(settings, connections))).toBeLessThan(100);
    expect(fastest(() => solveFacts(world, {}))).toBeLessThan(10);
  });
});
