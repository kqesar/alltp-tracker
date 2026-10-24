import { describe, expect, it } from "vitest";
import { FakeNetwork, type Route } from "../test/fake-socket";
import {
  FakeOnline,
  FakePermission,
  FakeVisibility,
  type FixtureName,
  fixture,
  flush,
  ManualClock,
} from "../test/fixtures";
import { recordedSync } from "../test/responder";
import { type PageContext, parseAddress, type ServerAddress } from "./address";
import { memoryStore, NameDataLoader } from "./datapackage";
import type { SessionStatus } from "./diagnostics";
import { GuardError } from "./guard";
import {
  ArchipelagoSession,
  backoffDelay,
  DEFAULT_BACKOFF,
  RequestError,
  type SessionOptions,
  type TabLock,
} from "./session";
import { EMPTY_SNAPSHOT } from "./snapshot";

const LOCAL = "ws://127.0.0.1:38281";

function address(text: string): ServerAddress {
  const parsed = parseAddress(text);
  if (!parsed.ok || parsed.kind !== "server") throw new Error(text);
  return parsed.address;
}

const serve = (
  name: FixtureName,
  client: string,
  extra: { refuse?: string[]; hang?: "room-info" | "login" | "get" } = {},
): Route => ({
  kind: "serve",
  responder: { client, fixture: fixture(name), ...extra },
});

function setup(
  routes: Record<string, Route>,
  options: Partial<SessionOptions> & { readonly at?: string } = {},
) {
  const network = new FakeNetwork();
  for (const [url, route] of Object.entries(routes)) network.route(url, route);
  const clock = new ManualClock();
  const visibility = new FakeVisibility();
  const online = new FakeOnline();
  const session = new ArchipelagoSession({
    address: address(options.at ?? LOCAL),
    clock,
    online,
    page: { kind: "desktop" },
    random: () => 0,
    slot: "Link",
    uuid: "device-uuid",
    visibility,
    webSocket: network.factory,
    ...options,
  });
  const statuses: SessionStatus[] = [];
  session.subscribe((status) => statuses.push(status));
  const codes = () => statuses.map((s) => s.code);
  return { clock, codes, network, online, session, statuses, visibility };
}

const sentCommands = (network: FakeNetwork) =>
  network.sockets.flatMap((socket) => socket.packets.map((p) => p.cmd));

