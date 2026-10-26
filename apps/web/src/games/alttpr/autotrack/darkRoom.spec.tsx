import { parseUserAgent } from "@alltp/autotrack";
import { MEMORY_RANGE } from "@alltp/pack-alttpr";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeVisibility, GRANTED, ManualClock } from "@/autotrack/fixtures";
import { putDarkRoom, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { MapPanel } from "@/games/alttpr/components/map/MapPanel";
import {
  connectAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import { useDarkRoomStore } from "@/games/alttpr/stores/darkRoomStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import links from "../../../../../../packs/alttpr/test/dark-room/links-house.json";

/** Link's House, dark and without the Lamp, behind an in-memory bridge. */
const harness = ({ race = false }: { race?: boolean } = {}) => {
  const memory = putDarkRoom(seedMemory({ race }), links);
  const clock = new ManualClock();
  let transport: MemoryTransport | null = null;
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => {
      transport = new MemoryTransport(memory, {});
      return transport;
    },
    visibility: new FakeVisibility(),
  });
  return {
    advance: (ms: number) => act(() => clock.advance(ms)),
    memory,
    /** How many pieces touched the map's 8 KiB, and Link's position. */
    read: () => {
      const map = MEMORY_RANGE["dark-room-map"].address;
      const small = MEMORY_RANGE["dark-room-link"].address;
      const pieces = transport?.pieces ?? [];
      return {
        map: pieces.filter(([a, n]) => a < map + 0x2000 && map < a + n).length,
        small: pieces.filter(([a, n]) => a < small + 4 && small < a + n).length,
      };
    },
  };
};

const store = () => useDarkRoomStore.getState();

/** Where the recording put Link: Y then X, absolute in the dungeon's grid. */
const at = () => {
  const bytes = links.ranges["dark-room-link"].match(/../g) ?? [];
  const [yLow, yHigh, xLow, xHigh] = bytes.map((b) => Number.parseInt(b, 16));
  return { x: xLow | (xHigh << 8), y: yLow | (yHigh << 8) };
};
const tileOf = (x: number, y: number) => ({
  x: (x & 0x1ff) >> 3,
  y: ((y & 0x1ff) + 8) >> 3,
});
const lamp = MEMORY_RANGE["equipment-b"].address + 6;
const darkByte = MEMORY_RANGE["dark-room-dark"].address;

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({
      environment: parseUserAgent(
        "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
      ),
    });
    useDarkRoomStore.getState().show(null);
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
});

