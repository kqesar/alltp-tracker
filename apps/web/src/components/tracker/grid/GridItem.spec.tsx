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

  it("disables the blank slot", () => {
    render(<GridItem col={0} item="blank" row={0} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/Empty slot, empty/);
  });
});
