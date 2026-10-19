import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** How many times the dialog's module was fetched (evaluated) */
let fetches = 0;

/** The button's module of the running test, once imported. */
let button:
  | typeof import("@/games/alttpr/components/ui/ShortcutsButton")
  | undefined;

/** A fresh copy of the button's module, its dialog not fetched yet. */
const freshButton = async () => {
  button = await import("@/games/alttpr/components/ui/ShortcutsButton");
  return button;
};

/**
 * How long to wait for the dialog's code: each test fetches its module graph
 * afresh (resetModules), the alltpr pack included through the keymap's
 * dungeon names, which a busy machine evaluates in well over the default
 * second.
 */
const LOADED = { timeout: 10_000 };

describe("ShortcutsButton's dialog code", () => {
  beforeEach(() => {
    fetches = 0;
    vi.resetModules();
    vi.doMock(
      "@/games/alttpr/components/ui/ShortcutsDialog",
      async (importOriginal) => {
        fetches++;
        return importOriginal();
      },
    );
  });

  afterEach(async () => {
    // A fetch the test started lands before the next test mocks the dialog
    // afresh: landing late, it would answer that test's own fetches
    await button?.preloadShortcutsDialog().catch(() => {});
    button = undefined;
    vi.doUnmock("@/games/alttpr/components/ui/ShortcutsDialog");
  });

  it("is fetched once, as soon as a pointer or focus reaches the button", async () => {
    const { ShortcutsButton } = await freshButton();
    render(<ShortcutsButton />);
    const button = screen.getByTestId("shortcuts-button");
    expect(fetches).toBe(0);

    fireEvent.pointerEnter(button);
    await waitFor(() => expect(fetches).toBe(1));
    fireEvent.focus(button);
    fireEvent.pointerDown(button);
    await userEvent.click(button);

    expect(
      await screen.findByRole("dialog", { name: "Keyboard shortcuts" }, LOADED),
    ).toBeInTheDocument();
    expect(fetches).toBe(1);
  });

  it("is fetched once the page is idle, with no pointer or focus near", async () => {
    const idle: IdleRequestCallback[] = [];
    vi.stubGlobal("requestIdleCallback", (callback: IdleRequestCallback) => {
      idle.push(callback);
      return idle.length;
    });
    vi.stubGlobal("cancelIdleCallback", vi.fn());
    try {
      const { ShortcutsButton } = await freshButton();
      const { unmount } = render(<ShortcutsButton />);
      expect(fetches).toBe(0);

      for (const callback of idle) {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }

      await waitFor(() => expect(fetches).toBe(1));
      // While the stubs still stand: unmounting cancels the idle callback
      unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back on a timer where there is no idle callback (Safari)", async () => {
    vi.useFakeTimers();
    try {
      const { ShortcutsButton } = await freshButton();
      render(<ShortcutsButton />);

      await act(() => vi.advanceTimersByTimeAsync(3000));

      expect(fetches).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens in the same render as the click once its code is there", async () => {
    const { preloadShortcutsDialog, ShortcutsButton } = await freshButton();
    await preloadShortcutsDialog();
    render(<ShortcutsButton />);

    fireEvent.click(screen.getByTestId("shortcuts-button"));

    // No waiting: a suspended boundary would only show it 300 ms later
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
  });

  it("is fetched from the More menu's item too, when it takes focus", async () => {
    const { ShortcutsButton } = await freshButton();
    render(<ShortcutsButton variant="menu" />);

    act(() => screen.getByTestId("toolbar-more-shortcuts").focus());

    await waitFor(() => expect(fetches).toBe(1));
  });

  it("offers a reload when it cannot be fetched, and tries again later", async () => {
    vi.doMock("@/games/alttpr/components/ui/ShortcutsDialog", () => {
      fetches++;
      throw new Error("This chunk is gone");
    });
    const { preloadShortcutsDialog, ShortcutsButton } = await freshButton();
    const first = preloadShortcutsDialog();
    await expect(first).rejects.toThrow();
    // A failed fetch is forgotten: the next try fetches again
    const second = preloadShortcutsDialog();
    expect(second).not.toBe(first);
    await expect(second).rejects.toThrow();
    const user = userEvent.setup();
    render(<ShortcutsButton />);

    await user.click(screen.getByTestId("shortcuts-button"));

    const dialog = await screen.findByRole("dialog", {
      name: "Keyboard shortcuts",
    });
    expect(dialog).toHaveTextContent("could not be loaded");
    expect(screen.getByRole("button", { name: "Reload" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
