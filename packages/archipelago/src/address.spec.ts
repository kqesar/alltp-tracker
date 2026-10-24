import { describe, expect, it } from "vitest";
import {
  addressClass,
  type BrowserFamily,
  connectPlan,
  isArchipelagoGg,
  type PageContext,
  parseAddress,
  parseRoomStatus,
  roomAddress,
  roomPageUrl,
  roomStatusUrl,
  type ServerAddress,
} from "./address";

describe("parseAddress", () => {
  it.each([
    [
      "archipelago.gg:38281",
      { host: "archipelago.gg", port: 38281, scheme: null },
    ],
    [
      "/connect archipelago.gg:60030",
      { host: "archipelago.gg", port: 60030, scheme: null },
    ],
    [
      "  /CONNECT   Archipelago.GG:60030 ",
      { host: "archipelago.gg", port: 60030, scheme: null },
    ],
    [
      "wss://archipelago.gg:60030",
      { host: "archipelago.gg", port: 60030, scheme: "wss" },
    ],
    [
      "WSS://archipelago.gg:60030/",
      { host: "archipelago.gg", port: 60030, scheme: "wss" },
    ],
    [
      "ws://192.168.1.20:38281",
      { host: "192.168.1.20", port: 38281, scheme: "ws" },
    ],
    ["localhost:38281", { host: "localhost", port: 38281, scheme: null }],
    ["localhost", { host: "localhost", port: 38281, scheme: null }],
    ["[::1]:38281", { host: "[::1]", port: 38281, scheme: null }],
    ["ws://[fd00::5]", { host: "[fd00::5]", port: 38281, scheme: "ws" }],
    [
      "my-server.example.org.:1",
      { host: "my-server.example.org.", port: 1, scheme: null },
    ],
  ])("reads %s", (input, address) => {
    expect(parseAddress(input)).toEqual({ address, kind: "server", ok: true });
  });

  it.each([
    "https://archipelago.gg/room/AbC-dEf_123",
    "http://archipelago.gg/room/AbC-dEf_123/",
    "archipelago.gg/room/AbC-dEf_123",
    "https://www.archipelago.gg/room/AbC-dEf_123?x=1",
  ])("reads the room link %s", (input) => {
    expect(parseAddress(input)).toEqual({
      kind: "room-link",
      ok: true,
      room: { id: "AbC-dEf_123" },
    });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["/connect ", "empty"],
    ["https://archipelago.gg/seed/abc", "unsupported-scheme"],
    ["http://example.com:38281", "unsupported-scheme"],
    ["ftp://host", "unsupported-scheme"],
    ["host:port", "invalid-port"],
    ["host:0", "invalid-port"],
    ["host:65536", "invalid-port"],
    ["host:123456", "invalid-port"],
    ["host:", "invalid-port"],
    ["host:1:2", "invalid-host"],
    ["[::1", "invalid-host"],
    ["[::1]x", "invalid-host"],
    ["[127]", "invalid-host"],
    ["-bad.example", "invalid-host"],
    ["300.1.1.1", "invalid-host"],
    ["1.2.3", "invalid-host"],
    ["under_score.example", "invalid-host"],
    ["ws://host:38281/path", "unexpected-path"],
    ["user@host", "unexpected-path"],
    ["two words", "unexpected-path"],
  ])("refuses %j (%s)", (input, error) => {
    expect(parseAddress(input)).toEqual({ error, ok: false });
  });
});

describe("addressClass", () => {
  it.each([
    ["localhost", "loopback"],
    ["tracker.localhost", "loopback"],
    ["127.0.0.1", "loopback"],
    ["127.4.5.6", "loopback"],
    ["[::1]", "loopback"],
    ["[0:0:0:0:0:0:0:1]", "loopback"],
    ["10.0.0.5", "private"],
    ["172.16.0.1", "private"],
    ["172.31.255.1", "private"],
    ["192.168.1.20", "private"],
    ["169.254.3.3", "private"],
    ["0.0.0.0", "private"],
    ["[fd00::5]", "private"],
    ["[fe80::1]", "private"],
    ["nas.local", "private"],
    ["172.32.0.1", "public"],
    ["8.8.8.8", "public"],
    ["[2001:db8::1]", "public"],
    ["archipelago.gg", "public"],
  ])("%s is %s", (host, kind) => {
    expect(addressClass(host)).toBe(kind);
  });

  it("knows archipelago.gg and its subdomains", () => {
    expect(isArchipelagoGg("archipelago.gg")).toBe(true);
    expect(isArchipelagoGg("archipelago.gg.")).toBe(true);
    expect(isArchipelagoGg("eu.archipelago.gg")).toBe(true);
    expect(isArchipelagoGg("notarchipelago.gg")).toBe(false);
  });
});

