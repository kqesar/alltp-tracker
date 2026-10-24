import { NO_LOCK, parseAddress, type ServerAddress } from "@alltp/archipelago";
import { describe, expect, it, vi } from "vitest";
import type { NameCache } from "@/games/archipelago/datapackageCache";
import { ROOM_ADDRESS, startRoom } from "@/games/archipelago/fixtures";
import { type RuntimeSink, startRuntime } from "@/games/archipelago/runtime";

const address = (() => {
  const parsed = parseAddress(ROOM_ADDRESS);
  if (!parsed.ok || parsed.kind !== "server") throw new Error("bad address");
  return parsed.address as ServerAddress;
})();

/** A cache that never has a package and cannot keep one. */
const failingCache = (): NameCache => ({
  get: async () => {
    throw new Error("cache gone");
  },
  getGroups: async () => undefined,
  put: async () => {},
  putGroups: vi.fn(async () => {}),
});

const sink = () =>
  ({
    away: vi.fn(),
    countdown: vi.fn(),
    goal: vi.fn(),
    groups: vi.fn(),
    names: vi.fn(),
    run: vi.fn(),
    status: vi.fn(),
  }) satisfies RuntimeSink;

describe("the runtime", () => {
  it("keeps the groups and the run when the names cannot load", async () => {
    const room = startRoom();
    const cache = failingCache();
    const to = sink();
    const runtime = startRuntime(
      {
        address,
        cache,
        checksum: null,
        lock: NO_LOCK,
        page: { kind: "insecure" },
        password: "",
        slot: "Link",
        uuid: "device",
        webSocket: room.network.factory,
      },
      to,
    );
    await vi.waitFor(() => expect(to.groups).toHaveBeenCalled());
    expect(cache.putGroups).toHaveBeenCalled();
    expect(to.names).not.toHaveBeenCalled();
    // Names unknown: the run still comes, items by id
    await vi.waitFor(() => expect(to.run).toHaveBeenCalled());
    runtime.stop();
    runtime.stop();
    const calls = to.status.mock.calls.length;
    runtime.retryNow();
    expect(to.status.mock.calls.length).toBe(calls);
  });
});
