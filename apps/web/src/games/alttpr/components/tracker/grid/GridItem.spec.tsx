import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("gives the tunic's cell the hearts, not set until counted", () => {
    render(<GridItem col={4} item="tunic" row={1} />);

    expect(screen.getByRole("group")).toHaveAccessibleName("Mail and hearts");
    expect(screen.getByTestId("item-tunic")).toBeInTheDocument();
    const hearts = screen.getByTestId("hearts-overlay");
    expect(hearts).toHaveAccessibleName(/^Hearts: not set\./);
    expect(hearts).toHaveTextContent("?");
    expect(hearts).toHaveClass("griditem--dimmed");
    expect(hearts).toHaveAttribute("data-grid-slot", "1");

    const icon = () => hearts.style.backgroundImage;
    // A click counts the 3 hearts every run starts with, the next a quarter
    fireEvent.click(hearts);
    expect(hearts).toHaveAccessibleName(/^Hearts: 3\./);
    expect(hearts).toHaveTextContent("3");
    expect(hearts).not.toHaveClass("griditem--dimmed");
    expect(icon()).toMatch(/heart0\.png/);
    fireEvent.click(hearts);
    expect(hearts).toHaveAccessibleName(/^Hearts: 3 and 1 quarter\./);
    expect(icon()).toMatch(/heart1\.png/);
    fireEvent.click(hearts);
    fireEvent.click(hearts);
    expect(hearts).toHaveAccessibleName(/^Hearts: 3 and 3 quarters\./);
    expect(hearts).toHaveTextContent("3");
    expect(icon()).toMatch(/heart3\.png/);
    // The fourth piece makes a heart, as in the game
    fireEvent.click(hearts);
    expect(useGameStore.getState().items).toMatchObject({
      heartquarters: 0,
      hearts: 2,
    });
    expect(hearts).toHaveAccessibleName(/^Hearts: 4\./);
    expect(hearts).toHaveTextContent("4");
    // Back a quarter at a time, past 3: not set again, never round to 20
    fireEvent.contextMenu(hearts);
    expect(hearts).toHaveAccessibleName(/^Hearts: 3 and 3 quarters\./);
    for (let i = 0; i < 4; i++) fireEvent.contextMenu(hearts);
    expect(hearts).toHaveTextContent("?");
    fireEvent.contextMenu(hearts);
    expect(hearts).toHaveTextContent("?");
    expect(useGameStore.getState().items.hearts).toBe(0);
    // Nor past 20 round to not set, nor to a quarter more
    act(() => useGameStore.getState().setItem("hearts", 17));
    for (let i = 0; i < 5; i++) fireEvent.click(hearts);
    expect(hearts).toHaveTextContent("20");
    expect(hearts).toHaveAccessibleName(/^Hearts: 20\./);
    expect(useGameStore.getState().items.heartquarters).toBe(0);
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

  it("names a boss cell for the boss the run knows, else for its dungeon", () => {
    render(<GridItem col={0} item="boss6" row={0} />);
    const cell = screen.getByTestId("item-boss6");
    expect(cell).toHaveAccessibleName(/^Blind the Thief, not defeated\./);

    act(() => useGameStore.getState().updateSettings({ bossShuffle: "full" }));
    expect(cell).toHaveAccessibleName(/^Thieves' Town boss, not defeated\./);

    fireEvent.click(screen.getByTestId("known-boss-overlay-6"));
    expect(cell).toHaveAccessibleName(/^Armos Knights, not defeated\./);
  });

  it("omits the medallion overlay for dungeons that are not gated", () => {
    render(<GridItem col={0} item="boss0" row={0} />);

    expect(screen.getByTestId("chest-overlay-0")).toBeInTheDocument();
    expect(screen.queryByTestId("medallion-overlay-0")).toBeNull();
  });

  it("gives the dungeon's name's corner to the boss's marker while bosses may move", () => {
    render(
      <>
        <GridItem col={0} item="boss8" row={5} />
        <GridItem col={1} item="boss12" row={5} />
      </>,
    );
    expect(screen.getByTestId("boss-name-8")).toHaveTextContent("MM");

    act(() => useGameStore.getState().updateSettings({ bossShuffle: "full" }));
    expect(screen.queryByTestId("boss-name-8")).toBeNull();
    expect(screen.getByTestId("known-boss-overlay-8")).toBeInTheDocument();
    // Ganon's Tower has no marker: its name stays
    expect(screen.getByTestId("boss-name-12")).toHaveTextContent("GT");
  });

  it("lets the player mark a dungeon's boss while the run's bosses may move", () => {
    render(<GridItem col={0} item="boss8" row={5} />);
    expect(screen.queryByTestId("known-boss-overlay-8")).toBeNull();

    act(() => useGameStore.getState().updateSettings({ bossShuffle: "full" }));
    const known = screen.getByTestId("known-boss-overlay-8");
    expect(known).toHaveAccessibleName("Misery Mire boss: unknown");
    expect(known).toHaveAttribute("data-grid-slot", "1");
    expect(screen.getByTestId("medallion-overlay-8")).toHaveAttribute(
      "data-grid-slot",
      "2",
    );
    fireEvent.click(known);
    expect(known).toHaveAccessibleName("Misery Mire boss: Armos Knights");
    expect(known.style.backgroundImage).toMatch(/boss02\.png/);
    fireEvent.contextMenu(known);
    fireEvent.contextMenu(known);
    expect(known).toHaveAccessibleName("Misery Mire boss: Trinexx");
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
    // Its short name tells its Agahnim from Castle Tower's, for the eye only
    const name = screen.getByTestId("boss-name-12");
    expect(name).toHaveTextContent("GT");
    expect(name).toHaveAttribute("aria-hidden", "true");

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

  it("toggles the half magic, which a quarter magic from the game shows as the half", () => {
    render(<GridItem col={5} item="magic" row={1} />);
    const cell = screen.getByTestId("item-magic");
    expect(cell).toHaveAccessibleName(
      "Half Magic, not obtained. Click to change state.",
    );
    expect(cell).toHaveClass("griditem--dimmed");

    fireEvent.click(cell);
    expect(useGameStore.getState().items.magic).toBe(1);
    expect(cell).toHaveAccessibleName(
      "Half Magic, obtained. Click to change state.",
    );
    expect(cell).not.toHaveClass("griditem--dimmed");
    expect(cell.style.backgroundImage).toContain("magic.png");

    fireEvent.click(cell);
    expect(useGameStore.getState().items.magic).toBe(0);

    // The game says quarter magic: the board keeps it for the logic, and
    // shows the half; a click (either way) takes it off
    act(() => useGameStore.getState().setItem("magic", 2));
    expect(cell).toHaveAccessibleName(
      "Half Magic, obtained. Click to change state.",
    );
    expect(cell.style.backgroundImage).toContain("magic.png");
    fireEvent.contextMenu(cell);
    expect(useGameStore.getState().items.magic).toBe(0);
    fireEvent.contextMenu(cell);
    expect(useGameStore.getState().items.magic).toBe(1);
  });

  it("names Agahnim, Castle Tower's boss, as before", () => {
    render(<GridItem col={2} item="agahnim" row={7} />);

    const cell = screen.getByTestId("item-agahnim");
    expect(cell).toHaveAccessibleName(
      "Agahnim, not obtained. Click to change state.",
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
    render(<GridItem col={4} item="keylabel12" row={7} />);

    const label = screen.getByTestId("key-label-ganons-tower");
    expect(label).toHaveTextContent("GT");
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

  it("counts a triforce hunt's pieces found over the pieces asked for", () => {
    render(<GridItem col={3} item="triforce" row={8} />);

    const cell = screen.getByTestId("item-triforce");
    expect(cell).toHaveAccessibleName(
      "Triforce pieces: 0/20. Click to add a piece.",
    );
    expect(cell).toHaveTextContent("0/20");
    expect(cell).toHaveClass("griditem--dimmed");

    fireEvent.click(cell);
    expect(useGameStore.getState().items.triforce).toBe(1);
    expect(cell).toHaveAccessibleName(/^Triforce pieces: 1\/20\./);
    expect(cell).toHaveTextContent("1/20");
    expect(cell).not.toHaveClass("griditem--dimmed");
    expect(cell).not.toHaveClass("pieces-cell--enough");

    act(() => {
      useGameStore.setState({
        items: { ...useGameStore.getState().items, triforce: 20 },
      });
    });
    expect(cell).toHaveClass("pieces-cell--enough");

    // A seed that asks for more
    act(() => {
      useGameStore.setState({
        items: { ...useGameStore.getState().items, goalpieces: 25 },
      });
    });
    expect(cell).toHaveTextContent("20/25");
    expect(cell).not.toHaveClass("pieces-cell--enough");
  });

  it("stops the pieces at none and at the most a goal holds, never wrapping", () => {
    render(<GridItem col={3} item="triforce" row={8} />);
    const cell = screen.getByTestId("item-triforce");

    fireEvent.contextMenu(cell);
    expect(useGameStore.getState().items.triforce).toBe(0);
    expect(useGameStore.getState().past).toHaveLength(0);

    act(() => {
      useGameStore.setState({
        items: { ...useGameStore.getState().items, triforce: 50 },
      });
    });
    fireEvent.click(cell);
    expect(useGameStore.getState().items.triforce).toBe(50);
    fireEvent.contextMenu(cell);
    expect(useGameStore.getState().items.triforce).toBe(49);
  });

  it("disables the blank slot", () => {
    render(<GridItem col={0} item="blank" row={0} />);

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/Empty slot, empty/);
  });
});

describe("the bottles' cells", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  const bottles = () =>
    render(
      <>
        {[1, 2, 3, 4].map((slot) => (
          <GridItem
            col={slot}
            item={`bottlecontents${slot}`}
            key={slot}
            row={4}
          />
        ))}
      </>,
    );

  it("greys a bottle not found, and finds the bottles up to the one clicked", () => {
    bottles();
    const third = screen.getByTestId("item-bottlecontents3");
    expect(third).toHaveAccessibleName("Bottle 3, not found. Click to change.");
    expect(third).toHaveClass("griditem--dimmed");

    fireEvent.click(third);
    expect(useGameStore.getState().items).toMatchObject({
      bottle: 3,
      bottlecontents3: 0,
    });
    expect(screen.getByTestId("item-bottlecontents1")).toHaveAccessibleName(
      "Bottle 1, empty. Click to change.",
    );
    expect(third).not.toHaveClass("griditem--dimmed");
    expect(third.style.backgroundImage).toContain("bottle-empty.png");
  });

  it("steps what a bottle holds, round to empty, and back until it goes", () => {
    act(() => useGameStore.getState().setItem("bottle", 1));
    bottles();
    const first = screen.getByTestId("item-bottlecontents1");

    fireEvent.click(first);
    expect(first).toHaveAccessibleName(
      "Bottle 1, red potion. Click to change.",
    );
    expect(first.style.backgroundImage).toContain("bottle-red.png");
    for (let step = 0; step < 4; step++) fireEvent.click(first);
    expect(first).toHaveAccessibleName("Bottle 1, a bee. Click to change.");
    fireEvent.click(first);
    fireEvent.click(first);
    // The mushroom, which the game's menu draws in a bottle too, last
    expect(first).toHaveAccessibleName(
      "Bottle 1, a mushroom. Click to change.",
    );
    expect(first.style.backgroundImage).toContain("bottle-mushroom.png");
    fireEvent.click(first);
    expect(first).toHaveAccessibleName("Bottle 1, empty. Click to change.");

    // Back: the content before, and from empty the bottle goes
    fireEvent.click(first);
    fireEvent.contextMenu(first);
    expect(first).toHaveAccessibleName("Bottle 1, empty. Click to change.");
    fireEvent.contextMenu(first);
    expect(useGameStore.getState().items.bottle).toBe(0);
    expect(first).toHaveAccessibleName("Bottle 1, not found. Click to change.");
  });

  it("reads a save made before the contents as that many empty bottles", () => {
    const { bottlecontents2: _, ...before } = useGameStore.getState().items;
    act(() =>
      useGameStore.getState().loadProgress({ items: { ...before, bottle: 2 } }),
    );
    bottles();
    expect(screen.getByTestId("item-bottlecontents2")).toHaveAccessibleName(
      "Bottle 2, empty. Click to change.",
    );
    expect(screen.getByTestId("item-bottlecontents3")).toHaveAccessibleName(
      "Bottle 3, not found. Click to change.",
    );
  });

  it("finds bottles empty past a count lowered without clearing them", () => {
    // A count set straight (a save, a link, a reading) over stale contents
    act(() =>
      useGameStore.setState((state) => ({
        items: {
          ...state.items,
          bottle: 1,
          bottlecontents2: 3,
          bottlecontents3: 5,
        },
      })),
    );
    bottles();
    expect(screen.getByTestId("item-bottlecontents2")).toHaveAccessibleName(
      "Bottle 2, not found. Click to change.",
    );
    fireEvent.click(screen.getByTestId("item-bottlecontents3"));
    expect(useGameStore.getState().items).toMatchObject({
      bottle: 3,
      bottlecontents2: 0,
      bottlecontents3: 0,
    });
    expect(screen.getByTestId("item-bottlecontents2")).toHaveAccessibleName(
      "Bottle 2, empty. Click to change.",
    );
  });

  it("forgets what the bottles beyond a lower count held", () => {
    act(() => {
      useGameStore.getState().setItem("bottle", 2);
      useGameStore.getState().setItem("bottlecontents2", 4);
      useGameStore.getState().handleItemClick("bottle", -1);
    });
    expect(useGameStore.getState().items).toMatchObject({
      bottle: 1,
      bottlecontents2: 0,
    });
  });
});

describe("the capacities' cells", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it("counts the bombs Link can hold, 5 a click, green at 50", () => {
    render(<GridItem col={0} item="bombcapacity" row={4} />);
    const bombs = screen.getByTestId("item-bombcapacity");
    expect(bombs).toHaveAccessibleName(
      "Bombs, capacity 10. Click to add an upgrade.",
    );
    expect(bombs).toHaveTextContent("10");
    expect(bombs.style.backgroundImage).toContain("bomb.png");

    for (let step = 0; step < 8; step++) fireEvent.click(bombs);
    expect(bombs).toHaveTextContent("50");
    expect(bombs.querySelector(".cell-count")).toHaveClass("cell-count--most");
    fireEvent.click(bombs);
    expect(useGameStore.getState().items.bombcapacity).toBe(10);
  });

  it("gives the bow's cell the arrows Link can hold, beside the bow", () => {
    render(<GridItem col={0} item="bow" row={1} />);
    expect(screen.getByRole("group")).toHaveAccessibleName("Bow and arrows");
    expect(screen.getByTestId("item-bow")).toBeInTheDocument();
    const arrows = screen.getByTestId("item-arrowcapacity");
    expect(arrows).toHaveAccessibleName(
      "Arrow capacity 30. Click to add an upgrade.",
    );
    expect(arrows).toHaveAttribute("data-grid-slot", "1");

    fireEvent.click(arrows);
    expect(arrows).toHaveTextContent("35");
    fireEvent.contextMenu(arrows);
    fireEvent.contextMenu(arrows);
    expect(useGameStore.getState().items.arrowcapacity).toBe(70);
  });
});

describe("the crystals' cells", () => {
  beforeEach(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
  });

  it("says what Ganon's Tower and Ganon ask for, and steps the run's setting", () => {
    render(
      <>
        <GridItem col={5} item="goaltower" row={4} />
        <GridItem col={6} item="goalganon" row={4} />
      </>,
    );
    const tower = screen.getByTestId("goal-goaltower");
    expect(tower).toHaveAccessibleName(
      "GT 7: Ganon's Tower asks for 7 crystals, you hold 0. Click to change.",
    );
    expect(tower).toHaveTextContent("GT 7");

    fireEvent.click(tower);
    expect(useGameStore.getState().settings.crystalsTower).toBe(0);
    expect(tower).toHaveClass("goal-cell--reached");
    // One undo step, as a change in Mode is
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().settings.crystalsTower).toBe(7);

    fireEvent.contextMenu(screen.getByTestId("goal-goalganon"));
    expect(useGameStore.getState().settings.crystalsGanon).toBe(6);
  });

  it("greys Ganon's crystals when the goal is the pedestal or the pieces", () => {
    act(() => useGameStore.getState().applyPreset("triforce-hunt"));
    render(<GridItem col={6} item="goalganon" row={4} />);
    const ganon = screen.getByTestId("goal-goalganon");
    expect(ganon).toHaveClass("goal-cell--moot");
    expect(ganon).not.toHaveClass("goal-cell--reached");
    expect(ganon).toHaveAccessibleName(
      "Ganon 7: Ganon is not this run's goal. Click to change.",
    );
  });

  it("asks a Mystery run's player, from none up", () => {
    act(() => useGameStore.getState().applyPreset("mystery"));
    render(<GridItem col={5} item="goaltower" row={4} />);
    const tower = screen.getByTestId("goal-goaltower");
    expect(tower).toHaveTextContent("GT ?");
    expect(tower).toHaveAccessibleName(
      "GT ?: Ganon's Tower's crystals not known yet. Click to set them.",
    );

    fireEvent.click(tower);
    expect(useGameStore.getState().settings.crystalsTower).toBe(0);
    expect(useGameStore.getState().settings.hidden).not.toContain(
      "crystalsTower",
    );
  });

  it("counts the pendants and crystals the beaten bosses gave", () => {
    act(() =>
      useGameStore.setState((state) => ({
        items: {
          ...state.items,
          boss0: 2,
          boss3: 2,
          boss4: 2,
          reward0: 1,
          reward3: 3,
          reward4: 4,
        },
      })),
    );
    render(
      <>
        <GridItem col={5} item="pendants" row={5} />
        <GridItem col={6} item="crystals" row={5} />
      </>,
    );
    expect(screen.getByTestId("prize-pendants")).toHaveAccessibleName(
      "Pendants held: 1 of 3",
    );
    const crystals = screen.getByTestId("prize-crystals");
    expect(crystals).toHaveAccessibleName("Crystals held: 2 of 7");
    expect(crystals).toHaveTextContent("2/7");
    // They only show: no control to step
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the dungeons' names", () => {
  it("names every dungeon in its cell's corner, and Castle Tower over Agahnim", () => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    const names = [
      "EP",
      "DP",
      "ToH",
      "PoD",
      "SP",
      "SW",
      "TT",
      "IP",
      "MM",
      "TR",
    ];
    render(
      <>
        {names.map((_, index) => (
          <GridItem
            col={index}
            item={`boss${index}`}
            // biome-ignore lint/suspicious/noArrayIndexKey: one cell a dungeon
            key={index}
            row={5}
          />
        ))}
        <GridItem col={3} item="agahnim" row={5} />
      </>,
    );
    names.forEach((name, index) => {
      const label = screen.getByTestId(`boss-name-${index}`);
      expect(label).toHaveTextContent(name);
      expect(label).toHaveAttribute("aria-hidden", "true");
    });
    const castle = screen.getByTestId("item-agahnim").parentElement;
    expect(castle).toHaveTextContent("CT");
  });
});
