import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ArchipelagoApp from "@/games/archipelago/ArchipelagoApp";
import { ArchipelagoObsView } from "@/games/archipelago/ArchipelagoObsView";
import { ChecksPanel } from "@/games/archipelago/components/ChecksPanel";
import { ItemsPanel } from "@/games/archipelago/components/ItemsPanel";
import { RoomLine } from "@/games/archipelago/components/RoomLine";
import {
  saveRoom,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { createNameCache } from "@/games/archipelago/datapackageCache";
import {
  alttpNames,
  ROOM_ADDRESS,
  startRoom,
} from "@/games/archipelago/fixtures";
import { archipelago, IMPORT_REFUSAL } from "@/games/archipelago/module";
import { loadCachedNames, useApNamesStore } from "@/games/archipelago/names";
import {
  type ApRoom,
  freshRun,
  useArchipelagoStore,
} from "@/games/archipelago/store";

const ROOM: ApRoom = {
  checksum: "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4",
  game: "A Link to the Past",
  generatorVersion: "0.6.8",
  seedName: "4242",
  slot: 1,
  slotName: "Link",
  team: 0,
};

const names = alttpNames();
const at = (name: string) => names.locationIds.get(name) ?? -1;

/** A run on the board, as the server last stated it. */
const lay = (change: Partial<ReturnType<typeof freshRun>> = {}) =>
  act(() =>
    useArchipelagoStore.getState().apply({
      ...freshRun(),
      room: ROOM,
      updatedAt: 1,
      ...change,
    }),
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
  useApNamesStore.setState({ groups: null, names: null });
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
});

describe("the items", () => {
  it("draw an A Link to the Past slot with its art, the rest under More items", async () => {
    lay({
      items: [
        { count: 2, flags: 1, name: "Progressive Sword" },
        { count: 1, flags: 1, name: "Small Key (Ice Palace)" },
        { count: 1, flags: 1, name: "Big Key (Ice Palace)" },
        { count: 3, flags: 1, name: "Hookshot" },
        { count: 2, flags: 2, name: "Piece of Heart" },
        { count: 1, flags: 4, name: "Bee Trap" },
        { count: 1, flags: 1, name: "Triforce Piece" },
      ],
    });
    render(<ItemsPanel />);
    // The skin is a chunk of its own: nothing until it arrived, then the grid
    expect(screen.queryByTestId("ap-item-list")).toBeNull();
    const sword = await screen.findByTestId("ap-item-sword");
    expect(sword).toHaveTextContent("Sword, Master Sword");
    expect(sword).not.toHaveClass("griditem--dimmed");
    expect(sword.style.getPropertyValue("--sprite")).toContain("sword2.png");
    expect(screen.getByTestId("ap-item-hookshot")).toHaveTextContent(
      "Hookshot, received, 3",
    );
    expect(screen.getByTestId("ap-item-lamp")).toHaveClass("griditem--dimmed");
    expect(screen.getByTestId("ap-item-mail")).not.toHaveClass(
      "griditem--dimmed",
    );
    expect(screen.getByTestId("ap-item-keys-ip")).toHaveTextContent(
      "Ice Palace: big key received, 1 small key",
    );
    expect(screen.getByTestId("ap-item-keys-gt")).toHaveTextContent(
      "Ganon's Tower: big key not received, 0 small keys",
    );
    const more = screen.getByTestId("ap-item-list");
    expect(within(more).getByRole("heading", { level: 3 })).toHaveTextContent(
      "More items",
    );
    expect(
      within(more)
        .getAllByRole("heading", { level: 4 })
        .map((h) => h.textContent),
    ).toEqual(["Progression (1)", "Useful (1)", "Traps (1)"]);
    expect(
      within(more)
        .getAllByTestId("ap-list-item")
        .map((li) => li.textContent),
    ).toEqual(["Triforce Piece", "Piece of Heart×, 2", "Bee Trap"]);
  });

  it("list any other world's items by kind", () => {
    lay({
      items: [
        { count: 1, flags: 0, name: "Feather" },
        { count: 2, flags: 1, name: "Button Activation" },
      ],
      room: { ...ROOM, game: "Clique" },
    });
    render(<ItemsPanel />);
    expect(screen.queryByTestId("ap-skin")).toBeNull();
    expect(
      within(screen.getByTestId("ap-item-list")).getByRole("heading", {
        level: 3,
      }),
    ).toHaveTextContent("Received");
    expect(screen.getAllByTestId("ap-list-item")).toHaveLength(2);
  });

  it("say when nothing came yet", () => {
    lay({ room: { ...ROOM, game: "Clique" } });
    render(<ItemsPanel />);
    expect(screen.getByText("None received yet.")).toBeInTheDocument();
  });
});

