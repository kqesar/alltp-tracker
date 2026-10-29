import { DR_LOCATIONS } from "@alltp/pack-alttpr";
import { beforeEach, describe, expect, it } from "vitest";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { checkStates, runZones } from "@/games/alttpr/logic/checks";
import { setDoorSolver } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const KEYDROP: RunSettings = {
  ...getPreset("door-randomizer").settings,
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
    const { solver } = await import("@/games/alttpr/logic/doorWorld");
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

  it("are none in an alttpr.com run", () => {
    useGameStore.getState().applyPreset("open");
    expect(
      runZones(state()).some((zone) => zone.checks.some((check) => check.door)),
    ).toBe(false);
  });
});
