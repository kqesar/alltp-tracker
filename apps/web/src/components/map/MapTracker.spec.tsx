import { MARKED_DUNGEONS, MARKERS } from "@alltp/pack-alttpr";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MapTracker } from "@/components/map/MapTracker";
import { useGameStore } from "@/stores/gameStore";

const LOCATION_MARKERS = MARKERS.filter((marker) => !marker.dungeon);

describe("MapTracker", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("draws the pack's markers: one per location, a boss and a square per dungeon", () => {
    render(<MapTracker />);

    expect(screen.getAllByTestId(/^marker-/)).toHaveLength(
      LOCATION_MARKERS.length,
    );
    expect(screen.getAllByTestId(/^boss-marker-/)).toHaveLength(
      MARKED_DUNGEONS.length,
    );
    expect(screen.getAllByTestId(/^dungeon-marker-/)).toHaveLength(
      MARKED_DUNGEONS.length,
    );
    // The three places the old map lacked
    for (const id of ["marker-waterfall-fairy", "boss-marker-castle-tower"]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
    expect(screen.getByTestId("boss-marker-ganons-tower")).toBeInTheDocument();
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
    const kingsTomb = screen.getByTestId("marker-kings-tomb");

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
      state.handleItemClick("lantern");
    });
    render(<MapTracker />);

    expect(screen.getByTestId("boss-marker-eastern-palace")).toHaveClass(
      "available",
    );
  });

  it("demands the big key in keysanity, then the map and compass it may hold", () => {
    act(() => {
      const state = useGameStore.getState();
      state.applyPreset("keysanity");
      state.setBigKeysVisible(false);
      state.handleItemClick("bow");
      state.handleItemClick("bow");
      state.handleItemClick("lantern");
    });
    render(<MapTracker />);
    const boss = screen.getByTestId("boss-marker-eastern-palace");

    expect(boss).toHaveClass("unavailable");

    act(() => useGameStore.getState().handleItemClick("bigkey0"));

    // Wild maps and compasses: the boss wants both, unless it holds one
    // (EasternPalace.php:90-91), which the tracker cannot know
    expect(boss).toHaveClass("possible");
  });

  it("checks every location of a marker when it is clicked", () => {
    render(<MapTracker />);

    fireEvent.click(screen.getByTestId("marker-kakariko-well"));

    expect(screen.getByTestId("marker-kakariko-well")).toHaveClass("opened");
    expect(Object.keys(useGameStore.getState().checked)).toHaveLength(5);
  });

  it("marks a boss beaten, Agahnim's for his towers", () => {
    render(<MapTracker />);

    fireEvent.click(screen.getByTestId("boss-marker-eastern-palace"));
    fireEvent.click(screen.getByTestId("boss-marker-castle-tower"));
    fireEvent.click(screen.getByTestId("boss-marker-ganons-tower"));

    expect(useGameStore.getState().items).toMatchObject({
      agahnim: 1,
      agahnim2: 1,
      boss0: 2,
    });
    expect(screen.getByTestId("boss-marker-ganons-tower")).toHaveClass(
      "opened",
    );
  });

  it("shows a dungeon's square by its counter, done once counted down", () => {
    render(<MapTracker />);
    const square = screen.getByTestId("dungeon-marker-eastern-palace");

    expect(square).toHaveClass("possible");

    act(() => {
      for (let item = 0; item < 3; item++) {
        useGameStore.getState().handleItemClick("chest0");
      }
    });

    expect(square).toHaveClass("opened");
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
    expect(light.getByTestId("boss-marker-eastern-palace")).toBeInTheDocument();
    expect(
      dark.getByTestId("boss-marker-palace-of-darkness"),
    ).toBeInTheDocument();
    expect(dark.getByTestId("boss-marker-ganons-tower")).toBeInTheDocument();
    expect(
      light.queryAllByTestId(/^marker-/).length +
        dark.queryAllByTestId(/^marker-/).length,
    ).toBe(LOCATION_MARKERS.length);
  });

  it("makes every marker and boss a button named by its place and state", () => {
    render(<MapTracker />);

    const kingsTomb = screen.getByTestId("marker-kings-tomb");
    expect(kingsTomb.tagName).toBe("BUTTON");
    expect(kingsTomb).toHaveAccessibleName("King's Tomb: out of logic");
    expect(kingsTomb).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("marker-kakariko-well")).toHaveAccessibleName(
      "Kakariko Well (5 checks): available",
    );

    expect(
      screen.getByTestId("boss-marker-eastern-palace"),
    ).toHaveAccessibleName(
      "Eastern Palace: boss out of logic, 3 chests left (maybe available)",
    );
    expect(screen.getByTestId("boss-marker-misery-mire")).toHaveAccessibleName(
      /^Misery Mire, unknown medallion: boss out of logic/,
    );
    expect(screen.getByTestId("boss-marker-castle-tower")).toHaveAccessibleName(
      "Castle Tower: boss out of logic, no item to find",
    );
  });

  it("keeps the dungeon square out of the accessibility tree", () => {
    render(<MapTracker />);

    expect(screen.getByTestId("dungeon-marker-eastern-palace")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("toggles a marker from the keyboard like any button", async () => {
    const user = userEvent.setup();
    render(<MapTracker />);
    const kingsTomb = screen.getByTestId("marker-kings-tomb");

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
