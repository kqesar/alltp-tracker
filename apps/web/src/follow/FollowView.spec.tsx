import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FollowView } from "@/follow/FollowView";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { ACTIVE_GAME_KEY } from "@/games/registry";
import { clockNow, setClockOffset } from "@/utils/clock";

/** The relay's side of the socket the view opens. */
class FakeSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close() {}
  receive(data: string) {
    act(() => this.onmessage?.({ data } as MessageEvent));
  }
  drop(code: number) {
    act(() => this.onclose?.({ code } as CloseEvent));
  }
}

let sockets: FakeSocket[];
const open = () => {
  const socket = new FakeSocket();
  sockets.push(socket);
  return socket as unknown as WebSocket;
};

/** ALttPR's run with the hookshot found, as its store saves it. */
const savedWithHookshot = () => {
  useGameStore.getState().setItem("hookshot", true);
  const saved = localStorage.getItem("alltp-tracker-state") ?? "";
  useGameStore.setState(useGameStore.getInitialState(), true);
  localStorage.clear();
  return saved;
};

const frame = (game: string, value: string, sentAt = Date.now()) =>
  JSON.stringify({ game, key: "ignored", sentAt, value });

beforeEach(() => {
  sockets = [];
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
});
afterEach(() => setClockOffset(0));

describe("FollowView", () => {
  it("connects first, then shows the run it receives, read-only", async () => {
    const saved = savedWithHookshot();
    render(<FollowView open={open} />);

    expect(screen.getByTestId("follow-status")).toHaveTextContent("Connecting");
    expect(screen.queryByTestId("follow-board")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Rando Atlas" }),
    ).toBeInTheDocument();

    sockets[0].receive(frame("alttpr", saved, Date.now() + 5000));

    const board = await screen.findByTestId("follow-board");
    expect(board).toHaveAttribute("inert");
    expect(screen.getByTestId("follow-status")).toHaveTextContent("Live");
    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBe("alttpr");
    // The run timer under the grid, on the player's clock
    expect(within(board).getByTestId("stream-timer")).toBeInTheDocument();
    expect(clockNow() - Date.now()).toBeGreaterThanOrEqual(4900);
    expect(document.documentElement.dataset.view).toBe("follow");
  });

  it("follows each change, and takes no key", async () => {
    render(<FollowView open={open} />);
    sockets[0].receive(
      frame("alttpr", localStorage.getItem("alltp-tracker-state") ?? "{}"),
    );
    await screen.findByTestId("follow-board");
    sockets[0].receive(frame("alttpr", savedWithHookshot()));
    await vi.waitFor(() =>
      expect(useGameStore.getState().items.hookshot).toBe(true),
    );

    // A change with a step to undo: Ctrl+Z would undo it on the stream
    // view, where the board is the player's; here nothing listens
    act(() => useGameStore.getState().setItem("hookshot", false));
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          ctrlKey: true,
          key: "z",
        }),
      );
    });
    expect(useGameStore.getState().items.hookshot).toBe(false);
  });

  it("loads the page again on the game a later run is for", async () => {
    const reload = vi.fn();
    render(<FollowView open={open} reload={reload} />);
    sockets[0].receive(frame("alttpr", "{}"));
    await screen.findByTestId("follow-board");

    sockets[0].receive(frame("sm", "{}"));

    expect(localStorage.getItem(ACTIVE_GAME_KEY)).toBe("sm");
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each([
    [4401, "Link expired"],
    [4410, "Stopped"],
    [4503, "Full"],
    [1006, "Reconnecting"],
  ])("says what close code %i means", (code, label) => {
    render(<FollowView open={open} />);

    sockets[0].drop(code);

    expect(screen.getByTestId("follow-status")).toHaveTextContent(label);
    expect(screen.getByRole("status")).toBe(
      screen.getByTestId("follow-status"),
    );
  });
});
