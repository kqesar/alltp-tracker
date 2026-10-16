import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { useGameStore } from "@/stores/gameStore";

/** Overworld chest markers currently drawn with the given state class. */
const chestMarkers = (state: string) =>
  screen
    .getAllByTestId(/^chest-marker-/)
    .filter((marker) => marker.classList.contains(state));

const HINT = "Hover an item or a map location to see its details here.";

// The whole application, real map included, driven the way a player does.
describe("App Integration Tests", () => {
  beforeEach(() => {
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("turns map markers reachable when an item unlocks them", () => {
    render(<App />);
    const reachableBefore = chestMarkers("available").length;

    fireEvent.click(screen.getByTestId("item-boots"));

    expect(chestMarkers("available").length).toBeGreaterThan(reachableBefore);
  });

  it("shows a marker's details while it is hovered", () => {
    render(<App />);
    const marker = screen.getByTestId("boss-marker-0");

    expect(screen.getByTestId("caption")).toHaveTextContent(HINT);

    fireEvent.mouseOver(marker);
    expect(screen.getByTestId("caption")).toHaveTextContent(/Eastern Palace/);

    fireEvent.mouseOut(marker);
    expect(screen.getByTestId("caption")).toHaveTextContent(HINT);
  });

  it("marks an overworld chest opened and back when clicked", () => {
    render(<App />);
    const chest = screen.getByTestId("chest-marker-0");

    fireEvent.click(chest);
    expect(chest).toHaveClass("opened");

    fireEvent.click(chest);
    expect(chest).not.toHaveClass("opened");
  });

  it("greys a dungeon on the map once its boss is beaten in the grid", () => {
    render(<App />);

    expect(screen.getByTestId("boss-marker-0")).not.toHaveClass("opened");

    fireEvent.click(screen.getByTestId("item-boss0"));

    expect(screen.getByTestId("boss-marker-0")).toHaveClass("opened");
  });

  it("marks the grid boss beaten when its map marker is clicked, and back", () => {
    render(<App />);

    fireEvent.click(screen.getByTestId("boss-marker-3"));
    expect(screen.getByTestId("item-boss3")).toHaveAccessibleName(
      /^Helmasaur King, defeated\./,
    );
    expect(screen.getByTestId("boss-marker-3")).toHaveClass("opened");

    fireEvent.click(screen.getByTestId("boss-marker-3"));
    expect(screen.getByTestId("item-boss3")).toHaveAccessibleName(
      /^Helmasaur King, not defeated\./,
    );
    expect(screen.getByTestId("boss-marker-3")).not.toHaveClass("opened");
  });

  it("reaches Tower of Hera's boss once the route and light are held", () => {
    render(<App />);
    expect(screen.getByTestId("boss-marker-2")).toHaveClass("unavailable");

    fireEvent.click(screen.getByTestId("item-flute"));
    fireEvent.click(screen.getByTestId("item-mirror"));
    fireEvent.click(screen.getByTestId("item-lantern"));

    expect(screen.getByTestId("boss-marker-2")).toHaveClass("available");
  });
});
