import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AP_CONNECTION_KEY,
  AP_PASSWORD_KEY,
  connect,
  disconnect,
  followOtherTabs,
  localNetworkPermission,
  pageContext,
  readPassword,
  retry,
  savePassword,
  saveRoom,
  setRuntimeOptions,
  stop,
  useApConnectionStore,
} from "@/games/archipelago/connection";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";
import { useApNamesStore } from "@/games/archipelago/names";
import {
  AP_STORAGE_KEY,
  freshRun,
  useArchipelagoStore,
} from "@/games/archipelago/store";

const state = () => useApConnectionStore.getState();
const run = () => useArchipelagoStore.getState();

/** What a page's tab has of another's write to the connection's key. */
const fromOtherTab = (saved: Record<string, unknown>) => {
  localStorage.setItem(
    AP_CONNECTION_KEY,
    JSON.stringify({ state: saved, version: 0 }),
  );
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: AP_CONNECTION_KEY,
      storageArea: localStorage,
    }),
  );
};

const LINK = {
  address: ROOM_ADDRESS,
  connectOnStart: true,
  rememberPassword: false,
  roomLink: null,
  slot: "Link",
  uuid: "device",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useApConnectionStore.setState(useApConnectionStore.getInitialState(), true);
  useArchipelagoStore.setState(useArchipelagoStore.getInitialState(), true);
  useApNamesStore.setState({ groups: null, names: null });
});

afterEach(() => {
  stop();
  setRuntimeOptions({});
});

describe("the password", () => {
  it("stays in this tab unless remembered", () => {
    savePassword("bench-pass", false);
    expect(sessionStorage.getItem(AP_PASSWORD_KEY)).toBe("bench-pass");
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBeNull();
    expect(readPassword()).toBe("bench-pass");
    // The saved settings never hold it
    expect(localStorage.getItem(AP_CONNECTION_KEY)).not.toContain("bench");
  });

  it("is remembered on this device on request, and forgotten at once", () => {
    savePassword("bench-pass", true);
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBe("bench-pass");
    expect(state().rememberPassword).toBe(true);
    sessionStorage.clear();
    expect(readPassword()).toBe("bench-pass");
    savePassword("bench-pass", false);
    expect(localStorage.getItem(AP_PASSWORD_KEY)).toBeNull();
    savePassword("", true);
    expect(readPassword()).toBe("");
  });

  it("reads as none where storage refuses", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("denied");
      });
    expect(readPassword()).toBe("");
    getItem.mockRestore();
  });
});

