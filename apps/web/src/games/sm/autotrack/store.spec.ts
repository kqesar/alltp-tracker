import { parseUserAgent } from "@alltp/autotrack";
import { rtaMs } from "@alltp/pack-sm";
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
  smAutotrack,
  stopSmAutotrack,
  useSmAutotrackStore,
} from "@/games/sm/autotrack/store";
import { useSmStore } from "@/games/sm/store";
import { MemoryTransport } from "../../../../../../packages/autotrack/test/memory-transport";
import { MEMORY_RANGE } from "../../../../../../packs/sm/src/autotrack/memory";
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
  // Outside Race Mode, which is on by default (its own describe): most of
  // these specs read what only a casual session reads
  useSmAutotrackStore.setState({
    environment: parseUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
    ),
    raceChoice: "auto",
  });
});

afterEach(() => {
  stopSmAutotrack();
  setSmAutotrackOptions({});
});

describe("Super Metroid's Race Mode by default", () => {
  /** The choice the store reads from what localStorage holds now. */
  const fresh = async () => {
    await useSmAutotrackStore.persist.rehydrate();
    return state().raceChoice;
  };
  const save = (state: object, version?: number) =>
    localStorage.setItem(
      "alltp-tracker-sm-autotrack",
      JSON.stringify(version === undefined ? { state } : { state, version }),
    );

  it("is on for a device that never set it: Map Rando has no race flag", () => {
    expect(useSmAutotrackStore.getInitialState().raceChoice).toBe("on");
  });

  it('reads a save from before as the default, keeping an "on" set', async () => {
    // Every save then held "auto", the default it was: never a choice
    save({ connectOnStart: true, raceChoice: "auto" }, 0);
    expect(await fresh()).toBe("on");
    save({ connectOnStart: true, raceChoice: "on" }, 0);
    expect(await fresh()).toBe("on");
  });

  it("keeps Off, once chosen in this version", async () => {
    save({ connectOnStart: true, raceChoice: "auto" }, 1);
    expect(await fresh()).toBe("auto");
    // A value no version writes reads as the default
    save({ connectOnStart: true, raceChoice: "off" }, 1);
    expect(await fresh()).toBe("on");
  });
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

describe("Super Metroid's autotracking and the run timer", () => {
  const FILE_SELECT = 0x04;
  const CREDITS = 0x27;
  /** The RTA clock's two parts, in FX Pak Pro space: SRAM, then WRAM. */
  const CLOCK = [
    { address: MEMORY_RANGE["rta-saved"].address, size: 4 },
    { address: MEMORY_RANGE["rta-pending"].address, size: 1 },
  ];
  const readClock = (transports: MemoryTransport[]) =>
    transports
      .flatMap((transport) => transport.pieces)
      .filter(([address, size]) =>
        CLOCK.some(
          (part) =>
            part.address < address + size && address < part.address + part.size,
        ),
      );

  it("starts at the first reading in play, follows the game's time and stops at the ship", async () => {
    run().setTimerClock("game");
    const h = harness({
      clock: { pending: 0, saved: 50_000 },
      state: FILE_SELECT,
    });
    await connectSmAutotrack();
    await h.advance(0);
    expect(run().timer.startedAt).toBeNull();
    expect(state().reading?.clock).toMatchObject({ frames: 50_000 });

    // The file loads: a game in play, 3 000 frames later by its clock
    h.play({ clock: { pending: 0, saved: 53_000 }, state: 0x08 });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    expect(run().clockBase).toBe(53_000);

    // 12 000 frames more (about 200 s) in a real second: set on the game's
    h.play({ clock: { pending: 0, saved: 65_000 } });
    await h.advance(1000);
    expect(run().timer.elapsedMs).toBe(rtaMs(12_000));

    // The ship: the escape was set, the credits run
    h.play({
      clock: { pending: 0, saved: 66_000 },
      escaping: true,
      state: CREDITS,
    });
    await h.advance(1000);
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(13_000),
      finished: true,
      startedAt: null,
    });
  });

  it("stops the timer on the game's time while the emulator is paused, and goes on when it runs", async () => {
    run().setTimerClock("game");
    const h = harness({
      clock: { pending: 0, saved: 50_000 },
      state: FILE_SELECT,
    });
    await connectSmAutotrack();
    await h.advance(0);
    h.play({ clock: { pending: 0, saved: 53_000 }, state: 0x08 });
    await h.advance(1000);
    h.play({ clock: { pending: 0, saved: 65_000 } });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();

    // A paused emulator serves the same bytes: no reading, only steady polls
    await h.advance(3000);
    expect(run().timer).toEqual({
      elapsedMs: rtaMs(12_000),
      finished: false,
      startedAt: null,
    });

    h.play({ clock: { pending: 0, saved: 66_000 } });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    expect(run().timer.elapsedMs).toBe(rtaMs(13_000));
  });

  it("lays only boss kills among the objectives in Race Mode, and all once it is off", async () => {
    const objectives = ["kraid", "metroidRoom1"];
    const h = harness({ done: objectives, objectives, state: 0x08 });
    smAutotrack.setRaceChoice("on");
    await connectSmAutotrack();
    await h.advance(0);
    await h.advance(1000);
    expect(state().reading?.race).toBe(true);
    expect(run().objectives).toEqual(objectives);
    expect(run().done).toEqual(["kraid"]);

    // Back to Auto, Map Rando having no race flag: the reading is decoded
    // again at once, the session running
    smAutotrack.setRaceChoice("auto");
    for (let tick = 0; tick < 12; tick++) await h.advance(1000);
    expect(state().reading?.race).toBe(false);
    expect(run().done).toEqual(objectives);
  });

  it("reads the clock outside Race Mode", async () => {
    const h = harness();
    await connectSmAutotrack();
    await h.advance(2000);
    expect(readClock(h.transports).length).toBeGreaterThan(0);
  });

  it("reads none of the clock in Race Mode, yet starts and stops the timer", async () => {
    useSmAutotrackStore.setState({ raceChoice: "on" });
    run().setTimerClock("game");
    const h = harness({
      clock: { pending: 0, saved: 50_000 },
      state: FILE_SELECT,
    });
    await connectSmAutotrack();
    await h.advance(0);
    h.play({ state: 0x08 });
    await h.advance(1000);
    expect(run().timer.startedAt).not.toBeNull();
    h.play({ escaping: true, state: CREDITS });
    await h.advance(1000);

    expect(run().timer.finished).toBe(true);
    // Nothing of the RTA clock was asked of the console, and none is known
    expect(readClock(h.transports)).toEqual([]);
    expect(state().reading?.clock).toBe("not-read");
    expect(run().clockBase).toBeNull();
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
