import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ShortcutsButton } from "@/components/ui/ShortcutsButton";
import { CONTROLS, DEFAULT_KEYMAP } from "@/data/keymap";
import { useGameStore } from "@/stores/gameStore";

const keymap = () => useGameStore.getState().shortcuts.keymap;

/** Escape on a modal <dialog>: the browser fires a cancelable `cancel`. */
const pressEscapeOn = (dialog: HTMLElement) =>
  fireEvent(dialog, new Event("cancel", { cancelable: true }));

const dialog = () => screen.getByRole("dialog", { name: "Keyboard shortcuts" });
const binding = (testId: string) => within(dialog()).getByTestId(testId);
const status = () => within(dialog()).getByTestId("shortcuts-status");

/** Open the dialog from its toolbar button with the keyboard alone. */
const openWithKeyboard = async () => {
  const user = userEvent.setup();
  render(<ShortcutsButton />);
  await user.tab();
  expect(screen.getByTestId("shortcuts-button")).toHaveFocus();
  await user.keyboard("{Enter}");
  return user;
};

/** Focus a binding and start its capture with Enter. */
const capture = async (
  user: ReturnType<typeof userEvent.setup>,
  testId: string,
) => {
  act(() => binding(testId).focus());
  await user.keyboard("{Enter}");
  expect(binding(testId)).toHaveAccessibleName(/: press a key$/);
};