describe("connectPlan, the measured table", () => {
  const at = (text: string): ServerAddress => {
    const parsed = parseAddress(text);
    if (!parsed.ok || parsed.kind !== "server") throw new Error(text);
    return parsed.address;
  };
  const site = (browser: BrowserFamily): PageContext => ({
    browser,
    kind: "secure",
  });

  it("sends archipelago.gg over wss only, from everywhere", () => {
    for (const page of [
      site("safari"),
      { kind: "desktop" } as const,
      { kind: "insecure" } as const,
    ]) {
      expect(connectPlan(at("archipelago.gg:60030"), page)).toEqual({
        localNetwork: false,
        ok: true,
        urls: ["wss://archipelago.gg:60030"],
      });
    }
  });

  it("tries wss then ws for a scheme-less self-hosted server where ws is allowed", () => {
    expect(connectPlan(at("192.168.1.20:38281"), { kind: "desktop" })).toEqual({
      localNetwork: false,
      ok: true,
      urls: ["wss://192.168.1.20:38281", "ws://192.168.1.20:38281"],
    });
    expect(connectPlan(at("example.com:38281"), site("chromium"))).toEqual({
      localNetwork: false,
      ok: true,
      urls: ["wss://example.com:38281"],
    });
    expect(connectPlan(at("192.168.1.20"), site("firefox"))).toEqual({
      localNetwork: false,
      ok: true,
      urls: ["wss://192.168.1.20:38281"],
    });
  });

  // [address, chromium, firefox, safari, other], from an https page.
  const table: [string, ...(string | true)[]][] = [
    [
      "ws://example.com:1",
      "blocked-insecure",
      "blocked-insecure",
      "blocked-insecure",
      "blocked-insecure",
    ],
    ["ws://127.0.0.1:1", true, true, "blocked-browser", true],
    ["ws://192.168.1.2:1", true, "blocked-browser", "blocked-browser", true],
    ["wss://192.168.1.2:1", true, true, true, true],
    ["wss://example.com:1", true, true, true, true],
  ];
  it.each(table)("%s from the site", (text, ...verdicts) => {
    const browsers: BrowserFamily[] = [
      "chromium",
      "firefox",
      "safari",
      "other",
    ];
    browsers.forEach((browser, index) => {
      const plan = connectPlan(at(text), site(browser));
      expect(plan.ok ? true : plan.code).toBe(verdicts[index]);
    });
  });

  it("flags Chromium's local network prompt", () => {
    expect(connectPlan(at("ws://127.0.0.1:1"), site("chromium"))).toMatchObject(
      {
        localNetwork: true,
      },
    );
    expect(
      connectPlan(at("wss://192.168.0.2:1"), site("chromium")),
    ).toMatchObject({
      localNetwork: true,
    });
    expect(connectPlan(at("ws://127.0.0.1:1"), site("firefox"))).toMatchObject({
      localNetwork: false,
    });
  });

  it("lets the desktop app and http pages open any ws://", () => {
    for (const page of [{ kind: "desktop" }, { kind: "insecure" }] as const) {
      expect(connectPlan(at("ws://example.com:1"), page)).toEqual({
        localNetwork: false,
        ok: true,
        urls: ["ws://example.com:1"],
      });
    }
  });

  it("names the address class of a blocked plan", () => {
    expect(connectPlan(at("ws://10.1.1.1:1"), site("safari"))).toEqual({
      addressClass: "private",
      code: "blocked-browser",
      ok: false,
    });
  });
});

describe("room links", () => {
  it("builds the API and page URLs", () => {
    expect(roomStatusUrl({ id: "AbC-1" })).toBe(
      "https://archipelago.gg/api/room_status/AbC-1",
    );
    expect(roomPageUrl({ id: "AbC-1" })).toBe(
      "https://archipelago.gg/room/AbC-1",
    );
  });

  it("reads a room status body (shape measured in gate A)", () => {
    const body = {
      downloads: [],
      last_activity: "Sat, 24 Oct 2026 17:07:15 GMT",
      last_port: 60030,
      players: [
        ["Link", "A Link to the Past"],
        ["Samus", "Super Metroid"],
      ],
      timeout: 7200,
      tracker: "abc",
    };
    const status = parseRoomStatus(body);
    expect(status).toEqual({
      players: [
        { game: "A Link to the Past", name: "Link" },
        { game: "Super Metroid", name: "Samus" },
      ],
      port: 60030,
    });
    expect(status && roomAddress(status)).toEqual({
      host: "archipelago.gg",
      port: 60030,
      scheme: null,
    });
  });

  it.each([
    [null, null],
    ["text", null],
    [{ players: "x" }, null],
    [{ players: [["Link"]] }, null],
    [{ players: [[1, "game"]] }, null],
  ])("refuses %j", (body, expected) => {
    expect(parseRoomStatus(body)).toBe(expected);
  });

  it("has no address for a room that never ran", () => {
    for (const lastPort of [0, -1, 70000, "60030", 1.5, undefined]) {
      const status = parseRoomStatus({ last_port: lastPort, players: [] });
      expect(status?.port).toBeNull();
      expect(status && roomAddress(status)).toBeNull();
    }
  });
});