describe("the dark room, from a session", () => {
  it("shows the room Link is in once the game says it is dark and he has no Lamp", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(store().map?.room).toBe(0x104);
    expect(store().link).toEqual(tileOf(at().x, at().y));
    expect(h.read().map).toBeGreaterThan(0);
    expect(h.read().small).toBeGreaterThan(0);
  });

  it("follows Link as he walks, and drops the room when it is lit", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    const map = store().map;

    // Link steps right 24 px: the plan stays, the marker moves
    h.memory[MEMORY_RANGE["dark-room-link"].address + 2] += 24;
    await h.advance(250);
    expect(store().link?.x).toBe(tileOf(at().x + 24, at().y).x);
    expect(store().map).toBe(map);

    h.memory[darkByte] = 0;
    await h.advance(250);
    expect(store().map).toBeNull();
    expect(store().link).toBeNull();
  });

  it("drops it when the Lamp is found", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(store().map).not.toBeNull();

    h.memory[lamp] = 1;
    await h.advance(500);
    expect(store().map).toBeNull();
  });

  it("never reads it in Race Mode, and shows nothing", async () => {
    const h = harness({ race: true });
    await act(() => connectAutotrack());
    await h.advance(0);
    await h.advance(2000);

    expect(useAutotrackStore.getState().status.code).toBe("connected");
    expect(store().map).toBeNull();
    expect(h.read()).toEqual({ map: 0, small: 0 });
  });

  it("goes when Race Mode comes on mid-session", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(store().map).not.toBeNull();

    act(() => useAutotrackStore.getState().setRaceChoice("on"));
    await h.advance(500);
    expect(store().map).toBeNull();
  });

  it("is not read at all with the option off, and comes with it on", async () => {
    const h = harness();
    act(() => useAutotrackStore.getState().setDarkRoomMap(false));
    await act(() => connectAutotrack());
    await h.advance(0);
    await h.advance(2000);
    expect(store().map).toBeNull();
    expect(h.read()).toEqual({ map: 0, small: 0 });

    act(() => useAutotrackStore.getState().setDarkRoomMap(true));
    await h.advance(250);
    await h.advance(250);
    expect(store().map?.room).toBe(0x104);

    act(() => useAutotrackStore.getState().setDarkRoomMap(false));
    expect(store().map).toBeNull();
  });

  it("goes with the session, and stays off the saved run", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(store().map).not.toBeNull();

    act(() => stopAutotrack());
    expect(store().map).toBeNull();
    // The option is the only trace in storage: a boolean beside Race Mode
    const saved = JSON.parse(
      localStorage.getItem("alltp-tracker-autotrack") ?? "{}",
    ).state;
    expect(saved.darkRoomMap).toBe(true);
    expect(Object.keys(saved).sort()).toEqual([
      "connectOnStart",
      "darkRoomMap",
      "keptSeed",
      "raceChoice",
    ]);
    // The run knows nothing of it
    expect(JSON.stringify(useGameStore.getState())).not.toMatch(
      /darkRoomMap|dark-room/,
    );
  });

  it("reads a save from before the option, or a damaged one, as on", async () => {
    localStorage.setItem(
      "alltp-tracker-autotrack",
      JSON.stringify({ state: { connectOnStart: false }, version: 1 }),
    );
    await act(() => useAutotrackStore.persist.rehydrate());
    expect(useAutotrackStore.getState().darkRoomMap).toBe(true);
    localStorage.setItem(
      "alltp-tracker-autotrack",
      JSON.stringify({ state: { darkRoomMap: "no" }, version: 1 }),
    );
    await act(() => useAutotrackStore.persist.rehydrate());
    expect(useAutotrackStore.getState().darkRoomMap).toBe(true);
  });
});

