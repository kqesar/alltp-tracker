import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sm } from "@/games/sm/module";
import { SmObsView } from "@/games/sm/SmObsView";
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
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(rehydrate).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: SM_STORAGE_KEY }));
    expect(rehydrate).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(useSmStore.getState().done).toEqual(["ridley"]),
    );
  });
});
