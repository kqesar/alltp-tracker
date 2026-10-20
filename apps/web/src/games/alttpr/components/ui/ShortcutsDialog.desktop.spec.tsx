import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The Global tab exists in the desktop build alone: the dialog tests the build
// mode inline, so the mode is set before the dialog is first imported
vi.stubEnv("MODE", "desktop");
const tauri = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: tauri.listen }));

const { ShortcutsDialog } = await import(
  "@/games/alttpr/components/ui/ShortcutsDialog"
);
const { useGameStore } = await import("@/games/alttpr/stores/gameStore");
const { DEFAULT_GLOBAL, useGlobalShortcutsStore } = await import(
  "@/games/alttpr/desktop/globalShortcutsStore"
);

const dialog = () => screen.getByRole("dialog", { name: "Keyboard shortcuts" });

beforeEach(() => {
  localStorage.clear();
  tauri.invoke.mockReset();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useGlobalShortcutsStore.setState({
      ...DEFAULT_GLOBAL,
      capturing: false,
      failure: null,
      mechanism: {
        command: "/opt/alltp-tracker",
        configurable: false,
        kind: "hotkeys",
        os: "linux",
        portalVersion: null,
        reason: null,
        session: "x11",
      },
      pending: false,
      report: null,
    });
  });
});

describe("the shortcuts dialog in the desktop app", () => {
  it("has a tab for the tracker's own shortcuts and one for the global ones", () => {
    render(<ShortcutsDialog onClose={() => {}} />);

    const tabs = within(dialog()).getByRole("tablist", { name: "Shortcuts" });
    const [window, global] = within(tabs).getAllByRole("tab");
    expect(window).toHaveAccessibleName("In the tracker");
    expect(global).toHaveAccessibleName("Global");
    expect(window).toHaveAttribute("aria-selected", "true");
    // The tracker's own shortcuts are what it opens on
    expect(screen.getByTestId("shortcuts-enabled")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("In the tracker");
  });

  it("switches to the Global tab, loaded on demand, and back", async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog onClose={() => {}} />);

    await user.click(screen.getByTestId("shortcuts-tab-global"));

    expect(await screen.findByTestId("global-shortcuts-enabled")).toBeVisible();
    expect(screen.queryByTestId("shortcuts-enabled")).toBeNull();
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Global");

    await user.click(screen.getByTestId("shortcuts-tab-window"));
    expect(screen.getByTestId("shortcuts-enabled")).toBeInTheDocument();
    expect(screen.queryByTestId("global-shortcuts-enabled")).toBeNull();
  });

  it("moves between the tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog onClose={() => {}} />);
    act(() => screen.getByTestId("shortcuts-tab-window").focus());

    await user.keyboard("{ArrowRight}");

    expect(screen.getByTestId("shortcuts-tab-global")).toHaveFocus();
    expect(await screen.findByTestId("global-shortcuts-enabled")).toBeVisible();
  });

  it("keeps Reset to the tracker's tab: it brings back the window shortcuts only", async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog onClose={() => {}} />);
    expect(screen.getByTestId("shortcuts-reset")).toBeInTheDocument();

    await user.click(screen.getByTestId("shortcuts-tab-global"));
    await screen.findByTestId("global-shortcuts-enabled");

    expect(screen.queryByTestId("shortcuts-reset")).toBeNull();
  });

  it("clears the status line when the tab changes", async () => {
    const user = userEvent.setup();
    render(<ShortcutsDialog onClose={() => {}} />);
    await user.click(screen.getByTestId("shortcuts-enabled"));
    expect(screen.getByTestId("shortcuts-status")).toHaveTextContent(
      "Keyboard shortcuts off.",
    );

    await user.click(screen.getByTestId("shortcuts-tab-global"));

    expect(screen.getByTestId("shortcuts-status")).toBeEmptyDOMElement();
  });

  it("cancels a capture in the Global tab with Escape before it closes the dialog", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ShortcutsDialog onClose={onClose} />);
    await user.click(screen.getByTestId("shortcuts-tab-global"));
    const key = await screen.findByTestId("shortcut-advance-hookshot");
    act(() => key.focus());
    await user.keyboard("{Enter}");
    expect(key).toHaveAccessibleName(/: press a key$/);

    fireEvent(dialog(), new Event("cancel", { cancelable: true }));

    expect(onClose).not.toHaveBeenCalled();
    expect(key).toHaveAccessibleName("Hookshot forward: no shortcut");
    fireEvent(dialog(), new Event("cancel", { cancelable: true }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
