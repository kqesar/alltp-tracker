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
import { RACE_SHARE_NOTE, RACE_SHARE_WHY } from "@/share/raceShare";

// The desktop app's build: its Share dialog imports live follow's section
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
afterEach(() => {
  act(() => {
    useAutotrackStore.setState({ raceChoice: "auto" });
    smAutotrack.useStore.setState({ raceChoice: "on" });
    smz3Autotrack.useStore.setState({ raceChoice: "auto" });
  });
  vi.unstubAllGlobals();
});

const GAMES: [string, () => ReactElement][] = [
  ["A Link to the Past", () => <TrackerControls />],
  ["Super Metroid", () => <SmControls />],
  ["SMZ3", () => <Smz3Controls />],
];

describe("Share in the desktop app during Race Mode", () => {
  it.each(GAMES)(
    "%s: no link, live follow reachable, Export off",
    async (_name, controls) => {
      const user = userEvent.setup();
      act(() => {
        useAutotrackStore.setState({ raceChoice: "on" });
        smAutotrack.useStore.setState({ raceChoice: "on" });
        smz3Autotrack.useStore.setState({ raceChoice: "on" });
      });
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
      render(controls());

      const exportButton = screen.getByRole("button", { name: "Export" });
      expect(exportButton).toHaveAttribute("aria-disabled", "true");
      expect(exportButton).toHaveAccessibleDescription(RACE_SHARE_WHY);
      // Share is the way to live follow's switch, which a race lets through
      const share = screen.getByTestId("share-button");
      expect(share).not.toHaveAttribute("aria-disabled");
      await user.click(share);

      const dialog = await screen.findByRole("dialog", {
        name: "Share this run",
      });
      expect(dialog).toHaveTextContent(RACE_SHARE_NOTE);
      expect(screen.queryByTestId("share-qr")).toBeNull();
      expect(screen.getByTestId("share-copy-again")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(writeText).not.toHaveBeenCalled();
    },
  );

  it("follows Race Mode while the dialog is open: a link once it is off, none again when it comes back", async () => {
    const user = userEvent.setup();
    act(() => useAutotrackStore.setState({ raceChoice: "on" }));
    render(<TrackerControls />);
    await user.click(screen.getByTestId("share-button"));
    const dialog = await screen.findByRole("dialog", {
      name: "Share this run",
    });
    expect(dialog).toHaveTextContent(RACE_SHARE_NOTE);
    expect(screen.queryByTestId("share-qr")).toBeNull();

    // Race Mode off (the player picks Auto, no flag read): the link appears
    act(() => useAutotrackStore.setState({ raceChoice: "auto" }));
    expect(await screen.findByTestId("share-qr")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent(RACE_SHARE_NOTE);
    expect(screen.getByTestId("share-copy-again")).not.toHaveAttribute(
      "aria-disabled",
    );

    // On again: the link goes, and Copy with it
    act(() => useAutotrackStore.setState({ raceChoice: "on" }));
    expect(screen.queryByTestId("share-qr")).toBeNull();
    expect(dialog).toHaveTextContent(RACE_SHARE_NOTE);

    // Off once more: a link made from the run as it is now
    act(() => useAutotrackStore.setState({ raceChoice: "auto" }));
    expect(await screen.findByTestId("share-qr")).toBeInTheDocument();
  });
});