describe("ArchipelagoSession, against recorded frames", () => {
  it("connects as a read-only tracker and reaches connected", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    expect(t.statuses).toEqual([
      { attempt: 1, code: "connecting", stage: "socket", url: LOCAL },
      { attempt: 1, code: "connecting", stage: "room-info", url: LOCAL },
      { attempt: 1, code: "authenticating", url: LOCAL },
      { code: "connected", url: LOCAL },
    ]);
    const connect = t.network.last.packets[0];
    expect(connect).toMatchObject({
      cmd: "Connect",
      game: "",
      items_handling: 7,
      name: "Link",
      password: "",
      slot_data: true,
      tags: ["Tracker"],
      uuid: "device-uuid",
    });
    // archipelago.js's own version, never the server's (0.6.8).
    expect(connect.version).toMatchObject({ build: 3, major: 0, minor: 6 });
    const snapshot = t.session.snapshot;
    expect(snapshot.ready).toBe(true);
    expect(snapshot.identity).toEqual({
      game: "A Link to the Past",
      generatorVersion: "0.6.8",
      seedName: "72844992796894532502",
      slot: 1,
      team: 0,
    });
    expect(snapshot.missing).toHaveLength(249);
    // The race flag is read at once.
    expect(snapshot.raceMode).toBe(false);
    t.session.stop();
  });

  it("folds the rest of the recorded session, and resyncs on a gap", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    const resets: boolean[] = [];
    t.session.onSnapshot((_, reset) => resets.push(reset));
    const packets: string[] = [];
    t.session.onPacket((p) => packets.push(p.cmd));
    t.session.start();
    await t.clock.advance(10);
    const socket = t.network.last;
    const later = socket.responder?.later() ?? [];
    // Hold back the ReceivedItems at index 1: the next one (index 3) is a gap.
    const gapAt = later.findIndex(
      (f) => f[0]?.cmd === "ReceivedItems" && f[0]?.index === 1,
    );
    expect(gapAt).toBeGreaterThan(0);
    socket.deliver(later.slice(0, gapAt));
    // The server has those items; the client never saw them.
    socket.responder?.track([later[gapAt]]);
    socket.deliver(later.slice(gapAt + 1, recordedSync(later)));
    await t.clock.advance(10);
    expect(
      socket.packets.filter((p) => p.cmd === "Sync").length,
    ).toBeGreaterThan(0);
    const snapshot = t.session.snapshot;
    // The server's answer to Sync is the whole list at index 0.
    expect(snapshot.items.map((i) => i.item)).toEqual([40, 169, 172, 23, 23]);
    expect(snapshot.checked).toEqual([1010170, 1310724, 1310727, 1572867]);
    expect(snapshot.hintPoints).toBe(4);
    expect(resets.every((reset) => !reset)).toBe(true);
    expect(packets).toContain("PrintJSON");
    t.session.stop();
  });

  it("never sends a packet off the whitelist, the library's own included", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    await t.clock.advance(31_000);
    expect(new Set(sentCommands(t.network))).toEqual(
      new Set(["Connect", "SetNotify", "Get"]),
    );
    t.session.stop();
  });

  it("scouts only its checked locations, creating no hint, and watches every player's status", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker-refresh") });
    t.session.start();
    await t.clock.advance(10);
    // Nothing yet: the scout waits for a burst of checks to gather
    expect(sentCommands(t.network)).not.toContain("LocationScouts");
    await t.clock.advance(300);
    const scouts = t.network.last.packets.filter(
      (p) => p.cmd === "LocationScouts",
    );
    expect(scouts).toEqual([
      {
        cmd: "LocationScouts",
        create_as_hint: 0,
        locations: [1010170, 1310724, 1310727, 1572867],
      },
    ]);
    expect(t.session.snapshot.sent.map((i) => i.player)).toEqual([3, 1, 1, 4]);
    const watched = t.network.last.packets.find(
      (p) => p.cmd === "SetNotify" && String(p.keys).includes("client_status"),
    );
    expect(watched?.keys).toEqual([
      "_read_client_status_0_1",
      "_read_client_status_0_2",
      "_read_client_status_0_3",
      "_read_client_status_0_4",
    ]);
    expect(t.session.snapshot.clientStatus).toEqual({
      1: 5,
      2: 0,
      3: 0,
      4: 30,
    });
    // Answered: no second scout of the same locations
    await t.clock.advance(1000);
    expect(
      t.network.last.packets.filter((p) => p.cmd === "LocationScouts"),
    ).toHaveLength(1);
    t.session.stop();
  });

  it("scouts a burst of new checks once, as the game goes on", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(400);
    // Nothing checked at Connected: nothing to scout
    expect(sentCommands(t.network)).not.toContain("LocationScouts");
    const socket = t.network.last;
    socket.deliver(socket.responder?.later() ?? []);
    await t.clock.advance(400);
    const scouts = socket.packets.filter((p) => p.cmd === "LocationScouts");
    expect(scouts).toHaveLength(1);
    expect(scouts[0]?.locations).toEqual(t.session.snapshot.checked);
    expect(t.session.snapshot.sent).toHaveLength(4);
    t.session.stop();
  });

  it("stops at a refusal and waits for the player", async () => {
    const t = setup({
      [LOCAL]: serve("refused", "refused:unknown slot", {
        refuse: ["InvalidSlot"],
      }),
    });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toEqual({
      code: "refused",
      reasons: ["InvalidSlot"],
      serverVersion: "0.6.8",
      url: LOCAL,
    });
    expect(t.network.open).toHaveLength(0);
    await t.clock.advance(300_000);
    expect(t.network.sockets).toHaveLength(1);
    // Coming back online does not retry a refusal; the player does.
    t.online.set(true);
    await t.clock.advance(10);
    expect(t.network.sockets).toHaveLength(1);
    t.session.retryNow();
    await t.clock.advance(10);
    expect(t.network.sockets).toHaveLength(2);
    t.session.stop();
  });

  it("puts known refusal reasons first", async () => {
    const t = setup({
      [LOCAL]: serve("refused", "refused:unknown slot", {
        refuse: ["SomethingNew", "InvalidPassword"],
      }),
    });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toMatchObject({
      reasons: ["InvalidPassword", "SomethingNew"],
    });
    t.session.stop();
  });

  it("keeps its version against a --compatibility 0 room", async () => {
    const t = setup({
      [LOCAL]: serve("compatibility-0", "compat0:default-version", {
        refuse: ["IncompatibleVersion"],
      }),
    });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toMatchObject({
      code: "refused",
      reasons: ["IncompatibleVersion"],
      serverVersion: "0.6.8",
    });
    expect(t.network.last.packets[0].version).toMatchObject({
      build: 3,
      minor: 6,
    });
    t.session.stop();
  });
});

