import { DR_LOCATIONS, markersOf } from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it } from "vitest";
import { doorLocationsOf, setBonkDrops } from "@/games/alttpr/data/doorRando";
import {
  items as freshItems,
  type ItemState,
  itemsMax,
} from "@/games/alttpr/data/items";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { checkStates, runZones } from "@/games/alttpr/logic/checks";
import { bonkPlacesOf } from "@/games/alttpr/logic/doorChecks";
import { linkChange } from "@/games/alttpr/logic/doorNotes";
import { packSettings } from "@/games/alttpr/logic/settings";
import { setDoorSolver, solutionOf } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { toWorldPosition } from "@/games/alttpr/utils";

const KEYDROP: RunSettings = {
  ...getPreset("door-randomizer").settings,
  bombBag: false,
  dropShuffle: "keys",
  pottery: "cavekeys",
};

const state = () => useGameStore.getState();

/** A pot of Kakariko Well's back room, which the drop reaches with nothing. */
const KAKARIKO_WELL_POT = (() => {
  const found = DR_LOCATIONS.find(
    (l) => l.name === "Kakariko Well (back) Pot #1",
  );
  if (found === undefined) throw new Error("no Kakariko Well pot");
  return found.id;
})();

beforeEach(() => {
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.getState().applyRun("door-randomizer", KEYDROP);
});

