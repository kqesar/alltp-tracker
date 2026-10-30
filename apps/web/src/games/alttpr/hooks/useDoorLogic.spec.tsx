import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDoorLogic } from "@/games/alttpr/hooks/useDoorLogic";
import { doorSolverLoaded, solutionOf } from "@/games/alttpr/logic/solution";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

describe("useDoorLogic", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("loads the Door Randomizer's world for such a run alone", async () => {
    const { rerender } = renderHook(() => useDoorLogic());
    // An Open run downloads nothing, nor DR's Crosskeys (the crossed world)
    rerender();
    expect(doorSolverLoaded()).toBe(false);
    act(() => useGameStore.getState().applyPreset("door-crosskeys"));
    rerender();
    expect(doorSolverLoaded()).toBe(false);

    act(() => useGameStore.getState().applyPreset("door-randomizer"));
    await waitFor(() => expect(doorSolverLoaded()).toBe(true));
    // And the run is solved by it at once
    const solution = solutionOf(useGameStore.getState());
    expect(solution).toMatchObject({ modelled: true });
    expect(solution.door).toBeDefined();
  });

  it("loads the Overworld Randomizer's world for its runs, and solves them there", async () => {
    const { rerender } = renderHook(() => useDoorLogic());
    act(() => {
      useGameStore.getState().applyPreset("door-randomizer");
      useGameStore.getState().updateDoorSettings({ randomizer: "owr" });
    });
    rerender();
    await waitFor(() => expect(doorSolverLoaded("owr")).toBe(true));
    const solution = solutionOf(useGameStore.getState());
    expect(solution).toMatchObject({ modelled: true });
    // The fork's own world: its farms are locations of it
    // (create_farm_locations, ItemList.py:640-700), never of DR's
    expect(
      solution.door?.world.locationIds.has("Kakariko Village Bush Drop"),
    ).toBe(true);
  });
});