describe("ArchipelagoSession, failures and retries", () => {
  it("retries an unreachable server with a capped backoff", async () => {
    const t = setup({ [LOCAL]: { kind: "unreachable" } });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toEqual({
      attempt: 1,
      code: "unreachable",
      hint: "not-running",
      retryInMs: 1000,
      url: LOCAL,
    });
    const delays: (number | null)[] = [];
    t.session.subscribe((s) => {
      if (s.code === "unreachable") delays.push(s.retryInMs);
    });
    await t.clock.advance(200_000);
    expect(delays.slice(0, 6)).toEqual([
      2000, 4000, 8000, 16_000, 30_000, 30_000,
    ]);
    t.session.stop();
  });

  it("says offline when the device is", async () => {
    const t = setup({ [LOCAL]: { kind: "unreachable" } });
    t.online.isOnline = false;
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toMatchObject({ hint: "offline" });
    // Back online: retried at once, not after the backoff.
    t.online.isOnline = true;
    t.network.route(LOCAL, serve("normal-session", "tracker"));
    t.online.set(true);
    await t.clock.advance(10);
    expect(t.session.status.code).toBe("connected");
    t.session.stop();
  });

  it("retries at once when the page becomes visible again", async () => {
    const t = setup({ [LOCAL]: { kind: "unreachable" } });
    t.session.start();
    await t.clock.advance(10);
    t.network.route(LOCAL, serve("normal-session", "tracker"));
    t.visibility.set(true);
    await t.clock.advance(1);
    expect(t.network.sockets).toHaveLength(1);
    t.visibility.set(false);
    await t.clock.advance(10);
    expect(t.session.status.code).toBe("connected");
    t.session.stop();
  });

  it("tries wss then ws without a scheme, and keeps the one that worked", async () => {
    const t = setup(
      {
        "ws://127.0.0.1:38281": serve("normal-session", "tracker"),
        "wss://127.0.0.1:38281": { kind: "unreachable" },
      },
      { at: "127.0.0.1:38281" },
    );
    t.session.start();
    await t.clock.advance(10);
    expect(t.network.sockets.map((s) => s.url.replace(/\/$/, ""))).toEqual([
      "wss://127.0.0.1:38281",
      "ws://127.0.0.1:38281",
    ]);
    expect(t.session.status).toEqual({ code: "connected", url: LOCAL });
    t.network.last.drop();
    await t.clock.advance(1100);
    expect(t.network.sockets.at(-1)?.url).toBe("ws://127.0.0.1:38281/");
    t.session.stop();
  });

  it("times out a socket that never opens, and closes it", async () => {
    const t = setup({ [LOCAL]: { kind: "black-hole" } });
    t.session.start();
    await t.clock.advance(7999);
    expect(t.session.status).toMatchObject({
      code: "connecting",
      stage: "socket",
    });
    await t.clock.advance(1);
    expect(t.session.status).toMatchObject({
      code: "timeout",
      stage: "socket",
    });
    expect(t.network.open).toHaveLength(0);
    t.session.stop();
  });

  it("times out a server that opens and never sends RoomInfo, and closes it", async () => {
    // archipelago.js waits for RoomInfo forever, and its disconnect() cannot
    // close a socket it never saw RoomInfo on (bench: silentServer).
    const t = setup({
      [LOCAL]: serve("normal-session", "tracker", { hang: "room-info" }),
    });
    t.session.start();
    await t.clock.advance(8000);
    expect(t.session.status).toMatchObject({
      code: "timeout",
      stage: "room-info",
    });
    expect(t.network.open).toHaveLength(0);
    t.session.stop();
  });

  it("times out a Connect left unanswered", async () => {
    const t = setup({
      [LOCAL]: serve("normal-session", "tracker", { hang: "login" }),
    });
    t.session.start();
    await t.clock.advance(10_010);
    expect(t.session.status).toMatchObject({ code: "timeout", stage: "login" });
    expect(t.network.open).toHaveLength(0);
    t.session.stop();
  });

  it("suspects a paused archipelago.gg room and slows down to 60 s", async () => {
    const at = "wss://archipelago.gg:60030";
    const t = setup({ [at]: { kind: "unreachable" } }, { at });
    t.session.start();
    const hints: string[] = [];
    t.session.subscribe((s) => {
      if (s.code === "unreachable") hints.push(`${s.hint}:${s.retryInMs}`);
    });
    await t.clock.advance(10);
    await t.clock.advance(4000);
    expect(hints).toEqual([
      "unknown:1000",
      "unknown:2000",
      "room-paused:60000",
    ]);
    t.session.stop();
  });

  it("slows down to 60 s when archipelago.gg keeps timing out", async () => {
    const at = "wss://archipelago.gg:60030";
    const t = setup({ [at]: { kind: "black-hole" } }, { at });
    t.session.start();
    const delays: (number | null)[] = [];
    t.session.subscribe((s) => {
      if (s.code === "timeout") delays.push(s.retryInMs);
    });
    await t.clock.advance(8000 + 1000 + 8000 + 2000 + 8000);
    expect(delays).toEqual([1000, 2000, 60_000]);
    t.session.stop();
  });

  it("reconnects after a drop and keeps the items until the server resends them", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker-refresh") });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.snapshot.items).toHaveLength(5);
    const seen: number[] = [];
    t.session.onSnapshot((s) => seen.push(s.items.length));
    t.network.last.drop();
    await t.clock.advance(1);
    expect(t.session.status).toEqual({
      attempt: 1,
      code: "reconnecting",
      retryInMs: 1000,
      url: LOCAL,
    });
    expect(t.session.snapshot.ready).toBe(false);
    await t.clock.advance(1010);
    expect(t.session.status.code).toBe("connected");
    expect(seen.every((n) => n === 5)).toBe(true);
    t.session.stop();
  });

  it("resets the backoff after a connection that lived", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    t.network.last.drop();
    await t.clock.advance(1);
    expect(t.session.status).toMatchObject({
      attempt: 1,
      code: "reconnecting",
    });
    await t.clock.advance(1010);
    // Dropped again at once: the backoff grows.
    t.network.last.drop();
    await t.clock.advance(1);
    expect(t.session.status).toMatchObject({ attempt: 2, retryInMs: 2000 });
    await t.clock.advance(2010);
    await t.clock.advance(10_000);
    t.network.last.drop();
    await t.clock.advance(1);
    expect(t.session.status).toMatchObject({ attempt: 1, retryInMs: 1000 });
    t.session.stop();
  });
});

