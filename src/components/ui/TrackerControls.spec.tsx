import { fireEvent, render, screen, within } from "@testing-library/react";
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
  future: [] as unknown[],
  loadProgress: vi.fn(),
  mapLayout: "side-by-side" as "side-by-side" | "stacked",
  past: [] as unknown[],
  presetId: "open",
  redo: vi.fn(),
  reset,
  setMapLayout,
  settings: {
    entranceShuffle: "none" as const,
    goal: "ganon" as const,
    keysanity: false,
    mode: "open" as const,
  },
  undo: vi.fn(),
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

/** Choose a file in the hidden import input, as the file picker would. */
const chooseFile = (text: string) =>
  fireEvent.change(screen.getByTestId("import-file"), {
    target: { files: [new File([text], "save.json")] },
  });

describe("TrackerControls import", () => {
  it("asks before replacing progress, then loads the save and says so", async () => {
    render(<TrackerControls />);

    chooseFile(JSON.stringify({ items: { hookshot: true } }));

    const confirm = await screen.findByRole("dialog", {
      name: "Import this save?",
    });
    expect(fakeState.loadProgress).not.toHaveBeenCalled();

    fireEvent.click(
      within(confirm).getByRole("button", { name: "Replace progress" }),
    );

    expect(fakeState.loadProgress).toHaveBeenCalledWith({
      items: { hookshot: true },
    });
    expect(screen.getByTestId("controls-status")).toHaveTextContent(
      "Save imported.",
    );
  });

  it("keeps the progress when the import is cancelled", async () => {
    render(<TrackerControls />);

    chooseFile(JSON.stringify({ items: { hookshot: true } }));
    await screen.findByRole("dialog", { name: "Import this save?" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(fakeState.loadProgress).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains why a file was refused and loads nothing", async () => {
    render(<TrackerControls />);

    chooseFile("{}");

    const dialog = await screen.findByRole("dialog", { name: "Import failed" });
    expect(dialog).toHaveTextContent("This file is not a tracker save.");
    expect(fakeState.loadProgress).not.toHaveBeenCalled();
  });
});

describe("TrackerControls export", () => {
  it("downloads through a link in the page and frees the file URL afterwards", () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:save");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let linkWasInPage = false;
    let fileName = "";
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        linkWasInPage = this.isConnected;
        fileName = this.download;
      });

    render(<TrackerControls />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(linkWasInPage).toBe(true);
    expect(fileName).toMatch(/^alltp-tracker-save-\d{4}-\d{2}-\d{2}\.json$/);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:save");

    click.mockRestore();
    vi.useRealTimers();
  });
});

describe("TrackerControls undo and redo", () => {
  it("disables both buttons while there is nothing to undo or redo", () => {
    render(<TrackerControls />);

    expect(screen.getByTestId("undo")).toBeDisabled();
    expect(screen.getByTestId("redo")).toBeDisabled();
  });

  it("undoes and redoes from the toolbar, with the shortcuts announced", () => {
    fakeState.past = [{}];
    fakeState.future = [{}];
    render(<TrackerControls />);

    fireEvent.click(screen.getByTestId("undo"));
    fireEvent.click(screen.getByTestId("redo"));

    expect(fakeState.undo).toHaveBeenCalledTimes(1);
    expect(fakeState.redo).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("undo")).toHaveAccessibleName("Undo");
    expect(screen.getByTestId("undo")).toHaveAttribute(
      "aria-keyshortcuts",
      "Control+Z Meta+Z",
    );
    fakeState.past = [];
    fakeState.future = [];
  });
});
