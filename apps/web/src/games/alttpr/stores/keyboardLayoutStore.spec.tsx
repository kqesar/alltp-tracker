import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KeyChord } from "@/games/alttpr/components/ui/KeyChord";
import {
  loadKeyboardLayout,
  useKeyboardLayoutStore,
} from "@/games/alttpr/stores/keyboardLayoutStore";

/** Give `navigator.keyboard` to a test, as Chromium has it. */
const stubKeyboard = (getLayoutMap: () => Promise<Map<string, string>>) =>
  vi.stubGlobal("navigator", { ...navigator, keyboard: { getLayoutMap } });

describe("the keyboard layout", () => {
  beforeEach(() => useKeyboardLayoutStore.setState({ layout: null }));
  afterEach(() => vi.unstubAllGlobals());

  it("labels keys as the player's layout types them, once the browser says", async () => {
    stubKeyboard(async () => new Map([["KeyQ", "a"]]));
    render(<KeyChord chord="Shift+KeyQ" />);
    expect(screen.getByText("Q")).toBeInTheDocument();

    await act(loadKeyboardLayout);

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByText("Q")).toBeNull();
  });

  it("keeps the fallback labels where the browser has no layout map", async () => {
    vi.stubGlobal("navigator", { ...navigator, keyboard: undefined });

    await loadKeyboardLayout();

    expect(useKeyboardLayoutStore.getState().layout).toBeNull();
  });

  it("keeps them too where the browser refuses", async () => {
    stubKeyboard(() => Promise.reject(new DOMException("", "SecurityError")));

    await loadKeyboardLayout();

    expect(useKeyboardLayoutStore.getState().layout).toBeNull();
  });
});
