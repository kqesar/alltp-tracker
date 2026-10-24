// The session over a real socket: Node's WebSocket (the one browsers
// expose) and the real archipelago.js, against the in-process fake server.
import { afterEach, describe, expect, it } from "vitest";
import { parseAddress, type ServerAddress } from "../src/address";
import type { SessionStatus } from "../src/diagnostics";
import { ArchipelagoSession, type SessionOptions } from "../src/session";
import { FakeApServer, type FakeApServerOptions } from "./fake-ap-server";
import { fixture } from "./fixtures";
import { recordedSync } from "./responder";

const servers: FakeApServer[] = [];
const sessions: ArchipelagoSession[] = [];

afterEach(async () => {
  for (const session of sessions.splice(0)) session.stop();
  for (const server of servers.splice(0)) await server.close();
});

function address(url: string): ServerAddress {
  const parsed = parseAddress(url);
  if (!parsed.ok || parsed.kind !== "server") throw new Error(url);
  return parsed.address;
}

async function serve(options: Partial<FakeApServerOptions> = {}) {
  const server = await FakeApServer.start({
    client: "tracker",
    fixture: fixture("normal-session"),
    ...options,
  });
  servers.push(server);
  return server;
}

function track(url: string, options: Partial<SessionOptions> = {}) {
  const session = new ArchipelagoSession({
    address: address(url),
    page: { kind: "desktop" },
    random: () => 0,
    slot: "Link",
    timeouts: { loginMs: 400, roomInfoMs: 400, socketMs: 400 },
    uuid: "e2e",
    ...options,
  });
  sessions.push(session);
  const seen: SessionStatus[] = [];
  session.subscribe((status) => seen.push(status));
  session.start();
  return { seen, session };
}

async function until(check: () => boolean, ms = 5000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error("timed out waiting");
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("session over a real WebSocket", () => {
  it("connects, folds pushed frames and resyncs a gap", async () => {
    const server = await serve();
    const { session } = track(server.url);
    await until(() => session.status.code === "connected");
    expect(session.snapshot.identity?.game).toBe("A Link to the Past");
    const later = server.responders[0].later();
    const gapAt = later.findIndex(
      (f) => f[0]?.cmd === "ReceivedItems" && f[0]?.index === 1,
    );
    server.push(later.slice(0, gapAt));
    server.responders[0].track([later[gapAt]]);
    server.push(later.slice(gapAt + 1, recordedSync(later)));
    await until(() => session.snapshot.items.length === 5);
    // The recording ends with its own index-0 frame: wait for the Sync itself.
    await until(() => server.received.some((p) => p.cmd === "Sync"));
    expect(session.snapshot.checked).toHaveLength(4);
  });

  it("is refused a wrong password and waits", async () => {
    const server = await serve({
      client: "password:wrong password",
      fixture: fixture("password"),
      refuse: ["InvalidPassword"],
    });
    const { session } = track(server.url, { password: "nope" });
    await until(() => session.status.code === "refused");
    expect(session.status).toMatchObject({ reasons: ["InvalidPassword"] });
    expect(server.received[0]).toMatchObject({
      cmd: "Connect",
      password: "nope",
    });
    await until(() => server.connections === 0);
  });

  it("closes a socket the server never sends RoomInfo on", async () => {
    // archipelago.js alone would hold it open forever (bench: silentServer).
    const server = await serve({ hang: "room-info" });
    const { session } = track(server.url);
    await until(() => session.status.code === "timeout");
    expect(session.status).toMatchObject({ stage: "room-info" });
    await until(() => server.connections === 0);
  });

  it("times out a Connect left unanswered", async () => {
    const server = await serve({ hang: "login" });
    const { session } = track(server.url);
    await until(() => session.status.code === "timeout");
    expect(session.status).toMatchObject({ stage: "login" });
  });

  it("reconnects after the server cuts the connection", async () => {
    const server = await serve();
    const { seen, session } = track(server.url);
    await until(() => session.status.code === "connected");
    server.drop();
    await until(() => seen.some((s) => s.code === "reconnecting"));
    await until(() => seen.filter((s) => s.code === "connected").length === 2);
    expect(server.responders).toHaveLength(2);
  });

  it("says nothing listens on a closed port", async () => {
    const server = await serve();
    const url = server.url;
    await server.close();
    servers.splice(0);
    const { session } = track(url);
    await until(() => session.status.code === "unreachable");
    expect(session.status).toMatchObject({ hint: "not-running" });
  });
});