describe("ArchipelagoSession, keepalive", () => {
  it("reads the race flag every 30 s while visible", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    const gets = () =>
      t.network.last.packets.filter(
        (p) => p.cmd === "Get" && (p.keys as string[])[0] === "_read_race_mode",
      ).length;
    expect(gets()).toBe(1);
    await t.clock.advance(30_000);
    expect(gets()).toBe(2);
    await t.clock.advance(30_000);
    expect(gets()).toBe(3);
    expect(t.session.status.code).toBe("connected");
    t.session.stop();
  });

  it("drops a link whose keepalive goes unanswered", async () => {
    const t = setup({
      [LOCAL]: serve("normal-session", "tracker", { hang: "get" }),
    });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status.code).toBe("connected");
    await t.clock.advance(30_000 + 10_000);
    expect(t.session.status).toMatchObject({
      code: "timeout",
      stage: "keepalive",
    });
    expect(t.network.open).toHaveLength(0);
    t.session.stop();
  });

  it("sends nothing while hidden, and checks at once on return", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    t.visibility.set(true);
    const before = t.network.last.packets.length;
    await t.clock.advance(120_000);
    expect(t.network.last.packets.length).toBe(before);
    t.visibility.set(false);
    await t.clock.advance(1);
    expect(t.network.last.packets.length).toBe(before + 1);
    t.session.stop();
  });
});