describe("a Door Randomizer run's checks", () => {
  it("join their dungeon's zone, and a cave's make zones of their own", () => {
    const zones = runZones(state());
    const eastern = zones.find((zone) => zone.name === "Eastern Palace");
    expect(
      eastern?.checks.filter((check) => check.door).map((check) => check.name),
    ).toEqual(["Dark Square Pot Key", "Dark Eyegore Key Drop"]);
    // cavekeys: the caves' pots, by their DR region (Regions.py:1235-1252)
    const caves = zones.filter(
      (zone) =>
        zone.dungeon === undefined &&
        zone.checks.length > 0 &&
        zone.checks.every((check) => check.door),
    );
    expect(caves.length).toBeGreaterThan(10);
    expect(caves.map((zone) => zone.name)).toContain("Hammer Peg Cave");
  });

  it("show maybe until DR's world is loaded, then its answer, done once checked", async () => {
    // DR's world not loaded yet: every check maybe, the run not modelled
    expect(checkStates(state())["turtle-rock/pokey-1-key-drop"]).toBe(
      "possible",
    );
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    setDoorSolver(solver);
    const states = checkStates(state());
    // Turtle Rock, with nothing found: no way in
    expect(states["turtle-rock/pokey-1-key-drop"]).toBe("unavailable");
    // A cave's pot, of no rule of its own yet: its room, reached
    expect(states[KAKARIKO_WELL_POT]).toBe("available");
    useGameStore.getState().setItem("lantern", true);
    expect(checkStates(state())["eastern-palace/dark-square-pot-key"]).toBe(
      "available",
    );
    useGameStore
      .getState()
      .toggleChecks(["eastern-palace/dark-square-pot-key"]);
    expect(checkStates(state())["eastern-palace/dark-square-pot-key"]).toBe(
      "opened",
    );
  });

  it("follow DR's rules for pots, a take-any cave's item maybe", async () => {
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    setDoorSolver(solver);
    useGameStore.getState().updateDoorSettings({ takeAny: "random" });
    const idOf = (name: string) => {
      const found = DR_LOCATIONS.find((l) => l.name === name);
      if (found === undefined) throw new Error(`no ${name}`);
      return found.id;
    };
    const hookshotPot = idOf("Hookshot Fairy Pot #1");
    const takeAny = doorLocationsOf(state().settings).locations.find(
      (l) => l.kind === "takeAny" && l.region.startsWith("Take-Any"),
    )?.id;
    if (takeAny === undefined) throw new Error("no take-any cave's item");
    // Everything held but the hookshot: the fairy cave's pot wants it
    // (pot_rules, Rules.py:958-960)
    useGameStore.setState({
      items: Object.fromEntries(
        Object.entries(freshItems).map(([id, value]) => [
          id,
          typeof value === "boolean" ? id !== "hookshot" : itemsMax[id],
        ]),
      ) as unknown as ItemState,
    });
    expect(checkStates(state())[hookshotPot]).toBe("unavailable");
    expect(checkStates(state())[takeAny]).toBe("possible");
    useGameStore.getState().setItem("hookshot", true);
    expect(checkStates(state())[hookshotPot]).toBe("available");
  });

  it("list an OWR run's bonk drops by their region once loaded, maybe", async () => {
    useGameStore.getState().applyRun("door-randomizer", {
      ...getPreset("door-randomizer").settings,
      bombBag: false,
      bonkDrops: true,
      randomizer: "owr",
    });
    const bonks = () =>
      runZones(state()).flatMap((zone) =>
        zone.checks
          .filter((check) => check.id === "pyramid-tree")
          .map(() => zone.name),
      );
    expect(bonks()).toEqual([]);
    const { BONK_DROPS } = await import("@alltp/pack-alttpr/bonk");
    setBonkDrops(BONK_DROPS);
    expect(bonks()).toEqual(["Pyramid Area"]);
    // The fork's own rules are not modelled: maybe, done once checked
    expect(checkStates(state())["pyramid-tree"]).toBe("possible");
    useGameStore.getState().toggleChecks(["pyramid-tree"]);
    expect(checkStates(state())["pyramid-tree"]).toBe("opened");
  });

  it("follow the Overworld Randomizer's own rules once its world is loaded", async () => {
    useGameStore.getState().applyRun("door-randomizer", {
      ...getPreset("door-randomizer").settings,
      bombBag: false,
      bonkDrops: true,
      customGoals: false,
      prizeShuffle: "none",
      randomizer: "owr",
      shuffleFollowers: false,
    });
    const { BONK_DROPS } = await import("@alltp/pack-alttpr/bonk");
    setBonkDrops(BONK_DROPS);
    // DR's own world is no stand-in: maybe until the fork's is loaded
    const { solver: dr } = await import("@/games/alttpr/logic/drSolver");
    setDoorSolver(dr);
    expect(solutionOf(state()).modelled).toBe(false);
    expect(checkStates(state())["lost-woods-hideout-tree"]).toBe("possible");
    const { solver } = await import("@/games/alttpr/logic/owrWorld");
    setDoorSolver(solver, "owr");
    expect(solutionOf(state()).modelled).toBe(true);
    // A bonk drop asks the boots, or a sword and Quake (BaseClasses.py:1245)
    expect(checkStates(state())["lost-woods-hideout-tree"]).toBe("unavailable");
    useGameStore.getState().setItem("boots", true);
    expect(checkStates(state())["lost-woods-hideout-tree"]).toBe("available");
    // And the run's other checks are the fork's world's too
    expect(checkStates(state())["links-house"]).toBe("available");
  });

  it("fly to an OWR run's moved flute spots only once noted", async () => {
    useGameStore.getState().applyRun("door-randomizer", {
      ...getPreset("door-randomizer").settings,
      bombBag: false,
      customGoals: false,
      owFluteShuffle: "random",
      owWhirlpool: true,
      prizeShuffle: "none",
      randomizer: "owr",
      shuffleFollowers: false,
    });
    const { solver } = await import("@/games/alttpr/logic/owrWorld");
    setDoorSolver(solver, "owr");
    const { setItem } = useGameStore.getState();
    setItem("flute", true);
    setItem("fluteactive", 3);
    setItem("glove", 2);
    setItem("moonpearl", true);
    // The Mire wants the flute to the desert and the Titan's Mitt
    // (Rules.py, vanilla Mire Area access): no spot noted, no flight
    expect(solutionOf(state()).modelled).toBe(true);
    expect(checkStates(state())["mire-shed/left"]).toBe("unavailable");
    useGameStore.getState().noteOverworld({ flute: [0x30] });
    expect(checkStates(state())["mire-shed/left"]).toBe("available");
    // Undone, the flight is gone again
    useGameStore.getState().undo();
    expect(checkStates(state())["mire-shed/left"]).toBe("unavailable");
  });

  it("draw an OWR run's bonk drops clear of every other marker", async () => {
    const { BONK_DROPS } = await import("@alltp/pack-alttpr/bonk");
    setBonkDrops(BONK_DROPS);
    for (const mode of ["open", "inverted"] as const) {
      const settings: RunSettings = {
        ...getPreset("door-randomizer").settings,
        bombBag: false,
        bonkDrops: true,
        mode,
        randomizer: "owr",
      };
      const places = bonkPlacesOf(settings);
      // Every drop but the cave's statue, three to a rock pile at most
      expect(places.flatMap((p) => p.locations)).toHaveLength(41);
      const squares = [
        ...markersOf(packSettings(settings)).map((m) => {
          const at = toWorldPosition(`${m.x}%`, `${m.y}%`);
          return { ...at, half: m.dungeon === undefined ? 3.4 : 5.43 };
        }),
        ...places.map((p) => ({ half: 3.4, world: p.world, x: p.x, y: p.y })),
      ];
      for (const place of places) {
        const near = squares.filter(
          (s) =>
            s.world === place.world &&
            !(s.x === place.x && s.y === place.y) &&
            Math.max(Math.abs(s.x - place.x), Math.abs(s.y - place.y)) <
              s.half + 3.4 - 1e-9,
        );
        expect(
          near,
          `${place.id} at ${place.x},${place.y} moved ${place.moved}`,
        ).toEqual([]);
        expect(place.moved, place.id).toBeLessThanOrEqual(16);
      }
    }
  });

  it("are none in an alttpr.com run", () => {
    useGameStore.getState().applyPreset("open");
    expect(
      runZones(state()).some((zone) => zone.checks.some((check) => check.door)),
    ).toBe(false);
  });
});

