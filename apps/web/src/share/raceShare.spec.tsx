import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrackerControls } from "@/games/alttpr/components/ui/TrackerControls";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { smAutotrack } from "@/games/sm/autotrack/store";
import { SmControls } from "@/games/sm/components/SmControls";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { Smz3Controls } from "@/games/smz3/components/Smz3Controls";
import { RACE_SHARE_WHY } from "@/share/raceShare";

type Game = {
  name: string;
  controls: () => ReactElement;
  /** The game's autotracking store, to set Race Mode on it */
  setAutotrack: (state: Record<string, unknown>) => void;
  /** Race Mode on, and off, as the player chooses them */
  on: Record<string, unknown>;
  off: Record<string, unknown>;
  /** Autotracking about to start with nothing read, where the game has a flag */
  pending: Record<string, unknown> | null;
  status: string;
};

const GAMES: Game[] = [
  {
    controls: () => <TrackerControls />,
    name: "A Link to the Past",
    off: { raceChoice: "auto" },
    on: { raceChoice: "on" },
    pending: { connectOnStart: true, raceChoice: "auto" },
    setAutotrack: (state) => useAutotrackStore.setState(state),
    status: "controls-status",
  },
  {
    controls: () => <SmControls />,
    name: "Super Metroid",
    off: { raceChoice: "off" },
    on: { raceChoice: "on" },
    pending: null,
    setAutotrack: (state) => smAutotrack.useStore.setState(state),
    status: "sm-status",
  },
  {
    controls: () => <Smz3Controls />,
    name: "SMZ3",
    off: { raceChoice: "auto" },
    on: { raceChoice: "on" },
    pending: { connectOnStart: true, raceChoice: "auto" },
    setAutotrack: (state) => smz3Autotrack.useStore.setState(state),
    status: "smz3-status",
  },
];

const exportButton = () => screen.getByRole("button", { name: "Export" });
const shareButton = () => screen.getByTestId("share-button");

describe.each(GAMES)("$name toolbar and Race Mode", (game) => {
  const created = vi.fn(() => "blob:save");
  const download = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useGameStore.setState(useGameStore.getInitialState(), true);
      game.setAutotrack({ connectOnStart: false, ...game.off });
    });
    created.mockClear();
    download.mockClear();
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(download);
  });
  afterEach(() => vi.restoreAllMocks());

  it("exports and shares outside Race Mode", async () => {
    const user = userEvent.setup();
    render(game.controls());

    expect(exportButton()).not.toHaveAttribute("aria-disabled");
    expect(shareButton()).not.toHaveAttribute("aria-disabled");
    await user.click(exportButton());
    expect(download).toHaveBeenCalledOnce();
    await user.click(shareButton());
    expect(
      await screen.findByRole("dialog", { name: "Share this run" }),
    ).toBeInTheDocument();
  });

  it("turns both off while Race Mode is on, and says why", async () => {
    const user = userEvent.setup();
    act(() => game.setAutotrack(game.on));
    render(game.controls());

    for (const button of [exportButton(), shareButton()]) {
      // Off, yet in the tab order: a screen reader finds the reason there
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).not.toBeDisabled();
      expect(button).toHaveAccessibleDescription(RACE_SHARE_WHY);
    }
    await user.click(exportButton());
    await user.click(shareButton());
    expect(download).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId(game.status)).toHaveTextContent(RACE_SHARE_WHY);
  });

  it("says the refusal again at every click, in the quiet tone", async () => {
    const user = userEvent.setup();
    act(() => game.setAutotrack(game.on));
    render(game.controls());

    await user.click(exportButton());
    const status = screen.getByTestId(game.status);
    expect(status).toHaveAttribute("data-tone", "refused");
    const first = status.firstElementChild;
    expect(first).toHaveTextContent(RACE_SHARE_WHY);
    await user.click(shareButton());

    // A new node in the live region: a screen reader says it once more
    expect(status.firstElementChild).toHaveTextContent(RACE_SHARE_WHY);
    expect(status.firstElementChild).not.toBe(first);
  });

  it("brings both back at once when Race Mode goes off", async () => {
    const user = userEvent.setup();
    act(() => game.setAutotrack(game.on));
    render(game.controls());
    expect(exportButton()).toHaveAttribute("aria-disabled", "true");

    act(() => game.setAutotrack(game.off));

    expect(exportButton()).not.toHaveAttribute("aria-disabled");
    expect(shareButton()).not.toHaveAttribute("aria-disabled");
    expect(exportButton()).not.toHaveAccessibleDescription(RACE_SHARE_WHY);
    await user.click(exportButton());
    expect(download).toHaveBeenCalledOnce();
  });

  it.runIf(game.pending)(
    "stays off until the game has told it is no race",
    async () => {
      act(() => game.setAutotrack(game.pending ?? {}));
      render(game.controls());
      expect(exportButton()).toHaveAttribute("aria-disabled", "true");
      expect(shareButton()).toHaveAttribute("aria-disabled", "true");

      // The race flag is read and says no: the run is no race's
      act(() =>
        game.setAutotrack({
          connectOnStart: true,
          reading: { race: false },
        }),
      );

      expect(exportButton()).not.toHaveAttribute("aria-disabled");
      expect(shareButton()).not.toHaveAttribute("aria-disabled");
    },
  );
});

describe("the More menu of A Link to the Past", () => {
  const download = vi.fn();
  beforeEach(() => {
    localStorage.clear();
    act(() => useGameStore.setState(useGameStore.getInitialState(), true));
    download.mockClear();
    URL.createObjectURL = vi.fn(() => "blob:save");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(download);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    act(() => useAutotrackStore.setState({ raceChoice: "auto" }));
  });

  it("keeps Export and Share in the menu, off and described, in a race", async () => {
    const user = userEvent.setup();
    act(() => useAutotrackStore.setState({ raceChoice: "on" }));
    render(<TrackerControls />);
    await user.click(screen.getByTestId("toolbar-more"));

    for (const id of ["toolbar-more-export", "toolbar-more-share"]) {
      const item = screen.getByTestId(id);
      expect(item).toHaveAttribute("role", "menuitem");
      expect(item).toHaveAttribute("aria-disabled", "true");
      expect(item).toHaveAccessibleDescription(RACE_SHARE_WHY);
    }
    await user.click(screen.getByTestId("toolbar-more-export"));
    expect(download).not.toHaveBeenCalled();
    expect(screen.getByTestId("controls-status")).toHaveTextContent(
      RACE_SHARE_WHY,
    );
    // The menu closed on the choice: open it again for the Share item
    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(screen.getByTestId("toolbar-more-share"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exports from the menu outside a race", async () => {
    const user = userEvent.setup();
    render(<TrackerControls />);
    await user.click(screen.getByTestId("toolbar-more"));

    await user.click(screen.getByTestId("toolbar-more-export"));

    expect(download).toHaveBeenCalledOnce();
  });
});