describe("the checks", () => {
  const house = at("Link's House");
  const sanctuary = at("Sanctuary");

  it("list the slot's locations by group, with what is left", () => {
    lay({ checked: [house], missing: [sanctuary] });
    act(() =>
      useApNamesStore.setState({
        groups: { "Light World": ["Link's House", "Sanctuary"] },
        names,
      }),
    );
    render(<ChecksPanel />);
    expect(screen.getByTestId("ap-checks-left")).toHaveTextContent(
      "1 left / 2",
    );
    expect(screen.getByTestId(`ap-check-${house}`)).toHaveTextContent(
      "Link's House, checked",
    );
    expect(screen.getByTestId(`ap-check-${sanctuary}`)).toHaveTextContent(
      "Sanctuary, not checked",
    );
    const world = screen.getByTestId("ap-zone-Light World");
    expect(world).toHaveProperty("open", true);
    expect(world.querySelector("summary")).toHaveTextContent(
      "Light World — 1 left / 2",
    );
    expect(screen.getByTestId("ap-checks-filter")).toHaveAccessibleDescription(
      "Archipelago's server says what you checked. It does not say what you can reach.",
    );

    fireEvent.click(screen.getByTestId("ap-checks-hide"));
    expect(useArchipelagoStore.getState().prefs.hideChecked).toBe(true);
    expect(screen.queryByTestId(`ap-check-${house}`)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("1 location shown");
    fireEvent.change(screen.getByTestId("ap-checks-filter"), {
      target: { value: "nowhere" },
    });
    expect(screen.getByText("No location to show.")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 locations shown");
  });

  it("wait for names, and say when there is no room", () => {
    const { rerender } = render(<ChecksPanel />);
    expect(screen.getByTestId("ap-checks-waiting")).toHaveTextContent(
      "No room yet.",
    );
    expect(screen.queryByTestId("ap-checks-left")).toBeNull();
    lay({ missing: [sanctuary] });
    rerender(<ChecksPanel />);
    expect(screen.getByTestId("ap-checks-waiting")).toHaveTextContent(
      "Location names load once the board reaches the room.",
    );
  });
});

describe("the checks' groups", () => {
  const house = at("Link's House");
  const sanctuary = at("Sanctuary");
  const palace = at("Eastern Palace - Big Chest");

  const show = () => {
    lay({ checked: [house, palace], missing: [sanctuary] });
    act(() =>
      useApNamesStore.setState({
        groups: {
          "Eastern Palace": ["Eastern Palace - Big Chest"],
          "Light World": ["Link's House", "Sanctuary"],
        },
        names,
      }),
    );
    render(<ChecksPanel />);
    return {
      east: screen.getByTestId("ap-zone-Eastern Palace") as HTMLDetailsElement,
      world: screen.getByTestId("ap-zone-Light World") as HTMLDetailsElement,
    };
  };

  /** What a click on a group's summary does in a browser. */
  const flip = (group: HTMLDetailsElement) =>
    act(() => {
      group.open = !group.open;
      group.dispatchEvent(new Event("toggle"));
    });

  const filter = (value: string) =>
    fireEvent.change(screen.getByTestId("ap-checks-filter"), {
      target: { value },
    });

  afterEach(() => vi.unstubAllGlobals());

  it("open those with checks left, then as the player leaves them", () => {
    const { east, world } = show();
    expect(east.open).toBe(false);
    expect(world.open).toBe(true);
    expect(east.querySelector("summary")).toHaveTextContent(
      "Eastern Palace — 0 left / 1",
    );
    flip(east);
    flip(world);
    filter("x");
    filter("");
    expect(east.open).toBe(true);
    expect(world.open).toBe(false);
  });

  /** A media query the spec flips, as a resize or a rotation does. */
  const stack = (narrow: boolean) => {
    const listeners = new Set<() => void>();
    const media = { matches: narrow };
    vi.stubGlobal("matchMedia", (query: string) => ({
      addEventListener: (_: string, listener: () => void) =>
        listeners.add(listener),
      get matches() {
        return media.matches;
      },
      query,
      removeEventListener: (_: string, listener: () => void) =>
        listeners.delete(listener),
    }));
    return (next: boolean) =>
      act(() => {
        media.matches = next;
        for (const listener of listeners) listener();
      });
  };

  it("follow the board as it stacks or not, until the player chooses", () => {
    const resize = stack(true);
    const { world } = show();
    expect(world.open).toBe(false);
    resize(false);
    expect(world.open).toBe(true);
    resize(true);
    expect(world.open).toBe(false);
    // Once the player opened one, a resize leaves the groups as they are
    flip(world);
    resize(false);
    resize(true);
    expect(world.open).toBe(true);
  });

  it("start closed where the board stacks, and open every match of a filter", () => {
    stack(true);
    const { east, world } = show();
    expect(east.open).toBe(false);
    expect(world.open).toBe(false);
    filter("palace");
    expect(east.open).toBe(true);
    expect(screen.queryByTestId("ap-zone-Light World")).toBeNull();
    // A group closed while filtering stays the filter's business
    flip(east);
    filter("");
    expect(screen.getByTestId("ap-zone-Eastern Palace")).toHaveProperty(
      "open",
      false,
    );
    expect(screen.getByTestId("ap-zone-Light World")).toHaveProperty(
      "open",
      false,
    );
  });
});

describe("the room line", () => {
  it("names the slot, game, team and players, never the room's address", () => {
    lay({
      players: [
        { game: "A Link to the Past", name: "Link", slot: 1, status: null },
        { game: "Super Metroid", name: "Samus", slot: 2, status: 30 },
      ],
      raceMode: true,
    });
    act(() =>
      useApConnectionStore.setState({
        address: ROOM_ADDRESS,
        status: { code: "connected", url: "ws://127.0.0.1:38281" },
      }),
    );
    render(<RoomLine />);
    expect(screen.getByTestId("ap-room-slot")).toHaveTextContent(
      "Link · A Link to the Past · Team 1",
    );
    expect(screen.getByTestId("ap-room-players")).toHaveTextContent(
      "2 players",
    );
    expect(screen.getByTestId("ap-race-badge")).toHaveTextContent("Race seed");
    expect(screen.getByTestId("ap-room-status")).toHaveTextContent("Connected");
    expect(screen.getByTestId("ap-room")).not.toHaveTextContent("38281");
  });

  it("says when there is no room, and one player", () => {
    const { rerender } = render(<RoomLine />);
    expect(screen.getByText("No room yet")).toBeInTheDocument();
    lay({ players: [{ game: "Clique", name: "Solo", slot: 1, status: null }] });
    rerender(<RoomLine />);
    expect(screen.getByTestId("ap-room-players")).toHaveTextContent("1 player");
    expect(screen.queryByTestId("ap-race-badge")).toBeNull();
  });
});

describe("the board", () => {
  it("opens the room's dialog on its own while no room is set", async () => {
    render(<ArchipelagoApp />);
    expect(
      await screen.findByRole("dialog", { name: "Archipelago room" }),
    ).toBeInTheDocument();
  });

  it("connects as it opens once the player has connected, and follows the room", async () => {
    const room = startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    act(() => useApConnectionStore.setState({ connectOnStart: true }));
    render(<ArchipelagoApp />);
    expect(screen.queryByRole("dialog")).toBeNull();
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-room-status")).toHaveTextContent(
        "Connected",
      ),
    );
    expect(screen.getByTestId("ap-room-button")).toHaveAccessibleName(
      "Room, Connected",
    );
    room.playOn();
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-item-keys-tr")).toHaveTextContent(
        "1 small key",
      ),
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId("ap-checks-filter")).toBeInTheDocument(),
    );
  });

  it("opens a join link's room in the dialog, without connecting", async () => {
    const room = startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    act(() =>
      useApConnectionStore.setState({
        connectOnStart: true,
        prefill: { room: "archipelago.gg:60030", slot: "Samus" },
      }),
    );
    render(<ArchipelagoApp />);
    const dialog = await screen.findByRole("dialog", {
      name: "Archipelago room",
    });
    expect(dialog).toHaveTextContent("Filled in from a join link");
    expect(screen.getByTestId("ap-room-input")).toHaveValue(
      "archipelago.gg:60030",
    );
    // The saved room waits too: the player chooses which to connect to
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(useApConnectionStore.getState().active).toBe(false);
    expect(room.network.sockets).toHaveLength(0);
  });

  it("says once when the room held another run, until dismissed", () => {
    act(() => useApConnectionStore.setState({ notice: "Another run." }));
    lay();
    render(<ArchipelagoApp />);
    expect(screen.getByTestId("ap-notice")).toHaveTextContent("Another run.");
    fireEvent.click(
      within(screen.getByTestId("ap-notice")).getByRole("button", {
        name: "Dismiss",
      }),
    );
    expect(screen.getByTestId("ap-notice")).toBeEmptyDOMElement();
  });

  it("opens the run type dialog, with the game picker, and the stream view's address", () => {
    lay();
    render(<ArchipelagoApp />);
    fireEvent.click(screen.getByRole("button", { name: /^Mode/ }));
    const mode = screen.getByRole("dialog", { name: "Choose a run type" });
    expect(within(mode).getByTestId("game-archipelago")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(mode).getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByTestId("archipelago-stream-view"));
    expect(screen.getByTestId("archipelago-stream-url")).toHaveTextContent(
      "view=obs",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // No New game, undo, import, export or share
    expect(screen.queryByTestId("share-button")).toBeNull();
    expect(screen.queryByTestId("import-file")).toBeNull();
  });
});