describe("ArchipelagoSession, the page and the tab", () => {
  const secure = (
    browser: "firefox" | "safari" | "chromium" | "other",
  ): PageContext => ({
    browser,
    kind: "secure",
  });

  it("blocks what the browser would refuse before opening a socket", async () => {
    const lan = setup(
      {},
      { at: "ws://192.168.1.20:38281", page: secure("firefox") },
    );
    lan.session.start();
    await lan.clock.advance(10);
    expect(lan.session.status).toEqual({
      addressClass: "private",
      browser: "firefox",
      code: "blocked-browser",
    });
    const remote = setup(
      {},
      { at: "ws://example.com:38281", page: secure("chromium") },
    );
    remote.session.start();
    await remote.clock.advance(10);
    expect(remote.session.status).toEqual({
      addressClass: "public",
      code: "blocked-insecure",
    });
    expect([...lan.network.sockets, ...remote.network.sockets]).toHaveLength(0);
  });

  it("reports a browser's own mixed-content refusal and does not loop", async () => {
    const t = setup(
      { "ws://10.0.0.5:38281": { kind: "security-error" } },
      { at: "ws://10.0.0.5:38281", page: secure("other") },
    );
    t.session.start();
    await t.clock.advance(60_000);
    expect(t.session.status).toEqual({
      addressClass: "private",
      code: "blocked-insecure",
    });
    expect(t.codes().filter((c) => c === "connecting")).toHaveLength(1);
  });

  describe("the browser's local network permission", () => {
    const held = (): Route => ({
      kind: "held",
      responder: { client: "tracker", fixture: fixture("normal-session") },
    });
    const gated = (
      routes: Record<string, Route>,
      browser: "chromium" | "firefox" = "chromium",
      at = LOCAL,
    ) => {
      const permission = new FakePermission();
      const t = setup(routes, {
        at,
        page: { browser, gated: true, kind: "secure" },
        permission: permission.factory,
      });
      return { ...t, permission };
    };

    it("says the browser is asking, waits for the answer, then connects", async () => {
      const t = gated({ [LOCAL]: held() });
      t.session.start();
      await t.clock.advance(1499);
      expect(t.session.status.code).toBe("connecting");
      await t.clock.advance(1);
      expect(t.session.status).toEqual({
        code: "local-network-prompt",
        permission: "loopback-network",
        url: LOCAL,
      });
      // No deadline while the player reads the prompt
      await t.clock.advance(120_000);
      expect(t.session.status.code).toBe("local-network-prompt");
      expect(t.network.sockets).toHaveLength(1);
      t.permission.set("granted");
      t.network.last.accept();
      await t.clock.advance(10);
      expect(t.session.status).toEqual({ code: "connected", url: LOCAL });
      expect(t.permission.asked).toEqual(["loopback-network"]);
      t.session.stop();
      expect(t.permission.listening).toBe(0);
    });

    it("waits for the player after a dismissed prompt", async () => {
      const t = gated({ [LOCAL]: held() });
      t.session.start();
      await t.clock.advance(2000);
      t.network.last.drop();
      await t.clock.advance(10);
      expect(t.session.status).toEqual({
        code: "local-network-denied",
        permission: "loopback-network",
        retryInMs: null,
        state: "prompt",
        url: LOCAL,
      });
      // No timer asks again: only the player does
      await t.clock.advance(300_000);
      expect(t.network.sockets).toHaveLength(1);
      t.session.retryNow();
      await t.clock.advance(10);
      expect(t.network.sockets).toHaveLength(2);
      t.session.stop();
    });

    it("reads a prompt the browser turned into a denial", async () => {
      // Chrome's headless mode (Chromium 156, Chrome 155, measured) fails the
      // socket at once and leaves the permission "denied"
      const t = gated({ [LOCAL]: held() });
      t.session.start();
      await t.clock.advance(10);
      t.permission.state = "denied";
      t.network.last.drop();
      await t.clock.advance(10);
      expect(t.session.status).toEqual({
        code: "local-network-denied",
        permission: "loopback-network",
        retryInMs: null,
        state: "denied",
        url: LOCAL,
      });
      // Allowed in the site's settings: the session tries again on its own
      t.network.route(LOCAL, serve("normal-session", "tracker"));
      t.permission.set("granted");
      await t.clock.advance(10);
      expect(t.session.status).toEqual({ code: "connected", url: LOCAL });
      t.session.stop();
    });

    it("leaves a quick failure while undecided to the server", async () => {
      // Playwright's headless shell fails a blocked socket at once and keeps
      // "prompt", as a closed port does: no browser a player uses does that
      const t = gated({ [LOCAL]: { kind: "unreachable" } });
      t.session.start();
      await t.clock.advance(10);
      expect(t.session.status).toMatchObject({
        code: "unreachable",
        hint: "not-running",
        retryInMs: 1000,
      });
      t.session.stop();
    });

    it("claims no prompt for a LAN socket that hangs", async () => {
      // Chromium checks a LAN address once connected: an unreachable host
      // hangs as long as a prompt would, the permission untouched (measured)
      const lan = "ws://192.168.1.20:38281";
      const t = gated({ [lan]: { kind: "black-hole" } }, "chromium", lan);
      t.session.start();
      await t.clock.advance(7999);
      expect(t.codes()).not.toContain("local-network-prompt");
      await t.clock.advance(10);
      expect(t.session.status).toMatchObject({
        code: "timeout",
        stage: "socket",
      });
      t.session.stop();
    });

    it("leaves Firefox's quick failure to the server", async () => {
      // Firefox 157 reads "prompt" yet connects without asking (measured):
      // a closed port is a closed port
      const t = gated({ [LOCAL]: { kind: "unreachable" } }, "firefox");
      t.session.start();
      await t.clock.advance(10);
      expect(t.session.status).toMatchObject({
        code: "unreachable",
        hint: "not-running",
      });
      expect(t.session.status).toHaveProperty("retryInMs", 1000);
      t.session.stop();
    });

    it("opens no socket while the permission is denied", async () => {
      const lan = "ws://192.168.1.20:38281";
      const t = gated(
        { [lan]: serve("normal-session", "tracker") },
        "chromium",
        lan,
      );
      t.permission.state = "denied";
      t.session.start();
      await t.clock.advance(60_000);
      expect(t.session.status).toEqual({
        code: "local-network-denied",
        permission: "local-network",
        retryInMs: null,
        state: "denied",
        url: lan,
      });
      expect(t.network.sockets).toHaveLength(0);
      // Retry asks the browser again, and finds it still denied
      t.session.retryNow();
      await t.clock.advance(10);
      expect(t.network.sockets).toHaveLength(0);
      t.permission.set("granted");
      await t.clock.advance(10);
      expect(t.session.status).toEqual({ code: "connected", url: lan });
      t.session.stop();
    });

    it("asks nothing of a public host, the desktop app or an http page", async () => {
      const permission = new FakePermission();
      for (const [at, page] of [
        ["wss://archipelago.gg:60030", secure("chromium")],
        [LOCAL, { kind: "desktop" }],
        [LOCAL, { kind: "insecure" }],
      ] as const) {
        const t = setup(
          { "*": serve("normal-session", "tracker") },
          { at, page, permission: permission.factory },
        );
        t.session.start();
        await t.clock.advance(10);
        expect(t.session.status.code).toBe("connected");
        t.session.stop();
      }
      expect(permission.asked).toEqual([]);
    });
  });

  it("waits while another tab holds the connection", async () => {
    let grant: (held: boolean) => void = () => {};
    let released = 0;
    const lock: TabLock = {
      release: () => {
        released++;
      },
      take: (_current, waiting) => {
        waiting(true);
        return new Promise((resolve) => {
          grant = resolve;
        });
      },
    };
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") }, { lock });
    t.session.start();
    await t.clock.advance(10);
    expect(t.session.status).toEqual({ code: "elsewhere" });
    expect(t.network.sockets).toHaveLength(0);
    grant(true);
    await t.clock.advance(10);
    expect(t.session.status.code).toBe("connected");
    t.session.stop();
    expect(released).toBe(1);
  });

  it("gives up when the lock is not granted", async () => {
    const lock: TabLock = { release: () => {}, take: async () => false };
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") }, { lock });
    t.session.start();
    await t.clock.advance(10);
    expect(t.network.sockets).toHaveLength(0);
  });
});

