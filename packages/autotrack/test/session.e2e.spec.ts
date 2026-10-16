// One realistic session, end to end: the real usb2snes transport over Node's
// WebSocket client, against the fake bridge, on real timers.
import { afterEach, describe, expect, it } from "vitest";
import { bus } from "../src/address";
import type { SessionStatus } from "../src/diagnostics";
import type { LocalNetworkPermission } from "../src/permission";
import { AutotrackSession } from "../src/session";
import { FakeUsb2Snes } from "./fake-usb2snes";
import { bootGame, SAMPLE_PACK } from "./fixtures";

const granted: LocalNetworkPermission = {
  query: () => Promise.resolve({ name: "loopback-network", state: "granted" }),
  subscribe: () => () => {},
};
const visible = { hidden: () => false, subscribe: () => () => {} };

let server: FakeUsb2Snes | null = null;
let session: AutotrackSession | null = null;

afterEach(async () => {
  session?.stop();
  await server?.stop();
  server = null;
  session = null;
});

function start(url: string): {
  session: AutotrackSession;
  statuses: SessionStatus[];
  changed: string[];
} {
  const statuses: SessionStatus[] = [];
  const changed: string[] = [];
  const created = new AutotrackSession({
    backoff: { initialMs: 50, jitter: 0, maxMs: 200 },
    pack: SAMPLE_PACK,
    permission: granted,
    stableAfterMs: 100,
    url,
    visibility: visible,
  });
  created.subscribe((status) => statuses.push(status));
  created.onUpdate((update) => changed.push(...update.changed));
  created.start();
  session = created;
  return { changed, session: created, statuses };
}

async function until(condition: () => boolean, ms = 3000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition() && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 10));
  expect(condition()).toBe(true);
}

function touches(
  reads: readonly [number, number][],
  ranges: readonly { address: number; size: number }[],
) {
  return reads.some(([address, size]) =>
    ranges.some(
      (r) => r.address < address + size && r.address + r.size > address,
    ),
  );
}

describe("an autotracking session against a fake SNI", () => {
  it("connects, tracks, enters Race Mode on a race ROM, survives a drop, and stops clean", async () => {
    server = await FakeUsb2Snes.start();
    bootGame(server.memory);
    const run = start(server.url);
    const fake = server;
    const status = () => run.session.status;

    await until(() => status().code === "connected");
    expect(status()).toMatchObject({
      bridge: { kind: "sni", version: "0.0.103" },
      device: { device: { kind: "retroarch" }, rom: "alttpr - seed" },
      race: { active: false, flag: "open", raceLegal: false },
    });
    expect(fake.opcodes().slice(0, 5)).toEqual([
      "AppVersion",
      "Name",
      "DeviceList",
      "Attach",
      "Info",
    ]);

    // An item picked up shows in a later poll.
    run.changed.length = 0;
    fake.memory[bus(0x7e_f340)] = 0x01;
    await until(() => run.changed.includes("items"));
    expect(run.session.snapshot?.bytes("items")[0]).toBe(0x01);

    // A race seed: Race Mode switches on, and no forbidden byte is asked for.
    fake.memory[bus(0x30_8213)] = 0x01;
    await until(() => run.session.race?.active === true);
    expect(status()).toMatchObject({
      code: "connected",
      race: { flag: "race", raceLegal: true },
    });
    fake.reads.length = 0;
    await new Promise((r) => setTimeout(r, 600));
    expect(fake.reads.length).toBeGreaterThan(0);
    expect(touches(fake.reads, SAMPLE_PACK.forbiddenBytes)).toBe(false);
    expect(fake.overlapped).toBe(false);

    // The bridge drops everyone; the session comes back on its own.
    const accepted = fake.accepted;
    fake.dropAll();
    await until(
      () => fake.accepted > accepted && status().code === "connected",
    );

    // Stop: the socket closes and nothing tries again.
    run.session.stop();
    await until(() => fake.connections === 0);
    const after = fake.accepted;
    await new Promise((r) => setTimeout(r, 300));
    expect(fake.accepted).toBe(after);
    expect(status().code).toBe("stopped");
  });

  it("diagnoses RetroArch on a core without a memory map", async () => {
    server = await FakeUsb2Snes.start();
    bootGame(server.memory);
    server.read = "drop"; // what SNI does when mapping detection fails
    const run = start(server.url);
    await until(() => run.session.status.code === "memory-unreadable");
    expect(run.session.status).toMatchObject({
      cause: "no-memory-map",
      evidence: "inferred",
      remedy: { action: "switch-core", core: "bsnes-mercury" },
    });
  });

  it("waits for the user when QUsb2Snes does not trust the site", async () => {
    server = await FakeUsb2Snes.start({
      appVersion: "QUsb2Snes-0.7.42",
      refuseOrigin: true,
    });
    bootGame(server.memory);
    const run = start(server.url);
    await until(() => run.session.status.code === "bridge-refused");
    const accepted = server.accepted;
    await new Promise((r) => setTimeout(r, 300));
    expect(server.accepted).toBe(accepted);
    server.refuseOrigin = false;
    run.session.retryNow();
    await until(() => run.session.status.code === "connected");
  });
});
