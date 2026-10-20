import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The desktop app's build, whose Vite mode lazily brings the menu item in
const tauri = vi.hoisted(() => {
  vi.stubEnv("MODE", "desktop");
  return { invoke: vi.fn() };
});
vi.mock("@tauri-apps/api/core", () => ({ invoke: tauri.invoke }));
vi.mock("@/utils/platform", async (actual) => ({
  ...(await actual<typeof import("@/utils/platform")>()),
  isDesktopApp: true,
}));

const { useAppMenuStore } = await import("@/desktop/appMenu");
const { TrackerControls } = await import(
  "@/games/alttpr/components/ui/TrackerControls"
);
const { useGameStore } = await import("@/games/alttpr/stores/gameStore");

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  act(() => useGameStore.setState(useGameStore.getInitialState(), true));
  useAppMenuStore.setState(useAppMenuStore.getInitialState(), true);
});

describe("the More menu of an AppImage", () => {
  it("holds the application menu item alone while the bar shows its own buttons", async () => {
    const user = userEvent.setup();
    useAppMenuStore.setState({ state: { added: false, available: true } });
    render(<TrackerControls />);

    await user.click(screen.getByTestId("toolbar-more"));

    const item = await screen.findByTestId("toolbar-more-app-menu");
    expect(item).toHaveRole("menuitem");
    expect(item).toHaveAccessibleName("Add to application menu");
    expect(screen.queryByTestId("toolbar-more-export")).toBeNull();
  });

  it("changes the entry from the menu and says so in the toolbar's status", async () => {
    const user = userEvent.setup();
    tauri.invoke.mockResolvedValue({ added: true, available: true });
    useAppMenuStore.setState({ state: { added: false, available: true } });
    render(<TrackerControls />);
    await user.click(screen.getByTestId("toolbar-more"));

    await user.click(await screen.findByTestId("toolbar-more-app-menu"));

    expect(tauri.invoke).toHaveBeenCalledWith("app_menu_set", { added: true });
    expect(await screen.findByTestId("controls-status")).toHaveTextContent(
      "Added to the application menu.",
    );
  });

  it("adds no item where the app cannot offer the entry", async () => {
    const user = userEvent.setup();
    useAppMenuStore.setState({ state: { added: false, available: false } });
    render(<TrackerControls />);

    await user.click(screen.getByTestId("toolbar-more"));

    expect(screen.queryByTestId("toolbar-more-app-menu")).toBeNull();
  });
});

describe("the first-launch notice, in each game", () => {
  it.each([
    ["A Link to the Past", () => import("@/games/alttpr/App")],
    ["Super Metroid", () => import("@/games/sm/SmApp")],
    ["SMZ3", () => import("@/games/smz3/Smz3App")],
  ])("%s asks among its notices", async (_game, load) => {
    useAppMenuStore.setState({ state: { added: false, available: true } });
    const { default: Game } = await load();

    render(<Game />);

    expect(await screen.findByTestId("app-menu-prompt")).toHaveTextContent(
      "Add ALLTP Tracker to your application menu?",
    );
  });
});