describe("a Door Randomizer run with shuffled entrances", () => {
  it("reads DR's world on the entrances noted, a door not noted leading nowhere", async () => {
    useGameStore.getState().applyPreset("door-crosskeys");
    useGameStore.getState().updateDoorSettings({ bombBag: false });
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    setDoorSolver(solver);
    // DR's world, not the entrance randomizer's
    expect(solutionOf(state()).door).toBeDefined();
    expect(solutionOf(state()).crossed).toBeUndefined();
    // The Lost Woods' hideout, a hole's: not noted, it leads nowhere
    expect(checkStates(state())["lost-woods-hideout"]).toBe("unavailable");
    useGameStore
      .getState()
      .noteEntrance("lost-woods-hideout-drop", "lost-woods-hideout-top");
    // Link's House left unset may be moved: until its door is noted, Link
    // leaves it for nowhere, and nothing is in logic
    expect(checkStates(state())["lost-woods-hideout"]).toBe("unavailable");
    useGameStore.getState().noteEntrance("links-house", "links-house-exit");
    expect(checkStates(state())["lost-woods-hideout"]).toBe("available");
    // Noted elsewhere: the Kakariko Well's hole drops there
    useGameStore.getState().noteEntrances({
      "kakariko-well-drop": "lost-woods-hideout-top",
      "lost-woods-hideout-drop": null,
    });
    expect(checkStates(state())["lost-woods-hideout"]).toBe("available");
    useGameStore.getState().noteEntrance("kakariko-well-drop", null);
    expect(checkStates(state())["lost-woods-hideout"]).toBe("unavailable");
  });

  it("reads DR's world on the doors noted, a door not noted leading nowhere", async () => {
    useGameStore.getState().applyRun("door-randomizer", {
      ...getPreset("door-randomizer").settings,
      bombBag: false,
      doorShuffle: "basic",
    });
    const { solver } = await import("@/games/alttpr/logic/drSolver");
    setDoorSolver(solver);
    expect(solutionOf(state()).door).toBeDefined();
    const cannonball = "eastern-palace/cannonball-chest";
    // Intensity not known: read as 3, Eastern's lobby not noted yet
    expect(checkStates(state())[cannonball]).toBe("unavailable");
    useGameStore
      .getState()
      .noteDoors({ lobbies: { eastern: "eastern-lobby-s" } });
    expect(checkStates(state())[cannonball]).toBe("unavailable");
    // The lobby's bridge into the cannonball room, noted with no kind: the
    // bridge's kind never moves, so it is in logic
    useGameStore
      .getState()
      .noteDoors(
        linkChange(
          state().doors,
          "eastern-lobby-bridge-n",
          "eastern-cannonball-s",
          true,
        ),
      );
    expect(state().doors.kinds).toBeUndefined();
    expect(checkStates(state())[cannonball]).toBe("available");
    // Forgotten again: nowhere
    useGameStore.getState().noteDoors({
      links: {
        "eastern-cannonball-s": null,
        "eastern-lobby-bridge-n": null,
      },
    });
    expect(checkStates(state())[cannonball]).toBe("unavailable");
  });
});
