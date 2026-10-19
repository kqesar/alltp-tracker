import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { GridItem } from "@/games/alttpr/components/tracker/grid/GridItem";
import { getPreset } from "@/games/alttpr/data/presets";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

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

    render(<GridItem col={5} item="keys3" row={2} />);

    expect(screen.getByTestId("big-key-3")).toHaveAccessibleName(
      "Palace of Darkness big key: not obtained",
    );
    expect(screen.getByTestId("small-key-3")).toHaveAccessibleName(
      "Palace of Darkness small keys: 0 of 6",
    );
  });

  it("gives Eastern Palace, which has no small key, no small key cell", () => {
    useGameStore.getState().setBigKeysVisible(true);

    render(<GridItem col={5} item="keys0" row={2} />);

    expect(screen.getByTestId("big-key-0")).toHaveAccessibleName(
      "Eastern Palace big key: not obtained",
    );
    expect(screen.queryByTestId("small-key-0")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(document.querySelector(".bigkey-count")).toBeNull();
  });

  it("shows a retro run's big keys alone: its small keys are no dungeon's", () => {
    useGameStore.getState().applyPreset("retro");
    useGameStore.getState().setBigKeysVisible(true);

    render(<GridItem col={5} item="keys3" row={2} />);

    expect(screen.getByTestId("big-key-3")).toBeInTheDocument();
    expect(screen.queryByTestId("small-key-3")).toBeNull();
    expect(document.querySelector(".bigkey-count")).toBeNull();
  });

  it("names a retro shop found or not, never obtained", () => {
    render(<GridItem col={0} item="shopkey" row={7} />);
    const shop = screen.getByRole("button");
    expect(shop).toHaveAccessibleName(/^Key shop, not found\./);

    fireEvent.click(shop);
    expect(shop).toHaveAccessibleName(/^Key shop, found\./);
    expect(useGameStore.getState().items.shopkey).toBe(true);
  });

  it("gives each castle dungeon's key cell what its pool holds, in keysanity", () => {
    useGameStore.getState().applyPreset("keysanity");
    const buttonsOf = (item: string) => {
      const { unmount } = render(<GridItem col={1} item={item} row={7} />);
      const ids = screen
        .getAllByRole("button")
        .map((button) => button.dataset.testid);
      unmount();
      return ids;
    };

    // Hyrule Castle: a small key and its map; Castle Tower: two small keys;
    // Ganon's Tower: everything
    expect(buttonsOf("keys10")).toEqual(["map-10", "small-key-10"]);
    expect(buttonsOf("keys11")).toEqual(["small-key-11"]);
    expect(buttonsOf("keys12")).toEqual([
      "map-12",
      "compass-12",
      "small-key-12",
      "big-key-12",
    ]);
    render(<GridItem col={5} item="keys12" row={7} />);
    expect(screen.getByTestId("small-key-12")).toHaveAccessibleName(
      "Ganon's Tower small keys: 0 of 4",
    );
    expect(screen.getByTestId("big-key-12")).toHaveAccessibleName(
      "Ganon's Tower big key: not obtained",
    );
  });

  it("gives Ganon's Tower a boss cell: Agahnim 2 and its items left, no reward", () => {
    render(<GridItem col={6} item="boss12" row={6} />);

    expect(screen.getByRole("group")).toHaveAccessibleName("Ganon's Tower");
    const boss = screen.getByTestId("item-boss12");
    expect(boss).toHaveAccessibleName(
      "Agahnim 2, not defeated. Click to change state.",
    );
    const chests = screen.getByTestId("chest-overlay-12");
    expect(chests).toHaveAccessibleName(
      "Ganon's Tower chests: 20 left, out of logic",
    );
    expect(screen.queryByTestId("reward-overlay-12")).toBeNull();
    expect(screen.queryByTestId("medallion-overlay-12")).toBeNull();

    fireEvent.click(boss);
    fireEvent.click(chests);
    expect(useGameStore.getState().items).toMatchObject({
      agahnim2: 1,
      chest12: 19,
    });
    expect(boss).toHaveAccessibleName(
      "Agahnim 2, defeated. Click to change state.",
    );
  });

  it("names a castle dungeon beside its key cell, while the key cells show", () => {
    const { unmount } = render(<GridItem col={0} item="keylabel10" row={7} />);
    expect(screen.getByTestId("key-label-hyrule-castle")).toHaveClass(
      "grid-spacer",
    );
    expect(screen.getByTestId("key-label-hyrule-castle")).toBeEmptyDOMElement();
    unmount();

    useGameStore.getState().setBigKeysVisible(true);
    render(<GridItem col={2} item="keylabel11" row={7} />);

    const label = screen.getByTestId("key-label-castle-tower");
    expect(label).toHaveTextContent("CT");
    expect(label).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the map and compass whenever they leave their dungeons, from MC Shuffle up", () => {
    useGameStore
      .getState()
      .applyRun("open", { ...getPreset("open").settings, dungeonItems: "mc" });
    // Key cells come on with the maps and compasses
    expect(useGameStore.getState().bigKeysVisible).toBe(true);

    render(<GridItem col={5} item="keys3" row={2} />);

    expect(
      screen.getAllByRole("button").map((button) => button.dataset.testid),
    ).toEqual(["map-3", "compass-3", "small-key-3", "big-key-3"]);
  });

  it("adds the map and compass to a key cell in keysanity only", () => {
    useGameStore.getState().setBigKeysVisible(true);
    const { unmount } = render(<GridItem col={5} item="keys3" row={2} />);
    expect(screen.queryByTestId("map-3")).toBeNull();
    expect(screen.queryByTestId("compass-3")).toBeNull();
    unmount();

    useGameStore.getState().applyPreset("keysanity");
    render(<GridItem col={5} item="keys3" row={2} />);

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

    render(<GridItem col={5} item="keys0" row={2} />);

    expect(
      screen.getAllByRole("button").map((button) => button.dataset.testid),
    ).toEqual(["map-0", "compass-0", "big-key-0"]);
    expect(document.querySelector(".bigkey-count")).toBeNull();
  });

  it("greys a key until it is held, its name telling the same", () => {
    useGameStore.getState().setBigKeysVisible(true);
    render(<GridItem col={5} item="keys3" row={2} />);
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
