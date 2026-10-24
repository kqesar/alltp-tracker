// Against a real Archipelago server, hosting test/server/normal-seed4242.archipelago
// (README, "Checked against a real server"). Skipped unless AP_SERVER_URL
// is set, e.g. AP_SERVER_URL=ws://127.0.0.1:38281 pnpm vitest run --project archipelago real-server
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parseAddress } from "../src/address";
import {
  loadLocationGroups,
  memoryStore,
  NameDataLoader,
} from "../src/datapackage";
import { ArchipelagoSession } from "../src/session";

const url = process.env.AP_SERVER_URL;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const upstream = JSON.parse(readFileSync(join(root, "upstream.json"), "utf8"));
const sessions: ArchipelagoSession[] = [];

afterEach(() => {
  for (const session of sessions.splice(0)) session.stop();
});

function open(slot: string): ArchipelagoSession {
  const parsed = parseAddress(url ?? "");
  if (!parsed.ok || parsed.kind !== "server")
    throw new Error(`Bad AP_SERVER_URL: ${url}`);
  const session = new ArchipelagoSession({
    address: parsed.address,
    page: { kind: "desktop" },
    slot,
  });
  sessions.push(session);
  session.start();
  return session;
}

function settled(
  session: ArchipelagoSession,
  code: string,
  ms = 15_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`still ${session.status.code}`)),
      ms,
    );
    const check = () => {
      if (session.status.code !== code) return;
      clearTimeout(timer);
      off();
      resolve();
    };
    const off = session.subscribe(check);
    check();
  });
}

describe.skipIf(url === undefined)(`real server at ${url}`, () => {
  it("tracks the bench multiworld's ALttP slot, read-only", async () => {
    const session = open("Link");
    await settled(session, "connected");
    const snapshot = session.snapshot;
    expect(snapshot.room?.serverVersion).toBe(upstream.release);
    expect(snapshot.identity).toMatchObject({
      game: "A Link to the Past",
      generatorVersion: upstream.release,
      seedName: "72844992796894532502",
      slot: 1,
    });
    expect(snapshot.checked.length + snapshot.missing.length).toBe(249);
    // The race flag arrives right after Connected, with the slot's hints
    // and every player's status (this tracker's own makes Link connected).
    await expect.poll(() => session.snapshot.raceMode).toBe(false);
    await expect.poll(() => session.snapshot.hints).toEqual([]);
    await expect
      .poll(() => Object.keys(session.snapshot.clientStatus).length)
      .toBe(4);
    expect(session.snapshot.clientStatus[1]).toBe(5);

    const game = "A Link to the Past";
    const names = await new NameDataLoader({
      fetch: (g) => session.getDataPackage(g),
      store: memoryStore(),
    }).load(game, snapshot.room?.checksums[game]);
    expect(names.checksum).toBe(upstream.nameData[game]);
    expect(names.locations.size).toBe(286);
    const groups = await loadLocationGroups(game, (keys) => session.get(keys));
    expect(Object.keys(groups).length).toBeGreaterThan(10);
    expect(groups).not.toHaveProperty("Everywhere");
  });

  it("is refused a slot name in the wrong case", async () => {
    const session = open("link");
    await settled(session, "refused");
    expect(session.status).toMatchObject({ reasons: ["InvalidSlot"] });
  });
});
