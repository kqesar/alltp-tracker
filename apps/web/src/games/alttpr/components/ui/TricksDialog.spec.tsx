import { TRICK_IDS } from "@alltp/pack-alttpr";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TricksDialog } from "@/games/alttpr/components/ui/TricksDialog";
import { getPreset } from "@/games/alttpr/data/presets";
import { TRICK_WORDS } from "@/games/alttpr/data/tricks";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const tricks = () => useGameStore.getState().tricks;

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe("TricksDialog", () => {
  const open = () => {
    const onClose = vi.fn();
    render(<TricksDialog isOpen onClose={onClose} />);
    return { dialog: screen.getByRole("dialog", { name: "Tricks" }), onClose };
  };

  it("says what it does and that the logic never counts on a trick", () => {
    const { dialog } = open();
    expect(dialog).toHaveTextContent(/never counts on a trick/i);
    expect(dialog).toHaveTextContent(/Race Mode is unchanged/i);
  });

  it("starts off, with the six tricks listed but not changeable", () => {
    const { dialog } = open();
    const master = within(dialog).getByRole("checkbox", {
      name: "Mark checks these tricks open",
    });
    expect(master).not.toBeChecked();
    const group = within(dialog).getByRole("group", { name: "Tricks I know" });
    expect(group).toBeDisabled();
    expect(within(group).getAllByRole("checkbox")).toHaveLength(
      TRICK_IDS.length,
    );
  });

  it("turns the marks on with every trick ticked, kept as a preference", () => {
    const { dialog } = open();
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Mark checks these tricks open",
      }),
    );
    expect(tricks()).toEqual({ enabled: true, techniques: TRICK_IDS });
    expect(
      within(dialog).getByRole("group", { name: "Tricks I know" }),
    ).toBeEnabled();
    // No run changed, nothing to undo
    expect(useGameStore.getState().past).toHaveLength(0);
  });

  it("describes each trick by its summary and links its guides out of the tab", () => {
    const { dialog } = open();
    for (const id of TRICK_IDS) {
      const { guides, name, summary } = TRICK_WORDS[id];
      const box = within(dialog).getByRole("checkbox", { name });
      expect(box).toHaveAccessibleDescription(summary);
      for (const guide of guides) {
        const link = within(dialog)
          .getAllByRole("link")
          .find((each) => each.getAttribute("href") === guide.url);
        expect(link, guide.url).toBeDefined();
        expect(link).toHaveAccessibleName(
          expect.stringMatching(
            new RegExp(`^${guide.label}.*opens in a new tab`),
          ),
        );
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
      }
    }
  });

  it("learns and forgets one trick at a time", () => {
    const { dialog } = open();
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: "Mark checks these tricks open",
      }),
    );
    const box = within(dialog).getByRole("checkbox", { name: "Water walk" });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    expect(tricks().techniques).toEqual(
      TRICK_IDS.filter((id) => id !== "waterWalk"),
    );
    fireEvent.click(box);
    expect(tricks().techniques).toEqual(TRICK_IDS);
  });

  it("says nothing is marked in a run without a tricks world", () => {
    open();
    expect(screen.queryByTestId("tricks-unsupported")).toBeNull();
  });

  it("says so for a run with shuffled entrances", () => {
    useGameStore.setState({ settings: getPreset("crosskeys").settings });
    open();
    expect(screen.getByTestId("tricks-unsupported")).toHaveTextContent(
      /nothing is marked/i,
    );
  });

  it("names the tricks a glitched logic counts already", () => {
    open();
    expect(screen.queryByTestId("tricks-in-logic")).toBeNull();
    act(() =>
      useGameStore.setState({
        settings: {
          ...getPreset("open").settings,
          glitches: "overworld_glitches",
        },
      }),
    );
    expect(screen.getByTestId("tricks-in-logic")).toHaveTextContent(
      "This run's logic counts Fake flipper, Water walk, Super bunny and Dungeon revival already",
    );
  });

  it("closes from its Done button", () => {
    const { dialog, onClose } = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
