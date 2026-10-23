import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const more = () => screen.getByTestId("toolbar-more");
const menu = () => screen.getByRole("menu", { name: "More" });
const items = () => within(menu()).getAllByRole("menuitem");
const item = (name: string) => within(menu()).getByRole("menuitem", { name });

/** Render the toolbar controls and open the More menu with a click. */
const openMenu = async () => {
  const user = userEvent.setup();
  render(<TrackerControls />);
  await user.click(more());
  return user;
};

describe("the toolbar's More menu", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  afterEach(() => vi.restoreAllMocks());

  it("is a menu button, closed at first", () => {
    render(<TrackerControls />);

    expect(more().tagName).toBe("BUTTON");
    expect(more()).toHaveAccessibleName("More");
    expect(more()).toHaveAttribute("aria-haspopup", "menu");
    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("toolbar-more-menu")).not.toBeVisible();
  });

  it("opens on its first item, holding every secondary action with its icon", async () => {
    await openMenu();

    expect(more()).toHaveAttribute("aria-expanded", "true");
    expect(more()).toHaveAttribute("aria-controls", menu().id);
    expect(items().map((entry) => entry.textContent)).toEqual([
      "Export",
      "Import",
      "Share",
      "Stream view",
      "Shortcuts",
    ]);
    for (const entry of items()) {
      expect(entry).toHaveAttribute("tabindex", "-1");
      expect(entry.querySelector("svg")).not.toBeNull();
    }
    expect(item("Export")).toHaveFocus();
  });

  it("moves between its items with the arrows, wrapping, and Home and End", async () => {
    const user = await openMenu();

    await user.keyboard("{ArrowDown}");
    expect(item("Import")).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(item("Shortcuts")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Export")).toHaveFocus();
    await user.keyboard("{End}");
    expect(item("Shortcuts")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Export")).toHaveFocus();
  });

  it("opens from the keyboard: Enter or Down on its first item, Up on its last", async () => {
    const user = userEvent.setup();
    render(<TrackerControls />);
    act(() => more().focus());

    await user.keyboard("{Enter}");
    expect(item("Export")).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowUp}");
    expect(item("Shortcuts")).toHaveFocus();
    await user.keyboard("{Escape}");
    await user.keyboard("{ArrowDown}");
    expect(item("Export")).toHaveFocus();
  });

  it("closes on Escape, focus back on its button", async () => {
    const user = await openMenu();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).toBeNull();
    expect(more()).toHaveAttribute("aria-expanded", "false");
    expect(more()).toHaveFocus();
  });

  it("closes on Tab, and focus moves on", async () => {
    const user = await openMenu();

    await user.tab();

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("radio", { name: "Auto" })).toHaveFocus();
  });

  it("closes on Shift+Tab too, back on its button", async () => {
    const user = await openMenu();

    await user.tab({ shift: true });

    expect(screen.queryByRole("menu")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("closes when the toolbar folds otherwise, its items no longer matching", async () => {
    const user = userEvent.setup();
    render(
      <div data-fold="labels secondary" data-testid="bar">
        <TrackerControls />
      </div>,
    );
    await user.click(more());
    expect(menu()).toBeVisible();

    // The mutation observer runs as a microtask after the change
    await act(async () => {
      screen.getByTestId("bar").dataset.fold = "labels";
    });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("offers the map layout and key cells as choices once the bar folds them", async () => {
    const user = userEvent.setup();
    render(
      <div data-fold="labels secondary map keys">
        <TrackerControls />
      </div>,
    );
    await user.click(more());

    const map = within(menu()).getByRole("group", { name: "Map" });
    const choices = within(map).getAllByRole("menuitemradio");
    // Named by their label alone: the tick is for the eye
    ["Auto", "Side", "Stack"].forEach((name, index) => {
      expect(choices[index]).toHaveAccessibleName(name);
    });
    expect(
      choices.map((choice) => choice.getAttribute("aria-checked")),
    ).toEqual(["true", "false", "false"]);
    const keys = within(menu()).getByRole("menuitemcheckbox", {
      name: "Big keys",
    });
    expect(keys).toHaveAttribute("aria-checked", "false");
    expect(within(menu()).getAllByRole("separator")).toHaveLength(2);

    // Choosing closes the menu, as a command does, and the choice holds
    await user.click(choices[2]);
    expect(useGameStore.getState().mapLayout).toBe("stacked");
    expect(screen.queryByRole("menu")).toBeNull();
    await user.click(more());
    expect(
      within(menu()).getByRole("menuitemradio", { name: "Stack" }),
    ).toHaveAttribute("aria-checked", "true");
    await user.click(
      within(menu()).getByRole("menuitemcheckbox", { name: "Big keys" }),
    );
    expect(useGameStore.getState().bigKeysVisible).toBe(true);
  });

  it("leads with Autotracking and its status once the bar folds it last", async () => {
    const user = userEvent.setup();
    render(
      <div data-fold="labels secondary map keys new-game autotrack">
        <TrackerControls />
      </div>,
    );
    await user.click(more());

    expect(items()[0]).toHaveAccessibleName("Autotracking Off");
    expect(items()[0]).toHaveFocus();
    // The button's dot is for the eye: its name stays "More"
    expect(more()).toHaveAccessibleName("More");
    expect(within(more()).getByTestId("autotrack-dot")).toHaveAttribute(
      "data-phase",
      "off",
    );
  });

  it("offers only the folded settings: the map layout alone", async () => {
    const user = userEvent.setup();
    render(
      <div data-fold="labels secondary map">
        <TrackerControls />
      </div>,
    );
    await user.click(more());

    expect(within(menu()).getAllByRole("menuitemradio")).toHaveLength(3);
    expect(within(menu()).queryByRole("menuitemcheckbox")).toBeNull();
  });

  it("moves through choices and commands alike with the arrows", async () => {
    const user = userEvent.setup();
    render(
      <div data-fold="labels secondary map keys">
        <TrackerControls />
      </div>,
    );
    await user.click(more());

    await user.keyboard("{End}");
    expect(
      within(menu()).getByRole("menuitemcheckbox", { name: "Big keys" }),
    ).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(
      within(menu()).getByRole("menuitemradio", { name: "Stack" }),
    ).toHaveFocus();
  });

  it("closes on a press anywhere else, or on its button again", async () => {
    const user = await openMenu();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();

    await user.click(more());
    expect(menu()).toBeVisible();
    await user.click(more());
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("exports the save, and closes with focus on its button", async () => {
    const createObjectURL = vi.fn(() => "blob:save");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = await openMenu();

    await user.click(item("Export"));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(more()).toHaveFocus();
  });

  it("shares the run: a link to the clipboard, and the menu closes", async () => {
    const user = await openMenu();
    // After the setup: user-event installs a clipboard of its own
    const writeText = vi.spyOn(navigator.clipboard, "writeText");

    await user.click(item("Share"));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const [link] = writeText.mock.calls[0];
    expect(new URL(link).hash).toMatch(/^#run=/);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("imports through the same file picker as the toolbar's Import", async () => {
    const picked: HTMLInputElement[] = [];
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
      this: HTMLInputElement,
    ) {
      picked.push(this);
    });
    const user = await openMenu();

    await user.click(item("Import"));

    expect(picked).toEqual([screen.getByTestId("import-file")]);
  });

  it.each([
    ["Stream view", "Stream view"],
    ["Shortcuts", "Keyboard shortcuts"],
  ])(
    "opens the %s dialog, and focus comes back to More",
    async (name, title) => {
      const user = await openMenu();

      await user.keyboard(
        name === "Shortcuts"
          ? "{End}{Enter}"
          : "{ArrowDown}{ArrowDown}{ArrowDown}{Enter}",
      );

      const dialog = await screen.findByRole("dialog", { name: title });
      expect(screen.queryByRole("menu")).toBeNull();
      await user.click(within(dialog).getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(more()).toHaveFocus();
    },
  );

  it("leaves the keys of a dialog it opened to that dialog", async () => {
    const user = await openMenu();
    await user.click(item("Stream view"));
    const copy = screen.getByTestId("stream-view-copy");
    expect(copy).toHaveFocus();

    // React bubbles the portalled dialog's events through the menu
    const escapeGoesThrough = fireEvent.keyDown(copy, { key: "Escape" });
    await user.keyboard("{ArrowDown}{End}");

    expect(escapeGoesThrough).toBe(true);
    expect(copy).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Stream view" })).toBeVisible();
  });
});
