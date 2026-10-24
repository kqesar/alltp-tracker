import { parseUserAgent } from "@alltp/autotrack";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeLocks,
  FakeVisibility,
  GRANTED,
  ManualClock,
  settle,
} from "@/autotrack/fixtures";
import {
  connectSmAutotrack,
  disconnectSmAutotrack,
  retrySmAutotrack,
  setSmAutotrackOptions,
  stopSmAutotrack,
  useSmAutotrackStore,
} from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import {
  type MapRandoGame,
  writeMapRando,
} from "../../../../../../packs/sm/test/sm-rom";

const state = () => useSmAutotrackStore.getState();
const run = () => useSmStore.getState();

/** What localStorage keeps of Super Metroid's autotracking. */
const saved = () =>
  JSON.parse(localStorage.getItem("alltp-tracker-sm-autotrack") ?? "null")
    ?.state;

/** A console playing a Map Rando seed, behind an in-memory bridge. */
const harness = (game: MapRandoGame = {}) => {
  const memory = writeMapRando(new Uint8Array(0x100_0000), game);
  const clock = new ManualClock();
  const transports: MemoryTransport[] = [];
  setSmAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => {
      const transport = new MemoryTransport(memory);
      transports.push(transport);
      return transport;
    },
    visibility: new FakeVisibility(),
  });
  return {
    advance: (ms: number) => clock.advance(ms),
    memory,
    /** The game moves on: memory now holds `next`. */
    play: (next: MapRandoGame) => writeMapRando(memory, { ...game, ...next }),
    transports,
  };
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  useSmStore.setState(useSmStore.getInitialState(), true);
  useSmAutotrackStore.setState(useSmAutotrackStore.getInitialState(), true);
  useSmAutotrackStore.setState({
    environment: parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    ),
  });
});

afterEach(() => {
  stopSmAutotrack();
  setSmAutotrackOptions({});
});

describe("Super Metroid's autotracking", () => {
  it("reads the seed and lays the game on the run as it is played", async () => {
    const h = harness({
      done: ["kraid"],
      items: 0x0004,
      name: "Zebes42",
      objectives: ["kraid", "ridley"],
    });
    await connectSmAutotrack();
    await h.advance(0);

    expect(state().status.code).toBe("connected");
    expect(state().reading?.seed).toMatchObject({ name: "Zebes42" });
    expect(run()).toMatchObject({
      done: ["kraid"],
      objectives: ["kraid", "ridley"],
    });
    expect(run().items.morph).toBe(1);

    h.play({ maxSupers: 10 });
    await h.advance(2000);

    expect(run().items.superMissile).toBe(2);
    expect(saved()).toEqual({ connectOnStart: true, raceChoice: "auto" });
  });

  it("refuses a ROM that is not a Map Rando seed", async () => {
    const h = harness({ items: 0x0004 });
    // The original game's header, at ROM 0x7FC0
    h.memory.set(new TextEncoder().encode("Super Metroid        "), 0x7fc0);
    await connectSmAutotrack();
    await h.advance(0);

    expect(state().status.code).toBe("game-mismatch");
    expect(run().items.morph).toBe(0);
  });

  it("stops on its own word, and forgets connecting on start at the player's", async () => {
    harness();
    await connectSmAutotrack();
    stopSmAutotrack();
    expect(state()).toMatchObject({ active: false, reading: null });
    expect(state().status.code).toBe("stopped");
    expect(saved()).toEqual({ connectOnStart: true, raceChoice: "auto" });

    await connectSmAutotrack();
    disconnectSmAutotrack();
    expect(saved()).toEqual({ connectOnStart: false, raceChoice: "auto" });
  });

  it("retries now at the player's word", async () => {
    const h = harness();
    expect(retrySmAutotrack()).toBeUndefined();
    await connectSmAutotrack();
    await h.advance(0);
    retrySmAutotrack();
    await h.advance(0);
    expect(state().status.code).toBe("connected");
  });

  it("starts once: a second connect while one runs does nothing", async () => {
    const h = harness();
    await connectSmAutotrack();
    await connectSmAutotrack();
    await h.advance(0);
    expect(h.transports).toHaveLength(1);
  });

  it("never connects in the stream view", async () => {
    const h = harness();
    window.history.replaceState(null, "", "/?view=obs");
    await connectSmAutotrack();
    await h.advance(1000);
    expect(h.transports).toHaveLength(0);
    expect(state().active).toBe(false);
  });
});

describe("Super Metroid's autotracking across the tracker's tabs", () => {
  let locks: FakeLocks;
  let uninstall: () => void;

  beforeEach(() => {
    locks = new FakeLocks();
    uninstall = locks.install();
  });

  afterEach(() => uninstall());

  it("waits while another tab autotracks, whatever its game, then takes over", async () => {
    const h = harness();
    let releaseOther = () => {};
    void locks.request("alltp-tracker-autotrack", {}, () => {
      return new Promise<void>((release) => {
        releaseOther = release;
      });
    });

    const connecting = connectSmAutotrack();
    await h.advance(0);
    expect(state()).toMatchObject({ active: true, elsewhere: true });
    expect(h.transports).toHaveLength(0);

    releaseOther();
    await connecting;
    await h.advance(0);
    expect(state()).toMatchObject({ active: true, elsewhere: false });
    expect(h.transports).toHaveLength(1);
    expect(locks.isHeld).toBe(true);

    stopSmAutotrack();
    await settle();
    expect(locks.isHeld).toBe(false);
  });
});

describe("Super Metroid's session code", () => {
  afterEach(() => {
    vi.doUnmock("@/games/sm/autotrack/runtime");
    vi.resetModules();
  });

  it("says so when it cannot be fetched, and connects nothing", async () => {
    vi.resetModules();
    vi.doMock("@/games/sm/autotrack/runtime", () => {
      throw new Error("offline");
    });
    const store = await import("@/games/sm/autotrack/store");

    await store.connectSmAutotrack();
    expect(store.useSmAutotrackStore.getState()).toMatchObject({
      active: false,
      unavailable: true,
    });

    store.disconnectSmAutotrack();
    expect(store.useSmAutotrackStore.getState().unavailable).toBe(false);
  });
});
