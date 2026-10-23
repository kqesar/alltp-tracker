import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamSourceView } from "@/follow/StreamSourceView";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

/** The app's side of the socket the view opens. */
class FakeSocket {
  protocols?: string[];
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
const open = (_url: string, protocols?: string[]) => {
  const socket = new FakeSocket();
  socket.protocols = protocols;
  sockets.push(socket);
  return socket as unknown as WebSocket;
};
const latest = () => sockets[sockets.length - 1];

/** ALttPR's run with the hookshot found, as its store saves it. */
const savedWithHookshot = () => {
  useGameStore.getState().setItem("hookshot", true);
  const saved = localStorage.getItem("alltp-tracker-state") ?? "";
  useGameStore.setState(useGameStore.getInitialState(), true);
  localStorage.clear();
  return saved;
};

const frame = (game: string, value: string) =>
  JSON.stringify({ game, key: "ignored", sentAt: Date.now(), value });

const addressIs = (search: string) =>
  window.history.replaceState(null, "", `/${search}`);

beforeEach(() => {
  sockets = [];
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  addressIs("?view=obs&token=abc");
});
afterEach(() => addressIs(""));

describe("StreamSourceView", () => {
  it("draws nothing until the run arrives, then the grid alone, on a transparent page", async () => {
    const saved = savedWithHookshot();
    const { container } = render(<StreamSourceView open={open} />);

    // No banner, no status: a browser source has nobody to read them
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    latest().receive(frame("alttpr", saved));

    const source = await screen.findByTestId("stream-source");
    expect(source).toHaveAttribute("inert");
    expect(within(source).getByTestId("obs-view")).toBeInTheDocument();
    expect(useGameStore.getState().items.hookshot).toBe(true);
    expect(document.documentElement.dataset.view).toBe("obs");
    expect(document.title).toBe("Rando Atlas stream view");
    expect(screen.queryByTestId("stream-timer")).not.toBeInTheDocument();
  });

  it("sends its token as a subprotocol, not in the address a failure would log", () => {
    render(<StreamSourceView open={open} />);

    expect(sockets[0].protocols).toEqual(["alltp.abc"]);
  });

  it("takes the timer and the background from its address, as the site's does", async () => {
    addressIs("?view=obs&token=abc&timer=1&bg=00ff00");
    render(<StreamSourceView open={open} />);

    latest().receive(frame("alttpr", "{}"));

    const stage = await screen.findByTestId("obs-view");
    expect(screen.getByTestId("stream-timer")).toBeInTheDocument();
    expect(stage).toHaveStyle({ backgroundColor: "#00ff00" });
  });

  it("takes no key: the run is the player's", async () => {
    render(<StreamSourceView open={open} />);
    latest().receive(frame("alttpr", "{}"));
    await screen.findByTestId("obs-view");

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

  it("keeps the last grid through a drop and when the app is turned off", async () => {
    render(<StreamSourceView open={open} />);
    latest().receive(frame("alttpr", savedWithHookshot()));
    await screen.findByTestId("stream-source");

    latest().drop(1006);
    expect(screen.getByTestId("stream-source")).toBeInTheDocument();

    // 4410, which ends a phone's view, only drops the source's connection
    latest().drop(4410);
    expect(screen.getByTestId("stream-source")).toBeInTheDocument();
    expect(
      screen.queryByTestId("stream-source-notice"),
    ).not.toBeInTheDocument();
  });

  it("retries after the app was turned off", async () => {
    vi.useFakeTimers();
    try {
      render(<StreamSourceView open={open} />);
      latest().receive(frame("alttpr", "{}"));
      latest().drop(4410);

      act(() => vi.advanceTimersByTime(1000));

      expect(sockets).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says its address is out of date, and shows no stale grid", async () => {
    render(<StreamSourceView open={open} />);
    latest().receive(frame("alttpr", "{}"));
    await screen.findByTestId("stream-source");

    latest().drop(4401);

    expect(screen.queryByTestId("stream-source")).not.toBeInTheDocument();
    const notice = screen.getByTestId("stream-source-notice");
    expect(notice).toHaveTextContent(
      "This address is out of date. Copy the new one from Rando Atlas",
    );
    expect(notice.tagName).toBe("MAIN");
    // The page stays transparent for the scene behind it
    expect(document.documentElement.dataset.view).toBe("obs");
  });

  it("says so too when it never had the right address", () => {
    addressIs("?view=obs&token=");
    render(<StreamSourceView open={open} />);

    latest().drop(4401);

    expect(screen.getByTestId("stream-source-notice")).toBeInTheDocument();
  });

  describe("after the app came back", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const comeBack = async (stale: () => Promise<boolean>) => {
      const reload = vi.fn();
      render(<StreamSourceView open={open} reload={reload} stale={stale} />);
      latest().receive(frame("alttpr", "{}"));
      await act(() => vi.advanceTimersByTimeAsync(0));
      latest().drop(1006);
      await act(() => vi.advanceTimersByTimeAsync(1000));
      latest().receive(frame("alttpr", "{}"));
      await act(() => vi.advanceTimersByTimeAsync(0));
      return reload;
    };

    it("loads the page again when an update replaced its build", async () => {
      const stale = vi.fn(async () => true);

      const reload = await comeBack(stale);

      expect(stale).toHaveBeenCalledOnce();
      expect(reload).toHaveBeenCalledOnce();
    });

    it("keeps the page when the app serves the build it runs", async () => {
      const stale = vi.fn(async () => false);

      const reload = await comeBack(stale);

      expect(stale).toHaveBeenCalledOnce();
      expect(reload).not.toHaveBeenCalled();
    });

    it("does not check a build when the first connection succeeds", async () => {
      const stale = vi.fn(async () => true);
      const reload = vi.fn();
      render(<StreamSourceView open={open} reload={reload} stale={stale} />);

      latest().receive(frame("alttpr", "{}"));
      await act(() => vi.advanceTimersByTimeAsync(0));
      latest().receive(frame("alttpr", "{}"));
      await act(() => vi.advanceTimersByTimeAsync(0));

      expect(stale).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });
  });
});
