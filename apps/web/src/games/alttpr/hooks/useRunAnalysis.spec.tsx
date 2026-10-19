import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeNow,
  useGoModeMissing,
  useMissing,
  useRunAnalysis,
} from "@/games/alttpr/hooks/useRunAnalysis";
import { analyzeRun } from "@/games/alttpr/logic/missing";
import { solutionOf } from "@/games/alttpr/logic/solution";
import { useAnalysisStore } from "@/games/alttpr/stores/analysisStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

// Counted, to tell how often the run is worked out
vi.mock("@/games/alttpr/logic/missing", async (original) => {
  const actual =
    await original<typeof import("@/games/alttpr/logic/missing")>();
  return { ...actual, analyzeRun: vi.fn(actual.analyzeRun) };
});

const analysis = () => useAnalysisStore.getState().analysis;
const current = () => solutionOf(useGameStore.getState());

describe("useRunAnalysis", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
    vi.mocked(analyzeRun).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("works the run out once the click is over, never during it", () => {
    renderHook(() => useRunAnalysis());
    expect(analysis()).toBeNull();

    act(() => vi.runAllTimers());
    expect(analysis()?.solution).toBe(current());

    act(() => useGameStore.getState().handleItemClick("boots"));
    // The click has re-solved the run; its analysis waits for idle time
    expect(analysis()?.solution).not.toBe(current());
    act(() => vi.runAllTimers());
    expect(analysis()?.solution).toBe(current());
    expect(analysis()?.missing.has("library")).toBe(false);
  });

  it("works out only the last of several quick changes", () => {
    renderHook(() => useRunAnalysis());
    act(() => {
      vi.runAllTimers();
      useGameStore.getState().handleItemClick("boots");
      useGameStore.getState().handleItemClick("hammer");
    });
    act(() => vi.runAllTimers());
    expect(analysis()?.solution).toBe(current());
    // The first run's, then the last change's: not the one in between
    expect(analyzeRun).toHaveBeenCalledTimes(2);
  });

  it("does nothing for a change that leaves the solution as it was", () => {
    renderHook(() => useRunAnalysis());
    act(() => vi.runAllTimers());
    const before = analysis();

    act(() => useGameStore.getState().toggleChecks(["kings-tomb"]));
    act(() => useGameStore.getState().setMapLayout("stacked"));

    act(() => vi.runAllTimers());
    expect(analysis()).toBe(before);
    expect(analyzeRun).toHaveBeenCalledTimes(1);
  });

  it("waits for the browser's idle callback where there is one", () => {
    const idle = vi.fn((task: () => void) => setTimeout(task, 50));
    const cancel = vi.fn();
    vi.stubGlobal("requestIdleCallback", idle);
    vi.stubGlobal("cancelIdleCallback", cancel);
    const { unmount } = renderHook(() => useRunAnalysis());

    expect(idle).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 500,
    });
    unmount();
    expect(cancel).toHaveBeenCalled();
    act(() => vi.runAllTimers());
    expect(analysis()).not.toBeNull();
  });

  it("stops listening once unmounted", () => {
    const { unmount } = renderHook(() => useRunAnalysis());
    unmount();
    act(() => vi.runAllTimers());
    act(() => useGameStore.getState().handleItemClick("boots"));
    act(() => vi.runAllTimers());
    expect(analysis()).toBeNull();
    expect(analyzeRun).not.toHaveBeenCalled();
  });
});

describe("useMissing", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useAnalysisStore.setState({ analysis: null });
    });
  });

  it("is pending until the analysis is done, then null for a check in logic", () => {
    const { result } = renderHook(() => ({
      home: useMissing("links-house"),
      library: useMissing("library"),
    }));
    expect(result.current).toEqual({ home: undefined, library: undefined });

    act(() => analyzeNow());
    expect(result.current.home).toBeNull();
    expect(result.current.library?.tri).toBe("no");
  });

  it("never shows an analysis of another solution", () => {
    act(() => analyzeNow());
    const { result } = renderHook(() => useMissing("library"));
    expect(result.current?.tri).toBe("no");

    act(() => useGameStore.getState().handleItemClick("boots"));
    expect(result.current).toBeUndefined();
    act(() => analyzeNow());
    expect(result.current).toBeNull();
  });

  it("reads the go mode's missing ways", () => {
    act(() => analyzeNow());
    const { result } = renderHook(() => useGoModeMissing());
    expect(result.current).toEqual({ sets: [], truncated: false });
  });
});
