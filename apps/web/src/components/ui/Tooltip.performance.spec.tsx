// A hover only reads: the tooltip shows what the run's analysis, worked out
// when the browser was idle, says each check is missing, and solves
// nothing itself. The engine's entry points are counted to prove it.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { Tooltip } from "@/components/ui/Tooltip";
import { analyzeNow } from "@/hooks/useRunAnalysis";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useGameStore } from "@/stores/gameStore";
import { useTooltipStore } from "@/stores/tooltipStore";

vi.mock("@alltp/engine", async (original) => {
  const actual = await original<typeof import("@alltp/engine")>();
  return {
    ...actual,
    analyze: vi.fn(actual.analyze),
    explain: vi.fn(actual.explain),
    solve: vi.fn(actual.solve),
  };
});

const engine = await import("@alltp/engine");

/** How many times the engine has solved, analyzed or explained. */
const work = () =>
  vi.mocked(engine.solve).mock.calls.length +
  vi.mocked(engine.analyze).mock.calls.length +
  vi.mocked(engine.explain).mock.calls.length;

describe("hovering the map", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useTooltipStore.getState().hide();
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("never solves: every marker's tooltip reads the idle-time analysis", () => {
    act(() => {
      useGameStore.getState().handleItemClick("boots");
      analyzeNow();
    });
    render(
      <>
        <MapTracker />
        <Tooltip />
      </>,
    );
    vi.clearAllMocks();

    const markers = [
      ...screen.getAllByTestId(/^marker-/),
      ...screen.getAllByTestId(/^boss-marker-/),
    ];
    expect(markers.length).toBeGreaterThan(70);
    for (const marker of markers) {
      fireEvent.pointerEnter(marker, { pointerType: "mouse" });
    }
    // The tooltips did show what is missing, read from the analysis
    fireEvent.pointerEnter(screen.getByTestId("marker-kings-tomb"), {
      pointerType: "mouse",
    });
    expect(screen.getByTestId("tooltip-missing")).toHaveTextContent(
      "Missing: Titan's Mitt",
    );
    expect(work()).toBe(0);

    // The counters do count: a click solves the run again
    act(() => useGameStore.getState().handleItemClick("hammer"));
    expect(work()).toBeGreaterThan(0);
  });
});
