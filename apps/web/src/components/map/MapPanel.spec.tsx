import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MapPanel } from "@/components/map/MapPanel";
import { analyzeNow } from "@/hooks/useRunAnalysis";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useGameStore } from "@/stores/gameStore";
import type { Progress } from "@/stores/persistence";
import endGame from "../../../e2e/fixtures/end-game.json";

/** The browser tests' end of a run: go mode in logic. */
const END_GAME = endGame.state as Partial<Progress>;

describe("MapPanel", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("shows the map, the checks or the run, as the player's tab says", async () => {
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
    expect(screen.getByRole("tab", { name: "Run" })).toHaveFocus();
    expect(useGameStore.getState().mapView).toBe("run");
    expect(screen.getByTestId("run-panel")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Run");
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

  describe("go mode", () => {
    it("says a Mystery run's goal is not known yet, and nothing to open", () => {
      act(() => useGameStore.getState().applyPreset("mystery"));
      render(<MapPanel />);
      const goMode = screen.getByTestId("go-mode");
      expect(goMode).toHaveTextContent("Go mode: goal unknown");
      expect(goMode.tagName).toBe("SPAN");

      act(() => useGameStore.getState().updateSettings({ goal: "ganon" }));
      expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
        "Go mode: not yet",
      );
    });

    it("is not yet on a fresh run, and says what it misses", async () => {
      const user = userEvent.setup();
      render(<MapPanel />);
      const goMode = screen.getByTestId("go-mode");
      expect(goMode).toHaveAccessibleName("Go mode: not yet");
      expect(goMode).toHaveTextContent("☆");
      expect(screen.getByTestId("go-mode-status")).toHaveTextContent(
        "Go mode: not yet",
      );
      expect(goMode).toHaveAttribute(
        "popovertarget",
        screen.getByTestId("go-mode-panel").id,
      );

      await user.click(goMode);
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "Working it out…",
      );
      act(() => analyzeNow());
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "In logic with:",
      );
    });

    it("is in logic at the end of a run", () => {
      act(() => useGameStore.setState(END_GAME));
      render(<MapPanel />);

      expect(screen.getByTestId("go-mode")).toHaveAccessibleName(
        "Go mode: in logic",
      );
      expect(screen.getByTestId("go-mode")).toHaveTextContent("★");
      expect(screen.getByTestId("go-mode-panel")).toHaveTextContent(
        "Every step to the goal is in logic.",
      );
    });

    it("is not shown for a goal without one", () => {
      act(() => useGameStore.getState().applyPreset("all-dungeons"));
      render(<MapPanel />);

      expect(screen.queryByTestId("go-mode")).toBeNull();
      expect(screen.queryByTestId("go-mode-status")).toBeNull();
    });
  });
});