describe("ShortcutsDialog", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  it("opens from a named toolbar button", async () => {
    const user = userEvent.setup();
    render(<ShortcutsButton />);
    const button = screen.getByTestId("shortcuts-button");

    expect(button).toHaveAccessibleName("Shortcuts");
    expect(button.tagName).toBe("BUTTON");
    await user.click(button);

    expect(dialog()).toBeInTheDocument();
  });

  it("lists every control with its icon, its name and both of its keys", async () => {
    await openWithKeyboard();

    const iconOf = (name: string) =>
      within(dialog())
        .getAllByRole("rowheader", { name })[0]
        .querySelector("img")
        ?.getAttribute("src");
    expect(iconOf("Hookshot")).toMatch(/\/hookshot\.png$/);
    expect(iconOf("Bow")).toMatch(/\/bow1\.png$/);
    // Eastern Palace's: its three chests, its boss alive
    expect(iconOf("Chests")).toMatch(/\/chest3\.png$/);
    expect(iconOf("Boss")).toMatch(/\/boss01\.png$/);
    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: W",
    );
    expect(binding("shortcut-back-hookshot")).toHaveAccessibleName(
      "Hookshot back: Shift+W",
    );
    expect(binding("shortcut-advance-chest0")).toHaveAccessibleName(
      "Eastern Palace chests forward: 1",
    );
    expect(binding("shortcut-advance-boss0")).toHaveAccessibleName(
      "Eastern Palace boss forward: no shortcut",
    );
    expect(within(dialog()).getAllByTestId(/^shortcut-advance-/)).toHaveLength(
      CONTROLS.length,
    );
    expect(
      within(dialog()).getByRole("rowheader", { name: "Turtle Rock" }),
    ).toBeInTheDocument();
  });

  it("rebinds a key from the keyboard alone, and says so", async () => {
    const user = await openWithKeyboard();

    await capture(user, "shortcut-advance-hookshot");
    expect(status()).toHaveTextContent(
      "Press the new key for Hookshot forward. Delete removes it, Escape cancels.",
    );
    await user.keyboard("[BracketLeft]");

    expect(keymap()["advance:hookshot"]).toBe("BracketLeft");
    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: [",
    );
    expect(binding("shortcut-advance-hookshot")).toHaveFocus();
    expect(status()).toHaveAttribute("role", "status");
    expect(status()).toHaveTextContent("Hookshot forward: [.");
  });

  it("waits for the key a modifier modifies", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-bow");

    await user.keyboard("{Shift>}");
    expect(binding("shortcut-advance-bow")).toHaveAccessibleName(
      "Bow forward: press a key",
    );
    await user.keyboard("[BracketLeft]{/Shift}");

    expect(keymap()["advance:bow"]).toBe("Shift+BracketLeft");
  });

  it("cancels a capture on Escape, and only then closes", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-hookshot");

    pressEscapeOn(dialog());

    expect(dialog()).toBeInTheDocument();
    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: W",
    );
    expect(status()).toHaveTextContent(
      "Change cancelled. Hookshot forward: W.",
    );
    pressEscapeOn(dialog());
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("cancels a capture when focus leaves it, or on a second click", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-hookshot");

    await user.tab();
    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: W",
    );

    await user.click(binding("shortcut-advance-bow"));
    expect(binding("shortcut-advance-bow")).toHaveAccessibleName(
      "Bow forward: press a key",
    );
    await user.click(binding("shortcut-advance-bow"));
    expect(binding("shortcut-advance-bow")).toHaveAccessibleName(
      "Bow forward: A",
    );
    expect(keymap()).toEqual(DEFAULT_KEYMAP);
  });

  it("removes a key with Delete or Backspace", async () => {
    const user = await openWithKeyboard();

    await capture(user, "shortcut-advance-hookshot");
    await user.keyboard("{Delete}");
    await capture(user, "shortcut-back-hookshot");
    await user.keyboard("{Backspace}");

    expect(keymap()).not.toHaveProperty("advance:hookshot");
    expect(keymap()).not.toHaveProperty("back:hookshot");
    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: no shortcut",
    );
    expect(status()).toHaveTextContent("Hookshot back: no shortcut.");
  });

  it("refuses a key that keeps its job, or that the browser owns, and keeps listening", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-hookshot");

    await user.keyboard("{Enter}");
    expect(status()).toHaveTextContent(
      "Enter can't be a shortcut: it keeps its own job.",
    );
    await user.keyboard("{Control>}r{/Control}");
    expect(status()).toHaveTextContent(
      "Ctrl+R belongs to the browser or the system.",
    );

    expect(binding("shortcut-advance-hookshot")).toHaveAccessibleName(
      "Hookshot forward: press a key",
    );
    expect(keymap()).toEqual(DEFAULT_KEYMAP);
  });

  it("keeps a key the action already has", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-hookshot");

    await user.keyboard("w");

    expect(status()).toHaveTextContent("Hookshot forward: W, unchanged.");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  describe("a key already in use", () => {
    const conflict = () =>
      screen.getByRole("dialog", { name: "K is already in use" });

    const takeMirrorsKey = async () => {
      const user = await openWithKeyboard();
      await capture(user, "shortcut-advance-hookshot");
      await user.keyboard("k");
      return user;
    };

    it("asks first, starting on Cancel", async () => {
      await takeMirrorsKey();

      expect(conflict()).toHaveTextContent(
        "K steps Magic Mirror forward. Swap moves it to W; Replace leaves it without a shortcut.",
      );
      expect(
        within(conflict()).getByTestId("shortcut-conflict-cancel"),
      ).toHaveFocus();
      expect(keymap()).toEqual(DEFAULT_KEYMAP);
    });

    it("swaps the two keys", async () => {
      const user = await takeMirrorsKey();

      await user.click(
        within(conflict()).getByTestId("shortcut-conflict-swap"),
      );

      expect(keymap()["advance:hookshot"]).toBe("KeyK");
      expect(keymap()["advance:mirror"]).toBe("KeyW");
      expect(status()).toHaveTextContent(
        "Hookshot forward: K. Magic Mirror forward: W.",
      );
    });

    it("replaces, leaving the other action without a key", async () => {
      const user = await takeMirrorsKey();

      await user.click(
        within(conflict()).getByTestId("shortcut-conflict-replace"),
      );

      expect(keymap()["advance:hookshot"]).toBe("KeyK");
      expect(keymap()).not.toHaveProperty("advance:mirror");
      expect(status()).toHaveTextContent(
        "Hookshot forward: K. Magic Mirror forward: no shortcut.",
      );
    });

    it("changes nothing on Cancel or Escape", async () => {
      const user = await takeMirrorsKey();
      await user.click(
        within(conflict()).getByTestId("shortcut-conflict-cancel"),
      );
      expect(keymap()).toEqual(DEFAULT_KEYMAP);

      await capture(user, "shortcut-advance-hookshot");
      await user.keyboard("k");
      pressEscapeOn(conflict());

      expect(keymap()).toEqual(DEFAULT_KEYMAP);
      expect(dialog()).toBeInTheDocument();
      expect(status()).toHaveTextContent(
        "Change cancelled. Hookshot forward: W.",
      );
    });

    it("offers only Replace when the rebound action had no key", async () => {
      const user = await openWithKeyboard();
      await capture(user, "shortcut-advance-boss0");
      await user.keyboard("k");

      expect(conflict()).toHaveTextContent(
        "K steps Magic Mirror forward. Replace leaves it without a shortcut.",
      );
      expect(
        within(conflict()).queryByTestId("shortcut-conflict-swap"),
      ).toBeNull();
    });
  });

  it("resets every key to its default once confirmed", async () => {
    const user = await openWithKeyboard();
    await capture(user, "shortcut-advance-hookshot");
    await user.keyboard("{Delete}");

    await user.click(binding("shortcuts-reset"));
    const confirm = screen.getByRole("dialog", {
      name: "Reset every shortcut?",
    });
    expect(
      within(confirm).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    await user.click(within(confirm).getByRole("button", { name: "Reset" }));

    expect(keymap()).toEqual(DEFAULT_KEYMAP);
    expect(status()).toHaveTextContent(
      "Every shortcut is back to its default.",
    );
  });

  it("turns every shortcut off and on with its switch", async () => {
    const user = await openWithKeyboard();
    const toggle = within(dialog()).getByRole("switch", {
      name: "Use keyboard shortcuts",
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(useGameStore.getState().shortcuts.enabled).toBe(false);
    expect(status()).toHaveTextContent("Keyboard shortcuts off.");
    expect(dialog()).toHaveTextContent("Shortcuts are off");

    act(() => toggle.focus());
    await user.keyboard(" ");
    expect(useGameStore.getState().shortcuts.enabled).toBe(true);
    expect(status()).toHaveTextContent("Keyboard shortcuts on.");
  });

  it("says when key cells are hidden that their keys wait for them", async () => {
    await openWithKeyboard();
    expect(dialog()).toHaveTextContent(
      "Big and small key shortcuts work while the key cells are shown.",
    );

    act(() => useGameStore.getState().setBigKeysVisible(true));
    expect(dialog()).not.toHaveTextContent("while the key cells are shown");
  });

  it("names Cmd+Z and Option on a Mac", async () => {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });
    try {
      const user = await openWithKeyboard();
      expect(dialog()).toHaveTextContent("Cmd+Z undoes it.");

      await capture(user, "shortcut-advance-hookshot");
      await user.keyboard("{Control>}r{/Control}");
      expect(status()).toHaveTextContent(
        "Pick a key alone, or with Shift or Option.",
      );
    } finally {
      Reflect.deleteProperty(navigator, "platform");
    }
  });

  it("closes with Done", async () => {
    const user = await openWithKeyboard();

    await user.click(within(dialog()).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
