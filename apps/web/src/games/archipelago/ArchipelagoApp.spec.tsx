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
  it("draw an A Link to the Past slot with its art, the rest under More items", () => {
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
    const sword = screen.getByTestId("ap-item-sword");
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
    expect(
      screen.getByRole("heading", { name: "Light World 1 left" }),
    ).toBeInTheDocument();
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

describe("the room line", () => {
  it("names the slot, game, team and players, never the room's address", () => {
    lay({
      players: [
        { game: "A Link to the Past", name: "Link", slot: 1 },
        { game: "Super Metroid", name: "Samus", slot: 2 },
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
    expect(screen.getByRole("status")).toHaveTextContent("Connected");
    expect(screen.getByTestId("ap-room")).not.toHaveTextContent("38281");
  });

  it("says when there is no room, and one player", () => {
    const { rerender } = render(<RoomLine />);
    expect(screen.getByText("No room yet")).toBeInTheDocument();
    lay({ players: [{ game: "Clique", name: "Solo", slot: 1 }] });
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
  it("draws the skin's grid, or the progression items held", () => {
    lay({ items: [{ count: 1, flags: 1, name: "Hookshot" }] });
    const { rerender } = render(
      <ArchipelagoObsView background="#000000" relay="follow" />,
    );
    expect(screen.getByTestId("ap-item-hookshot")).toHaveTextContent(
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