describe("a tab that follows another", () => {
  it("reads the names and groups the connected tab left in the cache", async () => {
    const cache = createNameCache(() => new IDBFactory());
    const { archipelago: _a, ...pkg } = {
      archipelago: 0,
      checksum: names.checksum,
      item_name_to_id: Object.fromEntries(names.itemIds),
      location_name_to_id: Object.fromEntries(names.locationIds),
    };
    await cache.put(ROOM.game, pkg);
    await loadCachedNames(ROOM, cache);
    expect(useApNamesStore.getState().names?.checksum).toBe(names.checksum);
    expect(useApNamesStore.getState().groups).toBeNull();
    await cache.putGroups(ROOM.game, names.checksum, { "Light World": [] });
    await loadCachedNames(ROOM, cache);
    expect(useApNamesStore.getState().groups).toEqual({ "Light World": [] });
    // Both known: nothing to read
    const get = vi.spyOn(cache, "get");
    await loadCachedNames(ROOM, cache);
    expect(get).not.toHaveBeenCalled();
    // Another game's names never stay beside this one's
    await loadCachedNames({ checksum: "none", game: "SMZ3" }, cache);
    expect(useApNamesStore.getState()).toEqual({ groups: null, names: null });
    await loadCachedNames({ checksum: null, game: "SMZ3" }, cache);
  });
});

