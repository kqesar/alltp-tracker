import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TrackerGrid } from "@/components/tracker/TrackerGrid";
import { useGameStore } from "@/stores/gameStore";

const items = () => useGameStore.getState().items;

describe("stepping back with right-click and '-'", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("steps an item back on right-click, wrapping, without the browser menu", () => {
    render(<TrackerGrid itemLayout={[["bow", "sword"]]} />);

    const menuShown = fireEvent.contextMenu(screen.getByTestId("item-bow"));

    expect(menuShown).toBe(false);
    expect(items().bow).toBe(3);
  });

  it("steps back with the '-' key", () => {
    render(<TrackerGrid itemLayout={[["bow", "sword"]]} />);
    const sword = screen.getByTestId("item-sword");
    fireEvent.click(sword);
    fireEvent.click(sword);

    fireEvent.keyDown(sword, { key: "-" });

    expect(items().sword).toBe(1);
    expect(sword.getAttribute("aria-keyshortcuts")?.split(" ")).toContain("-");
  });

  it("ignores the contextmenu a touch long-press fires", () => {
    render(<TrackerGrid itemLayout={[["bow", "sword"]]} />);
    const bow = screen.getByTestId("item-bow");

    fireEvent.pointerDown(bow, { pointerType: "touch" });
    fireEvent.contextMenu(bow);

    expect(items().bow).toBe(0);
  });

  it("steps every boss overlay back too", () => {
    render(<TrackerGrid itemLayout={[["boss8"]]} />);

    fireEvent.contextMenu(screen.getByTestId("medallion-overlay-8"));
    fireEvent.contextMenu(screen.getByTestId("reward-overlay-8"));
    fireEvent.click(screen.getByTestId("chest-overlay-8"));
    fireEvent.contextMenu(screen.getByTestId("chest-overlay-8"));

    expect(useGameStore.getState().medallions[8]).toBe(3);
    expect(items().reward8).toBe(4);
    expect(items().chest8).toBe(2);
    expect(items().boss8).toBe(1);
  });

  it("steps small keys back from zero to the dungeon's maximum", () => {
    act(() => useGameStore.getState().setBigKeysVisible(true));
    render(<TrackerGrid itemLayout={[["bigkey3"]]} />);

    fireEvent.contextMenu(screen.getByTestId("small-key-3"));

    expect(useGameStore.getState().smallKeys[3]).toBe(6);
  });

  it("never nests a button inside another", () => {
    render(<TrackerGrid itemLayout={[["boss8", "bow"]]} />);

    expect(document.querySelectorAll("button button")).toHaveLength(0);
    expect(
      screen.getByTestId("item-boss8").closest("fieldset"),
    ).toHaveAccessibleName("Misery Mire");
  });
});
