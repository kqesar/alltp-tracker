import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { TrackerGrid } from "@/games/alttpr/components/tracker/TrackerGrid";
import { defaultItemGrid } from "@/games/alttpr/data/items";
import type { Keymap } from "@/games/alttpr/data/keymap";
import { useItemShortcuts } from "@/games/alttpr/hooks/useItemShortcuts";
import { useUndoShortcuts } from "@/games/alttpr/hooks/useUndoShortcuts";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The board as App wires it: the grid, undo/redo and the item shortcuts. */
const Board = ({ children }: { children?: ReactNode }) => {
  useUndoShortcuts();
  useItemShortcuts();
  return (
    <>
      <TrackerGrid itemLayout={defaultItemGrid} />
      {children}
    </>
  );
};

const state = () => useGameStore.getState();
const items = () => state().items;

/** Record whether each keydown reaching the window was claimed by the app. */
const watchClaims = () => {
  const claims: { code: string; claimed: boolean; repeat: boolean }[] = [];
  // Registered after the app's listeners, so it sees what they decided
  window.addEventListener("keydown", (event) =>
    claims.push({
      claimed: event.defaultPrevented,
      code: event.code,
      repeat: event.repeat,
    }),
  );
  return claims;
};

const setKeymap = (keymap: Keymap) =>
  act(() => useGameStore.getState().setKeymap(keymap));

