import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  bonkDropsLoaded,
  doorLocationById,
  doorLocationsOf,
  doorTablesOf,
} from "@/games/alttpr/data/doorRando";
import { useBonkDrops } from "@/games/alttpr/hooks/useBonkDrops";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

describe("useBonkDrops", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("loads the bonk drops for a run that shuffles them alone", async () => {
    const { rerender } = renderHook(() => useBonkDrops());
    // An OWR run that keeps them in place downloads nothing
    act(() => {
      useGameStore.getState().applyPreset("door-randomizer");
      useGameStore.getState().updateDoorSettings({ randomizer: "owr" });
    });
    rerender();
    expect(bonkDropsLoaded()).toBe(false);
    act(() => useGameStore.getState().updateDoorSettings({ bonkDrops: true }));
    // Listed none until they arrive, then all 42, read from the screens
    const { settings } = useGameStore.getState();
    expect(doorLocationsOf(settings).locations).toEqual([]);
    await waitFor(() => expect(bonkDropsLoaded()).toBe(true));
    const { locations } = doorLocationsOf(useGameStore.getState().settings);
    expect(locations.filter((l) => l.kind === "bonk")).toHaveLength(42);
    expect(doorTablesOf(useGameStore.getState().settings)).toEqual(
      new Set(["owr-bonks"]),
    );
    expect(doorLocationById("pyramid-tree")?.region).toBe("Pyramid Area");
  });
});
