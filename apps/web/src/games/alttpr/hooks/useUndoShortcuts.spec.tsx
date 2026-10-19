import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useUndoShortcuts } from "@/games/alttpr/hooks/useUndoShortcuts";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const Harness = ({ withField = false }: { withField?: boolean }) => {
  useUndoShortcuts();
  return withField ? <input aria-label="Notes" data-testid="notes" /> : null;
};

const hookshot = () => useGameStore.getState().items.hookshot;

describe("useUndoShortcuts", () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      useGameStore.getState().handleItemClick("hookshot");
    });
  });

  it("undoes with Ctrl+Z and Cmd+Z", () => {
    render(<Harness />);

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    expect(hookshot()).toBe(false);

    act(() => useGameStore.getState().handleItemClick("hookshot"));
    fireEvent.keyDown(window, { key: "z", metaKey: true });
    expect(hookshot()).toBe(false);
  });

  it("redoes with Ctrl+Shift+Z and Ctrl+Y", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });

    fireEvent.keyDown(window, { ctrlKey: true, key: "Z", shiftKey: true });
    expect(hookshot()).toBe(true);

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });
    fireEvent.keyDown(window, { ctrlKey: true, key: "y" });
    expect(hookshot()).toBe(true);
  });

  it("claims the shortcut from the browser", () => {
    render(<Harness />);

    const handled = fireEvent.keyDown(window, { ctrlKey: true, key: "z" });

    expect(handled).toBe(false);
  });

  it("leaves Ctrl+Z to a text field being edited", () => {
    render(<Harness withField />);

    fireEvent.keyDown(screen.getByTestId("notes"), {
      ctrlKey: true,
      key: "z",
    });

    expect(hookshot()).toBe(true);
  });

  it("does nothing while a dialog is open", () => {
    render(<Harness />);
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);

    fireEvent.keyDown(window, { ctrlKey: true, key: "z" });

    expect(hookshot()).toBe(true);
    dialog.remove();
  });

  it("ignores a plain z", () => {
    render(<Harness />);

    fireEvent.keyDown(window, { key: "z" });

    expect(hookshot()).toBe(true);
  });
});