describe("the page", () => {
  it("is insecure over http, secure over https by its browser", () => {
    expect(pageContext("http:", "")).toEqual({ kind: "insecure" });
    expect(
      pageContext(
        "https:",
        "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      ),
    ).toEqual({ browser: "firefox", gated: false, kind: "secure" });
    expect(pageContext()).toEqual({ kind: "insecure" });
  });

  it("knows which browsers gate this device and the LAN (autotracking's loopbackAccess)", () => {
    const chrome = (major: number) =>
      `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
    expect(pageContext("https:", chrome(156))).toEqual({
      browser: "chromium",
      gated: true,
      kind: "secure",
    });
    expect(pageContext("https:", chrome(146))).toMatchObject({ gated: false });
    expect(
      pageContext(
        "https:",
        "Mozilla/5.0 (X11; Linux x86_64; rv:157.0) Gecko/20100101 Firefox/157.0",
      ),
    ).toMatchObject({ browser: "firefox", gated: true });
  });
});

describe("the local network permission", () => {
  it("asks the browser by the names each permission answers to", async () => {
    const queried: string[] = [];
    const query = vi.fn(async ({ name }: { name: string }) => {
      queried.push(name);
      if (name !== "local-network-access") throw new TypeError(name);
      return { onchange: null, state: "denied" };
    });
    vi.stubGlobal("navigator", { ...navigator, permissions: { query } });
    try {
      expect(await localNetworkPermission("local-network").query()).toEqual({
        name: "local-network-access",
        state: "denied",
      });
      expect(
        await localNetworkPermission("loopback-network").query(),
      ).toMatchObject({ state: "denied" });
      expect(queried).toEqual([
        "local-network",
        "local-network-access",
        "loopback-network",
        "local-network-access",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("the saved settings", () => {
  it("keep the room, never the run or the password", () => {
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    const saved = JSON.parse(localStorage.getItem(AP_CONNECTION_KEY) ?? "");
    expect(saved.state).toEqual({
      address: ROOM_ADDRESS,
      connectOnStart: false,
      rememberPassword: false,
      roomLink: null,
      slot: "Link",
      uuid: null,
    });
  });

  it("drop what does not hold", async () => {
    localStorage.setItem(
      AP_CONNECTION_KEY,
      JSON.stringify({ state: { address: 42 }, version: 0 }),
    );
    await useApConnectionStore.persist.rehydrate();
    expect(state().address).toBe("");
    localStorage.setItem(
      AP_CONNECTION_KEY,
      JSON.stringify({ state: LINK, version: 0 }),
    );
    await useApConnectionStore.persist.rehydrate();
    expect(state().slot).toBe("Link");
  });
});

describe("connect", () => {
  it("does nothing without a server address and a slot", async () => {
    await connect();
    saveRoom({
      address: "https://archipelago.gg/room/abc",
      roomLink: null,
      slot: "Link",
    });
    await connect();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "" });
    await connect();
    expect(state().active).toBe(false);
  });

  it("joins the room and writes the slot's run, at most every 250 ms", async () => {
    const room = startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    expect(state().active).toBe(true);
    expect(state().connectOnStart).toBe(true);
    await vi.waitFor(() => expect(state().status.code).toBe("connected"));
    await vi.waitFor(() => expect(run().room?.slotName).toBe("Link"));
    expect(run().room).toMatchObject({
      checksum: "1858ba29ffb7bf55e9e71a76fc7aba1b5c0950e4",
      game: "A Link to the Past",
      slot: 1,
      team: 0,
    });
    expect(run().missing).toHaveLength(249);
    expect(state().uuid).toMatch(/^[0-9a-f-]{36}$/);
    // The names and groups the checks need, from the server
    await vi.waitFor(() =>
      expect(useApNamesStore.getState().groups).not.toBeNull(),
    );
    expect(useApNamesStore.getState().names?.game).toBe("A Link to the Past");
    expect(useApNamesStore.getState().groups).not.toHaveProperty("Everywhere");

    room.playOn();
    await vi.waitFor(() => expect(run().received).toBe(5));
    expect(run().items).toEqual([
      { count: 1, flags: 0, name: "Bombs (3)" },
      { count: 1, flags: 1, name: "Small Key (Ice Palace)" },
      { count: 1, flags: 1, name: "Small Key (Turtle Rock)" },
      { count: 2, flags: 2, name: "Piece of Heart" },
    ]);
    expect(run().checked.length).toBeGreaterThan(0);
    // What others read holds nothing of where the room is
    const saved = localStorage.getItem(AP_STORAGE_KEY) ?? "";
    expect(saved).not.toContain("38281");
    expect(saved).not.toContain("127.0.0.1");
    // Read-only: nothing off the whitelist ever left
    const sent = new Set(
      room.network.sockets.flatMap((s) => s.packets.map((p) => p.cmd)),
    );
    for (const cmd of sent) {
      expect([
        "Connect",
        "Get",
        "SetNotify",
        "GetDataPackage",
        "Sync",
        "LocationScouts",
      ]).toContain(cmd);
    }
    // Scouts only of what the server states checked, creating no hint
    for (const packet of room.network.sockets.flatMap((s) => s.packets)) {
      if (packet.cmd !== "LocationScouts") continue;
      expect(packet.create_as_hint).toBe(0);
      for (const id of packet.locations as number[]) {
        expect(run().checked).toContain(id);
      }
    }
  });

  it("is refused, and waits for the player", async () => {
    startRoom({ refuse: ["InvalidSlot"] });
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "link" });
    await connect();
    await vi.waitFor(() => expect(state().status.code).toBe("refused"));
    retry();
    await vi.waitFor(() => expect(state().status.code).toBe("refused"));
    expect(run().room).toBeNull();
  });

  it("starts once at a time, and never in the stream view", async () => {
    startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    const first = connect();
    await connect();
    await first;
    expect(state().active).toBe(true);
    stop();
    window.history.replaceState(null, "", "/?view=obs");
    await connect();
    expect(state().active).toBe(false);
    window.history.replaceState(null, "", "/");
  });

  it("says when the session's code cannot load", async () => {
    setRuntimeOptions({}, () => Promise.reject(new Error("offline")));
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    expect(state()).toMatchObject({
      active: false,
      status: { code: "unavailable" },
      unavailable: true,
    });
  });

  it("drops what a stopped session would load late", async () => {
    let load: (value: typeof import("@/games/archipelago/runtime")) => void =
      () => {};
    setRuntimeOptions(
      {},
      () =>
        new Promise((resolve) => {
          load = resolve;
        }),
    );
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    const pending = connect();
    stop();
    load(await import("@/games/archipelago/runtime"));
    await pending;
    expect(state().status.code).toBe("stopped");
  });

  it("says once when the room holds another run than the board", async () => {
    useArchipelagoStore.setState({
      ...freshRun(),
      room: {
        checksum: null,
        game: "A Link to the Past",
        generatorVersion: "0.6.8",
        seedName: "another seed",
        slot: 1,
        slotName: "Link",
        team: 0,
      },
    });
    startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    await vi.waitFor(() => expect(state().notice).toMatch(/another run/));
    expect(run().room?.seedName).not.toBe("another seed");
  });

  it("keeps the same run's items while the server resends them", async () => {
    const room = startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    await vi.waitFor(() => expect(state().status.code).toBe("connected"));
    room.playOn();
    await vi.waitFor(() => expect(run().received).toBe(5));
    const items = run().items;
    stop();
    // A new connection: Connected comes before the list, which is shorter
    // for a moment; the board keeps what it had
    await connect();
    await vi.waitFor(() => expect(state().status.code).toBe("connected"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(run().items).toEqual(items);
    expect(state().notice).toBeNull();
  });

  it("disconnects at the player's word: no connection on the next visit", async () => {
    startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    disconnect();
    expect(state()).toMatchObject({
      active: false,
      connectOnStart: false,
      status: { code: "stopped" },
    });
  });
});

describe("another tab", () => {
  it("stops this tab's session when it disconnects", async () => {
    const unfollow = followOtherTabs();
    startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    fromOtherTab({ ...LINK, connectOnStart: false });
    await vi.waitFor(() => expect(state().active).toBe(false));
    unfollow();
  });

  it("moves this tab's session to the room it set", async () => {
    const unfollow = followOtherTabs();
    startRoom();
    saveRoom({ address: ROOM_ADDRESS, roomLink: null, slot: "Link" });
    await connect();
    fromOtherTab({ ...LINK, slot: "Samus" });
    await vi.waitFor(() => expect(state().slot).toBe("Samus"));
    await vi.waitFor(() => expect(state().active).toBe(true));
    // The same room and slot change nothing
    fromOtherTab({ ...LINK, slot: "Samus" });
    expect(state().active).toBe(true);
    unfollow();
  });

  it("changes nothing in a tab with no session", async () => {
    const unfollow = followOtherTabs();
    fromOtherTab(LINK);
    await vi.waitFor(() => expect(state().slot).toBe("Link"));
    expect(state().active).toBe(false);
    unfollow();
  });
});