describe("the dark room panel", () => {
  /** Link's House in the store, as a session would put it there. */
  const show = async (edit?: (memory: Uint8Array) => void) => {
    const h = harness();
    edit?.(h.memory);
    await act(() => connectAutotrack());
    await h.advance(0);
    return h;
  };

  it("sits above the map panel's tabs, named, with its words and legend", async () => {
    await show();
    render(<MapPanel />);

    const panel = await screen.findByTestId("dark-room");
    expect(panel).toHaveAccessibleName("Dark room");
    expect(within(panel).getByTestId("dark-room-plan")).toHaveAccessibleName(
      /plan of the dark room/i,
    );
    expect(within(panel).getByTestId("dark-room-id")).toHaveTextContent(
      "Room 104",
    );
    expect(within(panel).getByTestId("dark-room-words")).toHaveTextContent(
      "No unopened chest in this room.",
    );
    // The legend names what the room holds, in words
    const legend = within(panel).getByRole("list", { name: "Legend" });
    for (const word of ["Floor", "Wall", "Pot", "Exit"]) {
      expect(within(legend).getByText(word)).toBeVisible();
    }
    expect(within(panel).getByTestId("dark-room-link")).toBeInTheDocument();
    // Over the tabs' content, whichever view is selected
    expect(
      panel.compareDocumentPosition(screen.getByRole("tabpanel")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(screen.getByTestId("map-view-tab-run"));
    expect(screen.getByTestId("dark-room")).toBeInTheDocument();
  });

  it("says where the nearest unopened chest is, in tiles", async () => {
    // A chest 6 tiles to Link's left and 3 above, as the game would draw it
    await show((memory) => {
      const map = MEMORY_RANGE["dark-room-map"].address;
      const link = tileOf(at().x, at().y);
      // The middle of his 2 x 2 tiles is (link.x + 1, link.y + 1): the chest's
      // 2 x 2 tiles start 7 left and 4 above it, so its middle is 6 and 3
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ]) {
        memory[map + (link.y - 3 + dy) * 64 + (link.x - 6 + dx)] = 0x58;
      }
    });
    render(<MapPanel />);
    expect(await screen.findByTestId("dark-room-words")).toHaveTextContent(
      "Nearest unopened chest: 6 tiles left, 3 tiles up.",
    );
  });

  it("has one live region, the sentence itself, and no copy of it", async () => {
    await show();
    render(<MapPanel />);
    const words = await screen.findByTestId("dark-room-words");
    expect(words).toHaveAttribute("role", "status");
    expect(words).toHaveTextContent("No unopened chest in this room.");
    const panel = screen.getByTestId("dark-room");
    expect(within(panel).getAllByRole("status")).toEqual([words]);
    expect(
      within(panel).getAllByText("No unopened chest in this room."),
    ).toHaveLength(1);
  });

  it("stays where it is while a menu or a text box is open, and goes with the room", async () => {
    const h = await show();
    render(<MapPanel />);
    const panel = await screen.findByTestId("dark-room");
    const map = store().map;

    // The menu (mode 0E), a text box, a scroll between rooms: nothing is
    // unmounted, nothing read again, and the sentence is not re-inserted
    h.memory[MEMORY_RANGE["dark-room-mode"].address] = 0x0e;
    // The gate byte is read every 500 ms: one position read may come first
    await h.advance(500);
    const inMenu = h.read();
    h.memory[MEMORY_RANGE["dark-room-mode"].address + 1] = 0x02;
    await h.advance(1500);
    expect(screen.getByTestId("dark-room")).toBe(panel);
    expect(store().map).toBe(map);
    expect(h.read()).toEqual(inMenu);
    // Back in play: the room is read again
    h.memory[MEMORY_RANGE["dark-room-mode"].address] = 0x07;
    h.memory[MEMORY_RANGE["dark-room-mode"].address + 1] = 0x00;
    await h.advance(1500);
    expect(screen.getByTestId("dark-room")).toBe(panel);
    expect(h.read().small).toBeGreaterThan(inMenu.small);

    // The Lamp, or a lit room, lets it go
    h.memory[lamp] = 1;
    await h.advance(500);
    expect(screen.queryByTestId("dark-room")).toBeNull();
  });

  it("is gone when there is no dark room, and the panel never takes the tabs' place", async () => {
    render(<MapPanel />);
    expect(screen.queryByTestId("dark-room")).toBeNull();
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();
  });
});

describe("what saves, shares, streams or follows a run", () => {
  it("never imports the dark room", () => {
    const files = import.meta.glob<string>(
      [
        "../stores/persistence.ts",
        "../stores/gameStore.ts",
        "../share.ts",
        "../overlay.ts",
        "../autotrack/follow.ts",
        "../autotrack/reading.ts",
        "../ObsView.tsx",
        "../../../follow/publish.ts",
        "../../../follow/FollowView.tsx",
        "../../../follow/StreamSourceView.tsx",
        "../../../desktop/runFeed.ts",
        "../../../desktop/overlayFeed.ts",
        "../../../overlay/publish.ts",
        "../../../share/runLink.ts",
      ],
      { eager: true, import: "default", query: "?raw" },
    );
    expect(Object.keys(files)).toHaveLength(14);
    for (const [file, source] of Object.entries(files)) {
      expect(source, file).not.toMatch(
        /darkRoom|dark-room|DarkRoom|decodeDarkRoom/,
      );
    }
  });
});