describe("the stream view", () => {
  it("draws the skin's grid, or the progression items held", async () => {
    lay({ items: [{ count: 1, flags: 1, name: "Hookshot" }] });
    const { rerender } = render(
      <ArchipelagoObsView background="#000000" relay="follow" />,
    );
    expect(await screen.findByTestId("ap-item-hookshot")).toHaveTextContent(
      "Hookshot, received",
    );
    expect(screen.getByTestId("obs-view")).toHaveStyle({
      backgroundColor: "#000000",
    });
    lay({
      items: [
        { count: 2, flags: 1, name: "Feather" },
        { count: 1, flags: 0, name: "Rupee" },
      ],
      room: { ...ROOM, game: "Clique" },
    });
    rerender(<ArchipelagoObsView background={null} />);
    expect(screen.getByTestId("ap-obs-list")).toHaveTextContent("Feather ×2");
    expect(screen.getByTestId("ap-obs-list")).not.toHaveTextContent("Rupee");
  });
});

describe("the module", () => {
  it("refuses a save or a shared link", () => {
    expect(archipelago.importRun("{}")).toEqual({
      ok: false,
      reason: IMPORT_REFUSAL,
    });
    expect(archipelago.store).toBe(useArchipelagoStore);
  });

  it("takes a join link from the address as it starts", () => {
    window.history.replaceState(
      null,
      "",
      "/alltp-tracker/?room=localhost%3A38281&slot=Link&password=x",
    );
    try {
      archipelago.start();
      expect(useApConnectionStore.getState().prefill).toEqual({
        room: "localhost:38281",
        slot: "Link",
      });
      expect(window.location.search).toBe("");
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("follows the other tabs through storage", async () => {
    archipelago.start();
    localStorage.setItem(
      "alltp-tracker-archipelago",
      JSON.stringify({ state: { ...freshRun(), room: ROOM }, version: 1 }),
    );
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "alltp-tracker-archipelago",
        storageArea: localStorage,
      }),
    );
    await vi.waitFor(() =>
      expect(useArchipelagoStore.getState().room).toEqual(ROOM),
    );
  });
});