describe("ArchipelagoSession, lifecycle and requests", () => {
  it("leaves no timer, socket or listener after stop", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    t.session.start();
    await t.clock.advance(10);
    t.session.stop();
    t.session.stop();
    await flush();
    expect(t.clock.pending).toBe(0);
    expect(t.network.open).toHaveLength(0);
    expect(t.visibility.listening).toBe(0);
    expect(t.online.listening).toBe(0);
    expect(t.session.status).toEqual({ code: "stopped" });
  });

  it("writes nothing once stopped mid-connect", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    t.session.stop();
    const before = t.statuses.length;
    await t.clock.advance(20_000);
    expect(t.statuses.length).toBe(before);
    expect(t.session.snapshot.ready).toBe(false);
  });

  it("stops when the guard refuses a packet", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    await expect(
      t.session.get(["_read_hints_0_1", "my_own_key"]),
    ).rejects.toBeInstanceOf(GuardError);
    expect(t.session.status).toMatchObject({ code: "stopped" });
    expect((t.session.status as { detail?: string }).detail).toMatch(
      /my_own_key/,
    );
    expect(
      t.network.last.packets.some(
        (p) => p.cmd === "Get" && JSON.stringify(p).includes("my_own_key"),
      ),
    ).toBe(false);
  });

  it("rejects requests while not connected", async () => {
    const t = setup({});
    await expect(t.session.get(["_read_race_mode"])).rejects.toBeInstanceOf(
      RequestError,
    );
  });

  it("rejects a request when its connection closes", async () => {
    const t = setup({
      [LOCAL]: serve("normal-session", "tracker", { hang: "get" }),
    });
    t.session.start();
    await t.clock.advance(10);
    const pending = t.session.get(["_read_slot_data_1"]);
    t.network.last.drop();
    await expect(pending).rejects.toThrow("The connection closed");
    t.session.stop();
  });

  it("rejects a request left unanswered", async () => {
    const t = setup(
      { [LOCAL]: serve("normal-session", "tracker", { hang: "get" }) },
      { timeouts: { keepaliveEveryMs: 1_000_000 } },
    );
    t.session.start();
    await t.clock.advance(10);
    const pending = t.session.get(["_read_slot_data_1"]);
    const settled = expect(pending).rejects.toThrow("No answer to Get in time");
    await t.clock.advance(10_000);
    await settled;
    t.session.stop();
  });

  it("loads name data and location groups through the session", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    const loader = new NameDataLoader({
      fetch: (game) => t.session.getDataPackage(game),
      store: memoryStore(),
    });
    const game = t.session.snapshot.identity?.game ?? "";
    const names = await loader.load(
      game,
      t.session.snapshot.room?.checksums[game],
    );
    expect(names.locations.size).toBe(286);
    expect(names.items.get(169)).toBeTypeOf("string");
    const sent = t.network.last.packets.filter(
      (p) => p.cmd === "GetDataPackage",
    );
    expect(sent).toEqual([
      { cmd: "GetDataPackage", games: ["A Link to the Past"] },
    ]);
    t.session.stop();
  });

  it("drops a snapshot of another run and says so", async () => {
    const other = {
      ...EMPTY_SNAPSHOT,
      identity: {
        game: "A Link to the Past",
        generatorVersion: "0.6.8",
        seedName: "another seed",
        slot: 1,
        team: 0,
      },
      items: [{ flags: 0, item: 1, location: 1, player: 1 }],
      raceMode: true,
    };
    const t = setup(
      { [LOCAL]: serve("normal-session", "tracker") },
      { snapshot: other },
    );
    const resets: boolean[] = [];
    t.session.onSnapshot((_, reset) => resets.push(reset));
    t.session.start();
    await t.clock.advance(10);
    expect(resets).toContain(true);
    expect(t.session.snapshot.items).toEqual([]);
    expect(t.session.snapshot.raceMode).toBe(false);
  });

  it("unsubscribes listeners", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    const calls: string[] = [];
    const a = t.session.subscribe(() => calls.push("status"));
    const b = t.session.onSnapshot(() => calls.push("snapshot"));
    const c = t.session.onPacket(() => calls.push("packet"));
    a();
    b();
    c();
    t.session.start();
    await t.clock.advance(10);
    expect(calls).toEqual([]);
    expect(t.session.statusSince).toBe(t.clock.now() - 10);
    t.session.stop();
  });

  it("takes the host's clock, id and network by default", () => {
    const session = new ArchipelagoSession({
      address: address(LOCAL),
      page: { kind: "desktop" },
      slot: "Link",
    });
    expect(session.status).toEqual({ code: "idle" });
    expect(session.snapshot).toBe(EMPTY_SNAPSHOT);
  });

  it("ignores frames that are not packets", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    const before = t.session.snapshot;
    t.network.last.deliver([[5, "x", { no: "cmd" }]]);
    await t.clock.advance(1);
    expect(t.session.snapshot).toBe(before);
    expect(t.session.status.code).toBe("connected");
    t.session.stop();
  });

  it("checks the link at once when the page shows again", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    const gets = () =>
      t.network.last.packets.filter((p) => p.cmd === "Get").length;
    const before = gets();
    t.visibility.set(false);
    await t.clock.advance(1);
    expect(gets()).toBe(before + 1);
    // Rescheduled: the next one 30 s after this one, not two in a row.
    await t.clock.advance(29_000);
    expect(gets()).toBe(before + 1);
    await t.clock.advance(1000);
    expect(gets()).toBe(before + 2);
    t.session.stop();
  });

  it("answers two name-data requests in flight, each with its game", async () => {
    const t = setup({ [LOCAL]: serve("normal-session", "tracker") });
    t.session.start();
    await t.clock.advance(10);
    const [sm, quest] = await Promise.all([
      t.session.getDataPackage("Super Metroid"),
      t.session.getDataPackage("APQuest"),
    ]);
    expect((sm as { checksum: string }).checksum).toBe(
      "4fd6c0bb6c0f0ab1157fb5dbda01a572ae3d0da6",
    );
    expect((quest as { checksum: string }).checksum).toBe(
      "854499b00d82a68764ce591dd80218ad75e83e2b",
    );
    t.session.stop();
  });
});

describe("backoffDelay", () => {
  it("doubles from 1 s to 30 s, minus up to 20 % jitter", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7].map((n) =>
        backoffDelay(n, DEFAULT_BACKOFF, () => 0),
      ),
    ).toEqual([1000, 2000, 4000, 8000, 16_000, 30_000, 30_000]);
    expect(backoffDelay(1, DEFAULT_BACKOFF, () => 1)).toBe(800);
  });
});
