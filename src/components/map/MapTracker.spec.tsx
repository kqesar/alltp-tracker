import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { chests } from "@/data/chests";
import { dungeons } from "@/data/dungeons";
import { useGameStore } from "@/stores/gameStore";

describe("MapTracker", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("draws one marker per chest, and a boss and a chest marker per dungeon", () => {
    render(<MapTracker />);

    expect(screen.getAllByTestId(/^chest-marker-/)).toHaveLength(chests.length);
    expect(screen.getAllByTestId(/^boss-marker-/)).toHaveLength(
      dungeons.length,
    );
    expect(screen.getAllByTestId(/^dungeon-marker-/)).toHaveLength(
      dungeons.length,
    );
  });

  it("renders without React warnings such as duplicate keys", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<MapTracker />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("recolours markers when the items held change", () => {
    render(<MapTracker />);
    // King's Tomb needs boots and either Titan's Mitt or the Dark World route
    const kingsTomb = screen.getByTestId("chest-marker-0");

    expect(kingsTomb).toHaveClass("unavailable");

    act(() => {
      const { handleItemClick } = useGameStore.getState();
      handleItemClick("boots");
      handleItemClick("glove");
      handleItemClick("glove");
    });

    expect(kingsTomb).toHaveClass("available");
  });

  it("does not demand big keys outside keysanity, even while they are displayed", () => {
    act(() => {
      const state = useGameStore.getState();
      state.setBigKeysVisible(true);
      state.handleItemClick("bow");
      state.handleItemClick("bow");
    });
    render(<MapTracker />);

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("available");
  });

  it("demands the big key in keysanity, even while key cells are hidden", () => {
    act(() => {
      const state = useGameStore.getState();
      state.applyPreset("keysanity");
      state.setBigKeysVisible(false);
      state.handleItemClick("bow");
      state.handleItemClick("bow");
    });
    render(<MapTracker />);

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("unavailable");

    act(() => useGameStore.getState().handleItemClick("bigkey0"));

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("available");
  });

  it("marks a chest opened when it is clicked", () => {
    render(<MapTracker />);

    fireEvent.click(screen.getByTestId("chest-marker-0"));

    expect(screen.getByTestId("chest-marker-0")).toHaveClass("opened");
    expect(useGameStore.getState().chestsOpened[0]).toBe(true);
  });
});

describe("MapTracker worlds and markers", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("splits the markers between a Light World and a Dark World", () => {
    render(<MapTracker />);
    const light = within(screen.getByTestId("map-world-light"));
    const dark = within(screen.getByTestId("map-world-dark"));

    expect(screen.getByTestId("map-world-light")).toHaveAccessibleName(
      "Light World",
    );
    // Eastern Palace lies in the Light World, Palace of Darkness in the Dark
    expect(light.getByTestId("boss-marker-0")).toBeInTheDocument();
    expect(dark.getByTestId("boss-marker-3")).toBeInTheDocument();
    expect(
      light.queryAllByTestId(/^chest-marker-/).length +
        dark.queryAllByTestId(/^chest-marker-/).length,
    ).toBe(chests.length);
  });

  it("makes every chest and boss a button named by its place and state", () => {
    render(<MapTracker />);

    const kingsTomb = screen.getByTestId("chest-marker-0");
    expect(kingsTomb.tagName).toBe("BUTTON");
    expect(kingsTomb).toHaveAccessibleName(
      "King's Tomb Pegasus Boots + Titan's Mitt/Magic Mirror: out of logic",
    );
    expect(kingsTomb).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByTestId("boss-marker-0")).toHaveAccessibleName(
      /^Eastern Palace Bow: boss out of logic, 3 chests left \(maybe available\)$/,
    );
  });

  it("keeps the dungeon square out of the accessibility tree", () => {
    render(<MapTracker />);

    expect(screen.getByTestId("dungeon-marker-0")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("toggles a chest from the keyboard like any button", async () => {
    const user = userEvent.setup();
    render(<MapTracker />);
    const kingsTomb = screen.getByTestId("chest-marker-0");

    kingsTomb.focus();
    await user.keyboard("{Enter}");

    expect(kingsTomb).toHaveAttribute("aria-pressed", "true");
    expect(kingsTomb).toHaveAccessibleName(/: done$/);
  });

  it("follows the chosen map layout", () => {
    act(() => useGameStore.getState().setMapLayout("stacked"));
    render(<MapTracker />);

    expect(screen.getByTestId("map-tracker")).toHaveClass(
      "map-worlds--stacked",
    );
  });
});
