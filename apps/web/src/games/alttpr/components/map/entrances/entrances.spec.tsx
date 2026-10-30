import { MARKERS } from "@alltp/pack-alttpr";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import EntranceLayer from "@/games/alttpr/components/map/entrances/EntranceLayer";
import EntrancePicker from "@/games/alttpr/components/map/entrances/EntrancePicker";
import EntrancesPanel from "@/games/alttpr/components/map/entrances/EntrancesPanel";
import { getPreset } from "@/games/alttpr/data/presets";
import { useEntrancePicker } from "@/games/alttpr/stores/entrancePickerStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

describe("the entrance assistant", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useEntrancePicker.setState({ linked: null, picking: null });
    });
  });

  it("draws no entrance where none is shuffled", () => {
    render(<EntranceLayer markers={MARKERS} world="light" />);
    expect(screen.queryAllByTestId(/^entrance-/)).toHaveLength(0);
  });

  it("draws a world's shuffled entrances, and opens the picker on one", async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().applyPreset("crosskeys"));
    render(
      <>
        <EntranceLayer markers={MARKERS} world="light" />
        <EntrancePicker />
      </>,
    );
    const shop = screen.getByTestId("entrance-kakariko-shop");
    expect(shop).toHaveAccessibleName("Kakariko Shop: not known yet");
    // The Dark World's are in the other half
    expect(screen.queryByTestId("entrance-big-bomb-shop")).toBeNull();

    await user.click(shop);
    const picker = screen.getByRole("dialog", {
      name: "Where does Kakariko Shop lead?",
    });
    await user.type(within(picker).getByRole("searchbox"), "elder east");
    const options = within(picker).getAllByRole("button", {
      name: /Elder House/,
    });
    expect(options).toHaveLength(1);
    await user.click(options[0] as HTMLElement);

    expect(useGameStore.getState().entrances).toEqual({
      "kakariko-shop": "elder-house-exit-east",
    });
    expect(useEntrancePicker.getState().picking).toBeNull();
    expect(screen.getByTestId("entrance-kakariko-shop")).toHaveAccessibleName(
      "Kakariko Shop: leads to Elder House (East)",
    );
  });

  it("moves the checks inside a place above the door noted to lead there", () => {
    act(() => useGameStore.getState().applyPreset("crosskeys"));
    const { rerender } = render(
      <EntranceLayer markers={MARKERS} world="dark" />,
    );
    // Blind's Hideout waits for a door; an outdoor check stays
    expect(screen.queryByTestId("marker-blinds-hideout")).toBeNull();
    expect(screen.getByTestId("marker-bumper-cave")).toBeInTheDocument();

    act(() =>
      useGameStore.getState().noteEntrance("big-bomb-shop", "blinds-hideout"),
    );
    rerender(<EntranceLayer markers={MARKERS} world="dark" />);
    const blinds = screen.getByTestId("marker-blinds-hideout");
    expect(blinds).toHaveAccessibleName(/^Blind's Hideout \(5 checks\)/);
  });

  it("rings every entrance into the place the one pointed at leads to", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore.getState().noteEntrances({
        "blinds-hideout": "elder-house-exit-east",
        "kakariko-shop": "elder-house-exit-west",
      });
    });
    render(<EntranceLayer markers={MARKERS} world="light" />);
    const other = screen.getByTestId("entrance-blinds-hideout");
    expect(other).not.toHaveClass("entrance-marker--linked");

    await user.hover(screen.getByTestId("entrance-kakariko-shop"));
    expect(other).toHaveClass("entrance-marker--linked");
    await user.unhover(screen.getByTestId("entrance-kakariko-shop"));
    expect(other).not.toHaveClass("entrance-marker--linked");
  });

  it("notes a hole and its cave's door together, as one step", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useEntrancePicker.getState().pick("kakariko-well-drop");
    });
    render(<EntrancePicker />);
    await user.click(screen.getByTestId("entrance-option-bat-cave-right"));
    expect(useGameStore.getState().entrances).toEqual({
      "kakariko-well-cave": "bat-cave-exit",
      "kakariko-well-drop": "bat-cave-right",
    });
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().entrances).toEqual({});
  });

  it("says which entrance a target is noted at, and forgets one", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore
        .getState()
        .noteEntrance("blinds-hideout", "elder-house-exit-east");
      useEntrancePicker.getState().pick("blinds-hideout");
    });
    render(<EntrancePicker />);
    expect(
      screen.getByTestId("entrance-option-elder-house-exit-east"),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByTestId("entrance-forget"));
    expect(useGameStore.getState().entrances).toEqual({});

    act(() => useEntrancePicker.getState().pick("kakariko-shop"));
    act(() =>
      useGameStore
        .getState()
        .noteEntrance("blinds-hideout", "elder-house-exit-east"),
    );
    expect(
      screen.getByTestId("entrance-option-elder-house-exit-east"),
    ).toHaveTextContent("Elder House (East)at Blind's Hideout");
  });

  it("lists every entrance by world, with how many are noted", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore.getState().applyPreset("crosskeys");
      useGameStore
        .getState()
        .noteEntrance("kakariko-shop", "elder-house-exit-east");
    });
    render(<EntrancesPanel />);
    expect(screen.getByTestId("entrances-summary")).toHaveTextContent(
      "1 of 138 entrances noted",
    );
    expect(
      screen.getByText(
        "Autotracking notes each door you go through, outside Race Mode.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("entrance-row-kakariko-shop")).toHaveTextContent(
      "Kakariko ShopElder House (East)",
    );
    await user.type(screen.getByRole("searchbox"), "kakariko");
    expect(screen.getByTestId("entrances-summary")).toHaveTextContent(
      /, \d+ shown/,
    );
    await user.click(
      screen.getByRole("button", { name: /^Kakariko Shop: leads to/ }),
    );
    expect(useEntrancePicker.getState().picking).toBe("kakariko-shop");
  });

  it("lists each ported shuffle's own pool, and says plainly when a shuffle is not modelled", () => {
    const open = getPreset("open").settings;
    for (const [shuffle, mode, count] of [
      ["full", "open", 138],
      ["restricted", "open", 138],
      ["simple", "standard", 132],
    ] as const) {
      act(() =>
        useGameStore
          .getState()
          .applyRun("open", { ...open, entranceShuffle: shuffle, mode }),
      );
      const view = render(<EntrancesPanel />);
      expect(screen.getByTestId("entrances-summary")).toHaveTextContent(
        `0 of ${count} entrances noted`,
      );
      view.unmount();
    }

    // Insanity parts a door from its way out, Inverted runs tables of its
    // own: no list is better than a wrong one
    for (const [shuffle, mode, words] of [
      ["insanity", "open", "The Insanity entrance shuffle is not modelled yet"],
      [
        "simple",
        "inverted",
        "The Simple entrance shuffle in the Inverted world is not modelled yet",
      ],
    ] as const) {
      act(() =>
        useGameStore
          .getState()
          .applyRun("open", { ...open, entranceShuffle: shuffle, mode }),
      );
      const view = render(<EntrancesPanel />);
      expect(screen.queryByTestId("entrances-summary")).toBeNull();
      expect(screen.getByTestId("entrances-panel")).toHaveTextContent(words);
      view.unmount();
    }
  });

  it("notes a Simple run's dungeon whole from one of its doors, in the list and the picker", async () => {
    const user = userEvent.setup();
    act(() => {
      useGameStore.getState().applyRun("open", {
        ...getPreset("open").settings,
        entranceShuffle: "simple",
      });
      useEntrancePicker.getState().pick("desert-palace-entrance-south");
    });
    render(<EntrancePicker />);
    // A Desert door leads to that door of a four-door dungeon only
    expect(
      screen.queryByTestId("entrance-option-eastern-palace-exit"),
    ).toBeNull();
    await user.click(
      screen.getByTestId("entrance-option-turtle-rock-exit-front"),
    );
    expect(useGameStore.getState().entrances).toEqual({
      "desert-palace-entrance-east": "turtle-rock-isolated-ledge-exit",
      "desert-palace-entrance-north": "turtle-rock-ledge-exit-east",
      "desert-palace-entrance-south": "turtle-rock-exit-front",
      "desert-palace-entrance-west": "turtle-rock-ledge-exit-west",
    });
    render(<EntrancesPanel />);
    expect(screen.getByTestId("entrances-summary")).toHaveTextContent(
      "4 of 138 entrances noted",
    );
    expect(
      screen.getByTestId("entrance-row-desert-palace-entrance-north"),
    ).toHaveTextContent(
      "Desert Palace Entrance (North)Turtle Rock (Ledge East)",
    );
    // One step: one Undo takes the four back
    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().entrances).toEqual({});
  });
});
