import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sm } from "@/games/sm/module";
import { SmObsView, streamSize } from "@/games/sm/SmObsView";
import { freshProgress, SM_STORAGE_KEY, useSmStore } from "@/games/sm/store";

beforeEach(() => {
  localStorage.clear();
  useSmStore.setState(useSmStore.getInitialState(), true);
});

describe("Super Metroid's stream view", () => {
  it("draws the grid alone on a transparent page, fitted to the source", () => {
    const { unmount } = render(<SmObsView background="#00ff00" />);
    expect(document.documentElement.dataset.view).toBe("obs");
    const stage = screen.getByTestId("obs-view");
    expect(stage).toHaveStyle({ backgroundColor: "#00ff00" });
    expect(stage.style.getPropertyValue("--cell")).toMatch(/px$/);
    act(() => {
      window.innerWidth = 600;
      window.dispatchEvent(new Event("resize"));
    });
    expect(stage.style.getPropertyValue("--cell")).toMatch(/px$/);
    unmount();
    expect(document.documentElement.dataset.view).toBeUndefined();
  });
});

describe("Super Metroid's stream view timer", () => {
  it("draws no timer unless asked, then the run's under the grid", () => {
    const { rerender } = render(<SmObsView background={null} />);
    expect(screen.queryByTestId("stream-timer")).toBeNull();

    act(() => useSmStore.getState().startTimer(Date.now()));
    rerender(<SmObsView background={null} timer />);
    expect(screen.getByTestId("stream-timer")).toHaveAccessibleName(
      "Run timer: 0:00, running",
    );
    expect(
      screen.getByTestId("obs-view").style.getPropertyValue("--obs-columns"),
    ).toBe("6");

    act(() => {
      useSmStore.getState().finishTimer(Date.now() + 61_000);
    });
    expect(screen.getByTestId("stream-timer")).toHaveAccessibleName(
      "Run timer: 1:01, stopped",
    );
  });

  it("sizes the source with a row for the timer", () => {
    expect(streamSize(4)(false)).toEqual({ height: 256, width: 384 });
    expect(streamSize(4)(true)).toEqual({ height: 320, width: 384 });
  });
});

describe("Super Metroid's module", () => {
  it("follows the run another tab saves", async () => {
    const rehydrate = vi.spyOn(useSmStore.persist, "rehydrate");
    sm.start();
    localStorage.setItem(
      SM_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), done: ["ridley"] },
        version: 1,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "other", storageArea: localStorage }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SM_STORAGE_KEY,
        storageArea: sessionStorage,
      }),
    );
    expect(rehydrate).not.toHaveBeenCalled();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SM_STORAGE_KEY,
        storageArea: localStorage,
      }),
    );
    expect(rehydrate).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(useSmStore.getState().done).toEqual(["ridley"]),
    );
  });
});
