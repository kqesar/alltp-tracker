import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { TrackerControls } from "@/components/ui/TrackerControls";
import { useGameStore } from "@/stores/gameStore";

vi.mock("@/stores/gameStore", () => ({ useGameStore: vi.fn() }));

const reset = vi.fn();
const setMapLayout = vi.fn();
const fakeState = {
  // PresetSelector is rendered inside TrackerControls, so its store fields
  // are needed too.
  applyPreset: vi.fn(),
  exportState: vi.fn(() => "{}"),
  importState: vi.fn(() => true),
  mapLayout: "side-by-side" as "side-by-side" | "stacked",
  presetId: "open",
  reset,
  setMapLayout,
  settings: {
    entranceShuffle: "none" as const,
    goal: "ganon" as const,
    keysanity: false,
    mode: "open" as const,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  (useGameStore as unknown as Mock).mockImplementation(
    (selector: (state: typeof fakeState) => unknown) => selector(fakeState),
  );
});

describe("TrackerControls", () => {
  it("opens a confirmation dialog instead of resetting immediately", () => {
    render(<TrackerControls />);

    fireEvent.click(screen.getByRole("button", { name: "New game" }));

    expect(
      screen.getByRole("dialog", { name: /start a new game/i }),
    ).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();
  });

  it("resets only after confirming", () => {
    render(<TrackerControls />);

    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    // Two "New game" buttons now exist: [0] the toolbar trigger, [1] the
    // confirm button inside the dialog.
    const confirmButton = screen.getAllByRole("button", {
      name: "New game",
    })[1];
    fireEvent.click(confirmButton);

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not reset when cancelling", () => {
    render(<TrackerControls />);

    fireEvent.click(screen.getByRole("button", { name: "New game" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(reset).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers to stack the map while it is side by side", () => {
    render(<TrackerControls />);

    const toggle = screen.getByRole("button", { name: /map/i });
    expect(toggle).toHaveTextContent("Stacked map");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    expect(setMapLayout).toHaveBeenCalledWith("stacked");
  });

  it("offers to unstack the map once it is stacked", () => {
    fakeState.mapLayout = "stacked";
    render(<TrackerControls />);

    const toggle = screen.getByRole("button", { name: /map/i });
    expect(toggle).toHaveTextContent("Side-by-side map");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(toggle);
    expect(setMapLayout).toHaveBeenCalledWith("side-by-side");

    fakeState.mapLayout = "side-by-side";
  });
});
