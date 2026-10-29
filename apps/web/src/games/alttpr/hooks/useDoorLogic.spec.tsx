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
});
