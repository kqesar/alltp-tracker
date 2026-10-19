import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { SmControls } from "@/games/sm/components/SmControls";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";

// The desktop app's build
vi.mock("@/utils/platform", async (actual) => ({
  ...(await actual<typeof import("@/utils/platform")>()),
  isDesktopApp: true,
}));

beforeEach(() => {
  localStorage.clear();
  act(() => useGameStore.setState(useGameStore.getInitialState(), true));
});

describe("the desktop app", () => {
  it("offers no stream view, which OBS could not load nor keep in step", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TrackerControls />);
    expect(screen.queryByTestId("stream-view-button")).toBeNull();
    await user.click(screen.getByTestId("toolbar-more"));
    expect(screen.queryByTestId("toolbar-more-stream-view")).toBeNull();
    // The rest of the bar stays
    expect(screen.getByTestId("toolbar-more-export")).toBeInTheDocument();
    unmount();
    render(<SmControls />);
    expect(screen.queryByTestId("sm-stream-view")).toBeNull();
    render(<Smz3Controls />);
    expect(screen.queryByTestId("smz3-stream-view")).toBeNull();
  });
});
