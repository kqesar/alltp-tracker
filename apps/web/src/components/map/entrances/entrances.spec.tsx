import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import EntranceLayer from "@/components/map/entrances/EntranceLayer";
import EntrancePicker from "@/components/map/entrances/EntrancePicker";
import EntrancesPanel from "@/components/map/entrances/EntrancesPanel";
import { useEntrancePicker } from "@/stores/entrancePickerStore";
import { useGameStore } from "@/stores/gameStore";

describe("the entrance assistant", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useEntrancePicker.setState({ picking: null });
    });
  });

  it("draws no entrance where none is shuffled", () => {
    render(<EntranceLayer world="light" />);
    expect(screen.queryAllByTestId(/^entrance-/)).toHaveLength(0);
  });

  it("draws a world's shuffled entrances, and opens the picker on one", async () => {
    const user = userEvent.setup();
    act(() => useGameStore.getState().applyPreset("crosskeys"));
    render(
      <>
        <EntranceLayer world="light" />
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
});