describe("item shortcuts", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  });

  describe("with the default keymap", () => {
    it("toggles an item with its key, and back with Shift", async () => {
      const user = userEvent.setup();
      render(<Board />);

      await user.keyboard("w");
      expect(items().hookshot).toBe(true);
      expect(screen.getByTestId("item-hookshot")).toHaveAccessibleName(
        /^Hookshot, obtained\./,
      );

      await user.keyboard("{Shift>}w{/Shift}");
      expect(items().hookshot).toBe(false);
    });

    it("levels a progressive item up and wraps, as clicks do", async () => {
      const user = userEvent.setup();
      render(<Board />);

      const levels = [];
      for (let press = 0; press < 5; press++) {
        await user.keyboard("f");
        levels.push(items().sword);
      }

      expect(levels).toEqual([1, 2, 3, 4, 0]);
    });

    it("counts a dungeon's chests down with its number, back up with Shift", async () => {
      const user = userEvent.setup();
      render(<Board />);

      await user.keyboard("1");
      expect(items().chest0).toBe(2);
      await user.keyboard("{Shift>}1{/Shift}");
      expect(items().chest0).toBe(3);

      await user.keyboard("0");
      expect(items().chest9).toBe(4);
    });

    it("claims its keys from the browser, and only those", async () => {
      const user = userEvent.setup();
      render(<Board />);
      const claims = watchClaims();

      await user.keyboard("w[Slash][Equal]");

      expect(claims.map(({ claimed }) => claimed)).toEqual([
        true,
        false,
        false,
      ]);
    });
  });

  it.each([
    ["a text field", <input aria-label="Notes" data-testid="field" key="f" />],
    [
      "a text area",
      <textarea aria-label="Notes" data-testid="field" key="f" />,
    ],
    [
      "a list box",
      <select aria-label="Pick" data-testid="field" key="f">
        <option>w</option>
      </select>,
    ],
    [
      "an editable region",
      <div
        contentEditable
        data-testid="field"
        key="f"
        suppressContentEditableWarning
      />,
    ],
  ])("does nothing while the player types in %s", async (_, field) => {
    const user = userEvent.setup();
    render(<Board>{field}</Board>);
    const claims = watchClaims();

    await user.click(screen.getByTestId("field"));
    await user.keyboard("w1");

    expect(items().hookshot).toBe(false);
    expect(items().chest0).toBe(3);
    expect(claims.map(({ claimed }) => claimed)).toEqual([false, false]);
  });

  it("lets the typed keys reach a text field", async () => {
    const user = userEvent.setup();
    render(
      <Board>
        <input aria-label="Notes" data-testid="field" />
      </Board>,
    );

    await user.type(screen.getByTestId("field"), "w1");

    expect(screen.getByTestId("field")).toHaveValue("w1");
  });

  it("leaves an open menu its own keys", async () => {
    const user = userEvent.setup();
    render(
      <Board>
        <div aria-label="More" role="menu">
          <button
            data-testid="field"
            role="menuitem"
            tabIndex={-1}
            type="button"
          >
            Export
          </button>
        </div>
      </Board>,
    );
    act(() => screen.getByTestId("field").focus());

    await user.keyboard("w1");

    expect(items().hookshot).toBe(false);
    expect(items().chest0).toBe(3);
  });

  it("does nothing while a dialog covers the board", async () => {
    const user = userEvent.setup();
    render(
      <Board>
        <dialog open>Settings</dialog>
      </Board>,
    );

    await user.keyboard("w");

    expect(items().hookshot).toBe(false);
  });

  it("steps once for a key held down, and claims its repeats", async () => {
    const user = userEvent.setup();
    render(<Board />);
    const claims = watchClaims();

    await user.keyboard("{w>4}");

    expect(items().hookshot).toBe(true);
    expect(state().past).toHaveLength(1);
    expect(claims).toEqual([
      { claimed: true, code: "KeyW", repeat: false },
      { claimed: true, code: "KeyW", repeat: true },
      { claimed: true, code: "KeyW", repeat: true },
      { claimed: true, code: "KeyW", repeat: true },
    ]);
  });

  // user-event cannot compose: the two shapes engines report, by hand
  it.each([
    ["flagged as composing", { isComposing: true, key: "w" }],
    [
      "reported as key 229, as older engines do",
      { key: "Process", keyCode: 229 },
    ],
  ])("ignores a key an input method is composing with, %s", (_, init) => {
    render(<Board />);

    fireEvent.keyDown(document.body, { code: "KeyW", ...init });

    expect(items().hookshot).toBe(false);
    expect(state().past).toHaveLength(0);
  });

  describe("modifiers", () => {
    it("must match exactly", async () => {
      const user = userEvent.setup();
      render(<Board />);
      setKeymap({ "advance:mirror": "Alt+KeyK", "back:mirror": "KeyK" });

      await user.keyboard("{Shift>}{Alt>}k{/Alt}{/Shift}");
      expect(items().mirror).toBe(false);

      await user.keyboard("{Alt>}k{/Alt}");
      expect(items().mirror).toBe(true);

      await user.keyboard("k");
      expect(items().mirror).toBe(false);
      expect(state().past).toHaveLength(2);
    });

    it("never take a Ctrl or Cmd chord from the browser", async () => {
      const user = userEvent.setup();
      render(<Board />);
      const claims = watchClaims();

      await user.keyboard("{Control>}w{/Control}{Meta>}r{/Meta}");

      expect(items().hookshot).toBe(false);
      expect(
        claims.filter(({ code }) => code === "KeyW" || code === "KeyR"),
      ).toEqual([
        { claimed: false, code: "KeyW", repeat: false },
        { claimed: false, code: "KeyR", repeat: false },
      ]);
    });

    it("never take a chord the browser owns, even from a keymap holding it", async () => {
      const user = userEvent.setup();
      render(<Board />);
      setKeymap({
        "advance:bow": "Control+KeyA",
        "advance:hammer": "Alt+KeyD",
      });

      await user.keyboard("{Control>}a{/Control}{Alt>}d{/Alt}");

      expect(items().bow).toBe(0);
      expect(items().hammer).toBe(false);
    });
  });

  describe("with undo and redo", () => {
    it("makes each press one step that Ctrl+Z takes back", async () => {
      const user = userEvent.setup();
      render(<Board />);

      await user.keyboard("wff");
      expect(state().past).toHaveLength(3);

      await user.keyboard("{Control>}z{/Control}");
      expect(items().sword).toBe(1);
      await user.keyboard("{Control>}z{/Control}{Control>}z{/Control}");
      expect(items().hookshot).toBe(false);

      await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
      expect(items().hookshot).toBe(true);
    });

    it("leaves Ctrl+Z to undo, never also toggling the item on Z", async () => {
      const user = userEvent.setup();
      render(<Board />);
      await user.keyboard("w");

      await user.keyboard("{Control>}z{/Control}");

      expect(items().hookshot).toBe(false);
      expect(items().shovel).toBe(false);
      expect(state().future).toHaveLength(1);
    });
  });

  it("does nothing while shortcuts are switched off", async () => {
    const user = userEvent.setup();
    render(<Board />);
    act(() => useGameStore.getState().setShortcutsEnabled(false));
    const claims = watchClaims();

    await user.keyboard("w1");

    expect(items().hookshot).toBe(false);
    expect(items().chest0).toBe(3);
    expect(claims.map(({ claimed }) => claimed)).toEqual([false, false]);
  });

  it("steps a key cell only while key cells are shown, as a click could", async () => {
    const user = userEvent.setup();
    render(<Board />);
    setKeymap({ "advance:bigkey0": "KeyK", "advance:smallkey3": "KeyL" });

    await user.keyboard("kl");
    expect(items().bigkey0).toBe(0);
    expect(state().smallKeys[3]).toBe(0);

    act(() => useGameStore.getState().setBigKeysVisible(true));
    await user.keyboard("kl");
    expect(items().bigkey0).toBe(1);
    expect(state().smallKeys[3]).toBe(1);
  });

  it("steps a map or a compass only in keysanity, where its key cell shows it", async () => {
    const user = userEvent.setup();
    render(<Board />);
    act(() => useGameStore.getState().setBigKeysVisible(true));
    setKeymap({ "advance:compass3": "KeyL", "advance:map3": "KeyK" });

    await user.keyboard("kl");
    expect([items().map3, items().compass3]).toEqual([0, 0]);

    act(() => useGameStore.getState().applyPreset("keysanity"));
    await user.keyboard("kl");
    expect([items().map3, items().compass3]).toEqual([1, 1]);
  });

  describe("and the focused cell's own '-'", () => {
    it("still steps the focused cell back when '-' is no shortcut", async () => {
      const user = userEvent.setup();
      render(<Board />);
      await user.click(screen.getByTestId("item-sword"));

      await user.keyboard("-");

      expect(items().sword).toBe(0);
      expect(state().past).toHaveLength(2);
    });

    it("gives way to a shortcut on the same key: AZERTY types '-' with the 6 key", async () => {
      const user = userEvent.setup({
        keyboardMap: [{ code: "Digit6", key: "-" }],
      });
      render(<Board />);
      await user.click(screen.getByTestId("item-sword"));

      await user.keyboard("[Digit6]");

      // Skull Woods, the sixth dungeon, had two chests
      expect(items().chest5).toBe(1);
      expect(items().sword).toBe(1);
      expect(state().past).toHaveLength(2);
    });
  });

  it("announces each control's keys to assistive technology", () => {
    render(<Board />);

    expect(screen.getByTestId("item-hookshot")).toHaveAttribute(
      "aria-keyshortcuts",
      "W Shift+W -",
    );
    expect(screen.getByTestId("chest-overlay-0")).toHaveAttribute(
      "aria-keyshortcuts",
      "1 Shift+1 -",
    );
    expect(screen.getByTestId("item-boss0")).toHaveAttribute(
      "aria-keyshortcuts",
      "-",
    );

    act(() => useGameStore.getState().setShortcutsEnabled(false));
    expect(screen.getByTestId("item-hookshot")).toHaveAttribute(
      "aria-keyshortcuts",
      "-",
    );
  });
});
