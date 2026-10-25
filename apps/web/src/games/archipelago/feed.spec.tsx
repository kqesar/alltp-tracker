// The board's second series against the recorded room: the feed, hints,
// players, what was sent, the countdown's timer, "While you were away" and
// the stream view's feed.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StreamUrlDialog } from "@/components/ui/StreamUrlDialog";
import { ArchipelagoObsView } from "@/games/archipelago/ArchipelagoObsView";
import { ApRunTimer } from "@/games/archipelago/components/ApRunTimer";
import { AwayNotice } from "@/games/archipelago/components/AwayNotice";
import { ChecksPanel } from "@/games/archipelago/components/ChecksPanel";
import { FeedPanel } from "@/games/archipelago/components/FeedPanel";
import { HintsPanel } from "@/games/archipelago/components/HintsPanel";
import { PlayersPanel } from "@/games/archipelago/components/PlayersPanel";
import { SidePanel } from "@/games/archipelago/components/SidePanel";
import {
  connect,
  saveRoom,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";
import { useApNamesStore } from "@/games/archipelago/names";
import {
  AP_SAVE_VERSION,
  AP_STORAGE_KEY,
  type ApFeedEntry,
  type ApRoom,
  freshRun,
  migrateRun,
  useArchipelagoStore,
} from "@/games/archipelago/store";

/** The recorded room's run of Link. */
const LINK: ApRoom = {
  checksum: "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4",
  game: "A Link to the Past",
  generatorVersion: "0.6.8",
  seedName: "72844992796894532502",
  slot: 1,
  slotName: "Link",
  team: 0,
};

const run = () => useArchipelagoStore.getState();

beforeEach(() => {
  localStorage.clear();
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
  useApNamesStore.setState({ groups: null, names: null });
  // A fresh name cache per spec
  vi.stubGlobal("indexedDB", new IDBFactory());
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
  vi.unstubAllGlobals();
});

/** Connect to the recorded room and let the game go on. */
const playedRoom = async () => {
  const room = startRoom();
  saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
  await connect();
  await vi.waitFor(() => expect(run().room?.slotName).toBe("Link"));
  act(() => room.playOn());
  await vi.waitFor(() => expect(run().feed.length).toBe(14), {
    timeout: 3000,
  });
  return room;
};

const lineTexts = () =>
  screen.getAllByTestId("ap-feed-line").map((line) => line.textContent);

describe("the feed", () => {
  it("folds the room into lines, names every game's ids, and keeps the slot's by default", async () => {
    await playedRoom();
    // Other games' names load as lines need them: APQuest, SMZ3
    await vi.waitFor(
      () =>
        expect(
          run()
            .feed[1]?.parts.map((p) => p.text)
            .join(""),
        ).toBe("Quester sent Bombs (3) to Link (Top Middle Chest)"),
      { timeout: 3000 },
    );
    render(<FeedPanel />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "off");
    expect(log).toHaveAccessibleName("Feed");
    // Involving me: newest first, the room's joins and parts left out
    expect(lineTexts()).toHaveLength(9);
    expect(lineTexts()[0]).toBe("Quester released 4 items, 2 for you");
    expect(screen.getByTestId("ap-feed-scope-mine")).toBeChecked();
    fireEvent.click(screen.getByTestId("ap-feed-scope-room"));
    expect(run().prefs.feedScope).toBe("room");
    expect(lineTexts()).toHaveLength(14);
    expect(lineTexts()[0]).toBe("Left: Quester, Link");
    // No chat ever reaches it
    expect(screen.getByTestId("ap-feed")).not.toHaveTextContent("!hint");
  });

  it("says nothing it held already, and each progression item received once asked", () => {
    const entry = (seq: number, flags: number): ApFeedEntry => ({
      flags,
      kind: "item",
      mine: true,
      parts: [{ kind: "text", text: `Line ${seq}` }],
      received: true,
      seq,
    });
    act(() =>
      run().apply({
        ...freshRun(),
        feed: [entry(0, 1)],
        room: LINK,
        updatedAt: 1,
      }),
    );
    render(<FeedPanel />);
    const announcer = screen.getByTestId("ap-feed-announcer");
    expect(announcer).toHaveTextContent("");
    act(() =>
      run().apply({
        ...freshRun(),
        feed: [entry(0, 1), entry(1, 1)],
        room: LINK,
        updatedAt: 2,
      }),
    );
    // Off by default
    expect(announcer).toHaveTextContent("");
    fireEvent.click(screen.getByTestId("ap-feed-announce"));
    act(() =>
      run().apply({
        ...freshRun(),
        feed: [entry(0, 1), entry(1, 1), entry(2, 0), entry(3, 1)],
        room: LINK,
        updatedAt: 3,
      }),
    );
    // A filler item is not said; a progression one is, once
    expect(announcer).toHaveAttribute("role", "status");
    expect(announcer).toHaveTextContent(/^Line 3$/);
  });

  it("shows the last five lines involving the slot on stream, never a hint, when asked", async () => {
    await playedRoom();
    const { rerender } = render(<ArchipelagoObsView background={null} />);
    expect(screen.queryByTestId("ap-obs-feed")).toBeNull();
    rerender(<ArchipelagoObsView background={null} feed />);
    const lines = within(screen.getByTestId("ap-obs-feed")).getAllByRole(
      "listitem",
    );
    expect(lines.map((line) => line.textContent)).toHaveLength(5);
    expect(screen.getByTestId("ap-obs-feed")).not.toHaveTextContent("is at");
    expect(lines.at(-1)).toHaveTextContent(
      "Quester released 4 items, 2 for you",
    );
  });
});

describe("the stream view's address", () => {
  it("adds the feed only once the player ticks it", () => {
    render(<StreamUrlDialog feedOption onClose={() => {}} testIdPrefix="ap" />);
    const url = screen.getByTestId("ap-stream-url");
    expect(url.textContent).not.toContain("feed");
    const feed = screen.getByTestId("ap-stream-feed");
    expect(feed).not.toBeChecked();
    expect(feed).toHaveAccessibleName(/last 5 lines involving you/);
    fireEvent.click(feed);
    expect(url.textContent).toMatch(/[?&]feed=1$/);
    // No timer option unless the game has one
    expect(screen.queryByTestId("ap-stream-timer")).toBeNull();
  });

  it("adds the run timer once ticked, and the view draws it under the grid", async () => {
    render(
      <StreamUrlDialog
        feedOption
        onClose={() => {}}
        testIdPrefix="ap"
        timerOption
      />,
    );
    fireEvent.click(screen.getByLabelText("Show the run timer under the grid"));
    expect(screen.getByTestId("ap-stream-url").textContent).toMatch(
      /[?&]timer=1$/,
    );
    act(() => run().apply({ ...freshRun(), room: LINK, updatedAt: 1 }));
    act(() => run().startTimer(Date.now() - 61_000));
    render(<ArchipelagoObsView background={null} timer />);
    expect(screen.getByTestId("stream-timer")).toHaveAccessibleName(
      /^Run timer: 1:0\d, running$/,
    );
    // The skin's seven columns, once its chunk arrived
    await vi.waitFor(() =>
      expect(screen.getByTestId("obs-view")).toHaveStyle({
        "--obs-columns": "7",
      }),
    );
  });
});

describe("hints, players and what was sent", () => {
  it("lists the slot's hints in two lists, statuses in words, with the points", async () => {
    await playedRoom();
    await vi.waitFor(() => expect(run().hints).toHaveLength(2));
    render(<HintsPanel />);
    expect(screen.getByTestId("ap-hint-points")).toHaveTextContent(
      "4 hint points · a hint costs 24",
    );
    const hints = screen.getAllByTestId("ap-hint");
    expect(hints.map((hint) => hint.textContent)).toEqual([
      "FoundPiece of Heart at Bottom Left Chest in Quester's world",
      "UnspecifiedFirerod for Hybrid Hero at Swamp Palace - Waterway Pot Key",
    ]);
  });

  it("says each player's status in words, and the slot's settings outside a race", async () => {
    await playedRoom();
    await vi.waitFor(() =>
      expect(run().players.find((p) => p.slot === 4)?.status).toBe(30),
    );
    render(<PlayersPanel />);
    expect(screen.getByTestId("ap-player-1")).toHaveTextContent(
      "Link (you)A Link to the PastConnected",
    );
    expect(screen.getByTestId("ap-player-4")).toHaveTextContent("Goal");
    expect(screen.getByTestId("ap-player-2")).toHaveTextContent(
      "Not connected",
    );
    expect(screen.getByTestId("ap-slot-data")).toHaveTextContent(
      "mm_medalionEther",
    );
    act(() => useArchipelagoStore.setState({ raceMode: true }));
    expect(screen.queryByTestId("ap-slot-data")).toBeNull();
    expect(screen.getByTestId("ap-slot-data-race")).toBeInTheDocument();
  });

  it("says under each checked location what it held, and for whom", async () => {
    await playedRoom();
    await vi.waitFor(() => expect(run().sent).toHaveLength(4));
    await vi.waitFor(() =>
      expect(run().sent.map((s) => s.item)).toContain("ETank"),
    );
    act(() => run().setHideChecked(false));
    render(<ChecksPanel />);
    await vi.waitFor(() =>
      expect(screen.getAllByTestId("ap-check-held").length).toBeGreaterThan(0),
    );
    const held = screen
      .getAllByTestId("ap-check-held")
      .map((element) => element.textContent);
    expect(held).toContain(", held E Tank for Hybrid Hero");
    expect(held).toContain(", held Small Key (Ice Palace)");
  });

  it("switches the side panel's tabs and keeps the choice", () => {
    act(() =>
      run().apply({
        ...freshRun(),
        hints: [
          {
            entrance: "",
            finder: "Sam",
            flags: 1,
            forMe: true,
            item: "Hookshot",
            location: "Here",
            receiver: "Link",
            status: "priority",
          },
        ],
        room: LINK,
        updatedAt: 1,
      }),
    );
    render(<SidePanel />);
    expect(screen.getByRole("tab", { name: "Hints (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("ap-side-tab-players"));
    expect(run().prefs.side).toBe("players");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Players");
    expect(screen.getByTestId("ap-players")).toBeInTheDocument();
  });
});

describe("the countdown's timer", () => {
  it("starts an idle timer when the room's countdown reaches 0", async () => {
    await playedRoom();
    expect(run().timer.startedAt).not.toBeNull();
  });

  it("stops at the slot's own goal as the room says it, and a reload shows that time", async () => {
    const room = await playedRoom();
    // Quester's goal (slot 4, 30) went by in the recording: still running
    expect(run().timer.startedAt).not.toBeNull();
    const before = Date.now();
    act(() =>
      room.network.last.deliver([
        [
          {
            cmd: "SetReply",
            key: "_read_client_status_0_1",
            original_value: 20,
            slot: 1,
            value: 30,
          },
        ],
      ]),
    );
    const { timer } = run();
    expect(timer.finished).toBe(true);
    expect(timer.startedAt).toBeNull();
    expect(timer.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(timer.elapsedMs).toBeLessThanOrEqual(Date.now() - before + 5000);
    // Saved with the run: a reload draws the stopped time
    const saved = localStorage.getItem(AP_STORAGE_KEY) ?? "";
    useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
    localStorage.setItem(AP_STORAGE_KEY, saved);
    await useArchipelagoStore.persist.rehydrate();
    expect(run().timer).toEqual(timer);
  });

  it("stops nothing that is not running, nor when the player turned it off", () => {
    act(() => run().goalReached(5000));
    expect(run().timer.finished).toBe(false);
    act(() => run().startTimer(1000));
    act(() => run().setPref("countdownTimer", false));
    act(() => run().goalReached(5000));
    expect(run().timer.startedAt).toBe(1000);
  });

  it("starts nothing when the player turned it off", async () => {
    act(() => run().setPref("countdownTimer", false));
    await playedRoom();
    expect(run().timer.startedAt).toBeNull();
  });
});

describe("while you were away", () => {
  it("lists the items received past the board's last index, with sender and location", async () => {
    // The board knew two items; the room resends five on connecting
    act(() =>
      run().apply({ ...freshRun(), received: 2, room: LINK, updatedAt: 1 }),
    );
    startRoom({ client: "tracker-refresh" });
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    render(<AwayNotice />);
    await connect();
    await vi.waitFor(
      () =>
        expect(screen.getByTestId("ap-away")).toHaveTextContent(
          "While you were away: 3 items",
        ),
      { timeout: 3000 },
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-away")).toHaveTextContent(
        "Piece of Heart from Quester (Bottom Left Chest)",
      ),
    );
    expect(screen.getByTestId("ap-away-region")).toHaveAttribute(
      "role",
      "status",
    );
    fireEvent.click(screen.getByTestId("ap-away-dismiss"));
    expect(screen.queryByTestId("ap-away")).toBeNull();
  });

  it("says nothing of a slot's first items, which come at index 0 after Connected", async () => {
    await playedRoom();
    expect(run().received).toBeGreaterThan(0);
    expect(useApConnectionStore.getState().away).toBeNull();
  });

  it("says nothing for another run, or a first connection", async () => {
    act(() =>
      run().apply({
        ...freshRun(),
        received: 0,
        room: { ...LINK, seedName: "other" },
        updatedAt: 1,
      }),
    );
    startRoom({ client: "tracker-refresh" });
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    await vi.waitFor(() => expect(run().room?.seedName).toBe(LINK.seedName));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(useApConnectionStore.getState().away).toBeNull();
  });
});

describe("the board's run timer and the away card", () => {
  it("is the shared timer over the run's, its countdown switch a pref", () => {
    render(<ApRunTimer />);
    // A room has no game clock of its own: no clock to choose
    expect(screen.queryByTestId("run-timer-clock")).toBeNull();
    fireEvent.click(screen.getByTestId("run-timer-start"));
    expect(run().timer.startedAt).not.toBeNull();
    fireEvent.click(screen.getByTestId("run-timer-pause"));
    expect(run().timer.startedAt).toBeNull();
    fireEvent.click(screen.getByTestId("run-timer-reset"));
    expect(run().timer.elapsedMs).toBe(0);
    const auto = screen.getByLabelText(
      "Start at the room's countdown, stop at your goal",
    );
    expect(auto).toBeChecked();
    fireEvent.click(auto);
    expect(run().prefs.countdownTimer).toBe(false);
  });

  it("lists a dozen items and counts the rest", () => {
    const item = {
      flags: 0,
      item: "Rupee",
      location: "Here",
      sender: "Sam",
    };
    act(() => useApConnectionStore.setState({ away: Array(15).fill(item) }));
    render(<AwayNotice />);
    expect(
      within(screen.getByTestId("ap-away")).getAllByRole("listitem"),
    ).toHaveLength(12);
    expect(screen.getByTestId("ap-away")).toHaveTextContent(
      "and 3 more, in the items",
    );
  });
});

describe("the saved run, version 2", () => {
  it("brings a version 1 run up: the new fields empty, the prefs kept", async () => {
    const v1 = {
      checked: [1],
      items: [{ count: 1, flags: 1, name: "Hookshot" }],
      missing: [2],
      players: [{ game: "A Link to the Past", name: "Link", slot: 1 }],
      prefs: { hideChecked: true },
      raceMode: false,
      received: 1,
      room: LINK,
      updatedAt: 5,
    };
    localStorage.setItem(
      AP_STORAGE_KEY,
      JSON.stringify({ state: v1, version: 1 }),
    );
    await useArchipelagoStore.persist.rehydrate();
    expect(run().room).toEqual(LINK);
    expect(run().prefs).toEqual({
      announce: false,
      countdownTimer: true,
      feedScope: "mine",
      hideChecked: true,
      side: "checks",
    });
    expect(run().players[0]?.status).toBeNull();
    expect(run().feed).toEqual([]);
    expect(run().timer.startedAt).toBeNull();
    // What is not an object passes through, for the schema to refuse
    expect(migrateRun(null, 1)).toBeNull();
    expect(migrateRun({ players: 1, prefs: 2 }, 1)).toMatchObject({
      players: 1,
      prefs: 2,
    });
    expect(migrateRun("x", AP_SAVE_VERSION)).toBe("x");
  });

  it("keeps the timer and prefs through the server's word, and drives the timer", () => {
    act(() => run().startTimer(1000));
    act(() => run().apply({ ...freshRun(), room: LINK, updatedAt: 1 }));
    expect(run().timer.startedAt).toBe(1000);
    act(() => run().countdownEnded(5000));
    // A counting timer is never restarted by a countdown
    expect(run().timer.startedAt).toBe(1000);
    act(() => run().pauseTimer(3000));
    expect(run().timer).toEqual({
      elapsedMs: 2000,
      finished: false,
      startedAt: null,
    });
    act(() => run().resetTimer());
    expect(run().timer.elapsedMs).toBe(0);
    const before = localStorage.getItem(AP_STORAGE_KEY);
    act(() => run().setPref("feedScope", "mine"));
    expect(localStorage.getItem(AP_STORAGE_KEY)).toBe(before);
  });
});
