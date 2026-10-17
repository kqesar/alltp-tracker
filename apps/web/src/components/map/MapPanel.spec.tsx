import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MapPanel } from "@/components/map/MapPanel";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useGameStore } from "@/stores/gameStore";

describe("MapPanel", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("shows the map, or the checks, as the player's tab says", async () => {
    const user = userEvent.setup();
    render(<MapPanel />);
    const mapTab = screen.getByRole("tab", { name: "Map" });
    const checksTab = screen.getByRole("tab", { name: "Checks" });
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("map-tracker")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Map");

    await user.click(checksTab);

    expect(useGameStore.getState().mapView).toBe("checks");
    expect(screen.queryByTestId("map-tracker")).toBeNull();
    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Checks");

    // Automatic activation, wrapping round
    await user.keyboard("{ArrowRight}");
    expect(mapTab).toHaveFocus();
    expect(mapTab).toHaveAttribute("aria-selected", "true");
    expect(checksTab).toHaveAttribute("tabindex", "-1");
  });

  it("keeps the view a preference: a new game leaves it", () => {
    act(() => useGameStore.getState().setMapView("checks"));
    act(() => useGameStore.getState().reset());
    render(<MapPanel />);

    expect(screen.getByTestId("checks-panel")).toBeInTheDocument();
  });
});
