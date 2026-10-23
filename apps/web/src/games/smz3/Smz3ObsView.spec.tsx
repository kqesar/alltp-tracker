import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { smz3 } from "@/games/smz3/module";
import { Smz3ObsView } from "@/games/smz3/Smz3ObsView";
import {
  freshProgress,
  SMZ3_STORAGE_KEY,
  useSmz3Store,
} from "@/games/smz3/store";

beforeEach(() => {
  localStorage.clear();
  useSmz3Store.setState(useSmz3Store.getInitialState(), true);
});

describe("SMZ3's stream view", () => {
  it("draws the grid alone on a transparent page, fitted to the source", () => {
    const { unmount } = render(<Smz3ObsView background="#00ff00" />);
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

describe("SMZ3's module", () => {
  it("follows the run another tab saves", async () => {
    const rehydrate = vi.spyOn(useSmz3Store.persist, "rehydrate");
    smz3.start();
    localStorage.setItem(
      SMZ3_STORAGE_KEY,
      JSON.stringify({
        state: { ...freshProgress(), checked: ["sanctuary"] },
        version: 1,
      }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", { key: "other", storageArea: localStorage }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SMZ3_STORAGE_KEY,
        storageArea: sessionStorage,
      }),
    );
    expect(rehydrate).not.toHaveBeenCalled();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SMZ3_STORAGE_KEY,
        storageArea: localStorage,
      }),
    );
    expect(rehydrate).toHaveBeenCalledOnce();
    await vi.waitFor(() =>
      expect(useSmz3Store.getState().checked).toEqual(["sanctuary"]),
    );
  });
});
