import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCrossedLogic } from "@/hooks/useCrossedLogic";
import { crossedSolverLoaded, solutionOf } from "@/logic/solution";
import { useGameStore } from "@/stores/gameStore";

describe("useCrossedLogic", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("loads the shuffled entrances' logic for such a run alone", async () => {
    const { rerender } = renderHook(() => useCrossedLogic());
    // An Open run downloads nothing
    rerender();
    expect(crossedSolverLoaded()).toBe(false);

    act(() => useGameStore.getState().applyPreset("crosskeys"));
    await waitFor(() => expect(crossedSolverLoaded()).toBe(true));
    // And the run is solved by it at once
    expect(solutionOf(useGameStore.getState())).toMatchObject({
      modelled: true,
    });
  });
});
