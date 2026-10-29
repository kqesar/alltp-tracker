import { beforeEach, describe, expect, it } from "vitest";
import { getPreset, type RunSettings } from "@/games/alttpr/data/presets";
import { checkStates, runZones } from "@/games/alttpr/logic/checks";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const KEYDROP: RunSettings = {
  ...getPreset("door-randomizer").settings,
  dropShuffle: "keys",
  pottery: "cavekeys",
};

const state = () => useGameStore.getState();

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

  it("show maybe, out of logic where the dungeon cannot be entered, done once checked", () => {
    const states = checkStates(state());
    expect(states["eastern-palace/dark-square-pot-key"]).toBe("possible");
    // Turtle Rock, with nothing found: no way in (its region `no`)
    expect(states["turtle-rock/pokey-1-key-drop"]).toBe("unavailable");
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
