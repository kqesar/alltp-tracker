import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { SmControls } from "@/games/sm/components/SmControls";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";

// The desktop app's build: the stream tools' chunk is imported behind this
vi.hoisted(() => {
  vi.stubEnv("MODE", "desktop");
});
vi.mock("@/utils/platform", async (actual) => ({
  ...(await actual<typeof import("@/utils/platform")>()),
  isDesktopApp: true,
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  act(() => useGameStore.setState(useGameStore.getInitialState(), true));
});

describe("the stream view in the desktop app", () => {
  it("is a toolbar button in every game, opening the stream tools", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrackerControls />);
    const alttpr = screen.getByTestId("stream-view-button");
    expect(alttpr).toHaveAccessibleName("Stream view");
    await user.click(alttpr);
    expect(
      await screen.findByRole("dialog", { name: "Stream tools" }),
    ).toBeInTheDocument();
    // ALttPR has a run timer to put under the grid, once the stream runs
    expect(screen.getByTestId("stream-tools-switch")).toBeInTheDocument();
    unmount();

    const sm = render(<SmControls />);
    await user.click(screen.getByTestId("sm-stream-view"));
    expect(
      await screen.findByRole("dialog", { name: "Stream tools" }),
    ).toBeInTheDocument();
    sm.unmount();

    render(<Smz3Controls />);
    await user.click(screen.getByTestId("smz3-stream-view"));
    expect(
      await screen.findByRole("dialog", { name: "Stream tools" }),
    ).toBeInTheDocument();
  });

  it("is in More only once the bar folds it away", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrackerControls />);
    await user.click(screen.getByTestId("toolbar-more"));
    expect(screen.queryByTestId("toolbar-more-stream-view")).toBeNull();
    unmount();

    // The bar has folded its secondary actions into More, as on a narrow window
    render(
      <div data-fold="secondary">
        <TrackerControls />
      </div>,
    );
    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(screen.getByTestId("toolbar-more-stream-view"));
    expect(
      await screen.findByRole("dialog", { name: "Stream tools" }),
    ).toBeInTheDocument();
  });

  it("leaves the bar's own buttons out of More until the bar folds them", async () => {
    const user = userEvent.setup();
    render(<TrackerControls />);
    await user.click(screen.getByTestId("toolbar-more"));
    expect(screen.queryByTestId("toolbar-more-export")).toBeNull();
    expect(screen.queryByTestId("toolbar-more-import")).toBeNull();
    expect(screen.queryByTestId("toolbar-more-shortcuts")).toBeNull();
    expect(screen.queryByTestId("toolbar-more-stream-view")).toBeNull();
  });
});
