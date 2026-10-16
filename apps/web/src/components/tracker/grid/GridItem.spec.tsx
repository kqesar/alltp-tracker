import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { GridItem } from "@/components/tracker/grid/GridItem";
import { useGameStore } from "@/stores/gameStore";

describe("GridItem", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it("renders a spacer for an empty cell", () => {
    const { container } = render(<GridItem col={1} item="" row={0} />);

    expect(container.querySelector(".grid-spacer")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a plain item as a labelled button carrying its position", () => {
    render(<GridItem col={3} item="hookshot" row={2} />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-grid-row", "2");
    expect(button).toHaveAttribute("data-grid-col", "3");
    expect(button).toHaveAccessibleName(/Hookshot, not obtained/);
    expect(button).not.toHaveClass("grid-item-relative");
  });

  it("gives a boss cell its three overlays", () => {
    render(<GridItem col={6} item="boss8" row={5} />);

    // Misery Mire is medallion-gated, so all three overlays are present.
    expect(screen.getByTestId("chest-overlay-8")).toBeInTheDocument();
    expect(screen.getByTestId("reward-overlay-8")).toBeInTheDocument();
    expect(screen.getByTestId("medallion-overlay-8")).toBeInTheDocument();
  });

  it("greys a boss not beaten, as a missing item, never its overlays", () => {
    render(<GridItem col={6} item="boss8" row={5} />);
    const boss = screen.getByTestId("item-boss8");
    const overlays = [
      "chest-overlay-8",
      "reward-overlay-8",
      "medallion-overlay-8",
    ];

    expect(boss).toHaveAccessibleName(/^Vitreous, not defeated\./);
    expect(boss).toHaveClass("griditem--dimmed");
    for (const id of overlays) {
      expect(screen.getByTestId(id)).not.toHaveClass("griditem--dimmed");
    }

    fireEvent.click(boss);

    expect(boss).toHaveAccessibleName(/^Vitreous, defeated\./);
    expect(boss).not.toHaveClass("griditem--dimmed");
  });

  it("omits the medallion overlay for dungeons that are not gated", () => {
    render(<GridItem col={0} item="boss0" row={0} />);

    expect(screen.getByTestId("chest-overlay-0")).toBeInTheDocument();
    expect(screen.queryByTestId("medallion-overlay-0")).toBeNull();
  });

  it("routes a big key to the keysanity cell", () => {
    useGameStore.getState().setBigKeysVisible(true);

    render(<GridItem col={5} item="bigkey3" row={2} />);

    expect(screen.getByTestId("big-key-3")).toHaveAccessibleName(
      "Palace of Darkness big key: not obtained",
    );
    expect(screen.getByTestId("small-key-3")).toHaveAccessibleName(
      "Palace of Darkness small keys: 0 of 6",
    );
  });

  it("gives Eastern Palace, which has no small key, no small key cell", () => {
    useGameStore.getState().setBigKeysVisible(true);

    render(<GridItem col={5} item="bigkey0" row={2} />);

    expect(screen.getByTestId("big-key-0")).toHaveAccessibleName(
      "Eastern Palace big key: not obtained",
    );
    expect(screen.queryByTestId("small-key-0")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(document.querySelector(".bigkey-count")).toBeNull();
  });

  it("adds the map and compass to a key cell in keysanity only", () => {
    useGameStore.getState().setBigKeysVisible(true);
    const { unmount } = render(<GridItem col={5} item="bigkey3" row={2} />);
    expect(screen.queryByTestId("map-3")).toBeNull();
    expect(screen.queryByTestId("compass-3")).toBeNull();
    unmount();

    useGameStore.getState().applyPreset("keysanity");
    render(<GridItem col={5} item="bigkey3" row={2} />);

    // Map and compass on top, the small key and the big key below
    expect(
      screen.getAllByRole("button").map((button) => button.dataset.testid),
    ).toEqual(["map-3", "compass-3", "small-key-3", "big-key-3"]);
    const map = screen.getByTestId("map-3");
    const compass = screen.getByTestId("compass-3");
    expect(map).toHaveAccessibleName("Palace of Darkness map: not obtained");
    expect(compass).toHaveAccessibleName(
      "Palace of Darkness compass: not obtained",
    );
    expect(map).toHaveClass("griditem--dimmed");
    expect(compass).toHaveClass("griditem--dimmed");
    // The small keys' count rides on the key, out of the accessibility tree
    expect(document.querySelector(".bigkey-count--badge")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    fireEvent.click(map);
    fireEvent.click(compass);

    expect(map).toHaveAccessibleName("Palace of Darkness map: obtained");
    expect(compass).toHaveAccessibleName(
      "Palace of Darkness compass: obtained",
    );
    expect(map).not.toHaveClass("griditem--dimmed");
    expect(compass).not.toHaveClass("griditem--dimmed");
    expect(useGameStore.getState().items).toMatchObject({
      compass3: 1,
      map3: 1,
    });
  });

  it("gives Eastern Palace a map and compass but no small key in keysanity", () => {
    useGameStore.getState().applyPreset("keysanity");

    render(<GridItem col={5} item="bigkey0" row={2} />);

    expect(
      screen.getAllByRole("button").map((button) => button.dataset.testid),
    ).toEqual(["map-0", "compass-0", "big-key-0"]);
    expect(document.querySelector(".bigkey-count")).toBeNull();
  });

  it("greys a key until it is held, its name telling the same", () => {
    useGameStore.getState().setBigKeysVisible(true);
    render(<GridItem col={5} item="bigkey3" row={2} />);
    const bigKey = screen.getByTestId("big-key-3");
    const smallKey = screen.getByTestId("small-key-3");
    expect(bigKey).toHaveClass("griditem--dimmed");
    expect(smallKey).toHaveClass("griditem--dimmed");

    fireEvent.click(bigKey);
    fireEvent.click(smallKey);

    expect(bigKey).toHaveAccessibleName("Palace of Darkness big key: obtained");
    expect(bigKey).not.toHaveClass("griditem--dimmed");
    expect(smallKey).toHaveAccessibleName(
      "Palace of Darkness small keys: 1 of 6",
    );
    expect(smallKey).not.toHaveClass("griditem--dimmed");
  });

  it("disables the blank slot", () => {
    render(<GridItem col={0} item="blank" row={0} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/Empty slot, empty/);
  });
});
