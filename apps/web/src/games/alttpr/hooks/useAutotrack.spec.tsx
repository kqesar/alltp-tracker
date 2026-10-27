import {
  parseUserAgent,
  RaceViolationError,
  type SessionStatus,
  TransportError,
} from "@alltp/autotrack";
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FakeLocks,
  FakeVisibility,
  GRANTED,
  ManualClock,
  settle,
} from "@/autotrack/fixtures";
import { SAVE, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { useAutotrack } from "@/games/alttpr/hooks/useAutotrack";
import { ObsView } from "@/games/alttpr/ObsView";
import {
  connectAutotrack,
  disconnectAutotrack,
  retryAutotrack,
  setAutotrackOptions,
  stopAutotrack,
  useAutotrackStore,
} from "@/games/alttpr/stores/autotrackStore";
import {
  MemoryTransport,
  type Script,
} from "../../../../../../packages/autotrack/test/memory-transport";

const FIREFOX_LINUX = parseUserAgent(
  "Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0",
);

/** The tracker, as far as autotracking goes. */
const Tracker = () => {
  useAutotrack();
  return null;
};

const state = () => useAutotrackStore.getState();

/** What localStorage keeps of autotracking. */
const saved = () =>
  JSON.parse(localStorage.getItem("alltp-tracker-autotrack") ?? "null")?.state;

/**
 * A console behind a scriptable in-memory bridge, a hand-moved clock and the
 * page's visibility: the session's every seam but the pack.
 */
const harness = ({ race = false } = {}) => {
  const memory = seedMemory({ race });
  const clock = new ManualClock();
  const visibility = new FakeVisibility();
  const transports: MemoryTransport[] = [];
  const script: Script = {};
  setAutotrackOptions({
    clock,
    permission: GRANTED,
    random: () => 0,
    transport: () => {
      const transport = new MemoryTransport(memory, script);
      transports.push(transport);
      return transport;
    },
    visibility,
  });
  /** Moves the session's time on, in act: it re-renders what it changes. */
  const advance = (ms: number) => act(() => clock.advance(ms));
  const open = () => transports.filter((transport) => !transport.closed);
  return { advance, memory, open, script, transports, visibility };
};

/** Every status the UI showed from now on. */
const recordShown = () => {
  const shown: SessionStatus[] = [];
  const unsubscribe = useAutotrackStore.subscribe((now, before) => {
    if (now.shown !== before.shown) shown.push(now.shown);
  });
  return { shown, unsubscribe };
};

const unreachable = () =>
  Promise.reject(new TransportError("unreachable", "open", "No bridge"));

beforeEach(() => {
  localStorage.clear();
  act(() => {
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
    useAutotrackStore.setState({ environment: FIREFOX_LINUX });
  });
});

afterEach(() => {
  act(() => stopAutotrack());
  setAutotrackOptions({});
  window.history.replaceState(null, "", "/");
});

describe("useAutotrack", () => {
  it("opens nothing until the player connects, then connects on every visit", async () => {
    const h = harness();
    const first = render(<Tracker />);
    await h.advance(0);
    expect(h.transports).toHaveLength(0);
    expect(state().active).toBe(false);

    await act(() => connectAutotrack());
    await h.advance(0);

    expect(h.transports).toHaveLength(1);
    expect(state().status.code).toBe("connected");
    expect(saved()).toEqual({
      connectOnStart: true,
      darkRoomMap: true,
      darkRoomStyle: "art",
      keptSeed: null,
      raceChoice: "auto",
    });

    // The tracker closes: the session stops, the wish stays
    first.unmount();
    expect(h.open()).toHaveLength(0);
    expect(state()).toMatchObject({ active: false, connectOnStart: true });
    expect(state().status.code).toBe("stopped");

    render(<Tracker />);
    await h.advance(0);
    expect(h.transports).toHaveLength(2);
    expect(state().status.code).toBe("connected");
  });

  it("never runs more than one session", async () => {
    const h = harness();
    act(() => useAutotrackStore.setState({ connectOnStart: true }));

    // StrictMode mounts, unmounts and mounts again: connect, stop, connect
    render(
      <StrictMode>
        <Tracker />
      </StrictMode>,
    );
    await h.advance(0);
    await act(() => Promise.all([connectAutotrack(), connectAutotrack()]));
    await h.advance(1000);

    expect(h.transports).toHaveLength(1);
    expect(h.open()).toHaveLength(1);
    expect(state().status.code).toBe("connected");
  });

  it("reconnects on its own when the bridge drops, the failure held still", async () => {
    const h = harness();
    render(<Tracker />);
    await act(() => connectAutotrack());
    await h.advance(5000);
    const { shown, unsubscribe } = recordShown();

    // SNI stops: the connection drops, and nothing answers for a while
    h.script.open = unreachable;
    h.transports[0].close();
    await h.advance(500);
    expect(state().shown).toMatchObject({
      code: "bridge-unreachable",
      retryInMs: 1000,
    });
    await h.advance(1000 + 2000);
    expect(state().status).toMatchObject({
      attempt: 3,
      code: "bridge-unreachable",
    });

    // SNI is back: the next retry finds it
    h.script.open = undefined;
    await h.advance(4000);
    unsubscribe();

    expect(state().status.code).toBe("connected");
    expect(h.open()).toHaveLength(1);
    // The drop reconnected at once ("connecting"); the retries never showed
    // as "connecting" again, the failure stayed on screen, its wait updated
    expect(shown.map((status) => status.code)).toEqual([
      "connecting",
      "bridge-unreachable",
      "bridge-unreachable",
      "bridge-unreachable",
      "attaching",
      "connected",
    ]);
  });

  it("retries at once when asked", async () => {
    const h = harness();
    h.script.open = unreachable;
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(state().status.code).toBe("bridge-unreachable");

    h.script.open = undefined;
    act(() => retryAutotrack());
    await h.advance(0);

    expect(state().status.code).toBe("connected");
  });

  it("decodes what it reads, and again when Race Mode turns on", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(state().reading).toMatchObject({
      items: { counts: { bottle: 1, hookshot: 1, sword: 2 } },
      race: false,
    });

    h.memory[SAVE(0x357)] = 0x01; // Moon Pearl
    await h.advance(1000);
    expect(state().reading?.items.counts.moonPearl).toBe(1);

    // A race seed takes its place: what Race Mode withholds is dropped at once
    h.memory.set([0x01, 0x00], 0x18_0213);
    await h.advance(1000);
    expect(state().status).toMatchObject({ race: { active: true } });
    expect(state().reading).toMatchObject({
      items: { unsettled: { bottle: "race-mode" } },
      race: true,
    });
  });

  it("pauses while the page is hidden", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);

    act(() => h.visibility.set(true));
    await h.advance(1000);
    expect(state().status).toMatchObject({ code: "connected", paused: true });

    act(() => h.visibility.set(false));
    await h.advance(0);
    expect(state().status).toMatchObject({ code: "connected", paused: false });
  });

  it("stops at the player's word, and stays off on the next visit", async () => {
    const h = harness();
    render(<Tracker />);
    await act(() => connectAutotrack());
    await h.advance(0);

    act(() => disconnectAutotrack());

    expect(h.open()).toHaveLength(0);
    expect(state()).toMatchObject({
      active: false,
      connectOnStart: false,
      reading: null,
    });
    expect(saved()).toEqual({
      connectOnStart: false,
      darkRoomMap: true,
      darkRoomStyle: "art",
      keptSeed: null,
      raceChoice: "auto",
    });
    render(<Tracker />);
    await h.advance(0);
    expect(h.transports).toHaveLength(1);
  });

  it("turns off when the session stops itself", async () => {
    const h = harness();
    // A read Race Mode would refuse: a bug, on which the session stops
    h.script.read = () => new RaceViolationError("refused") as never;
    await act(() => connectAutotrack());
    await h.advance(0);

    expect(state().active).toBe(false);
    expect(state().status.code).toBe("stopped");
  });

  it("reaches the bridge at the port the page names", async () => {
    harness();
    window.history.replaceState(null, "", "/?bridge=23075");
    const { shown, unsubscribe } = recordShown();

    await act(() => connectAutotrack());
    unsubscribe();

    expect(shown[0]).toMatchObject({
      code: "connecting",
      url: "ws://localhost:23075",
    });
  });

  it("detects the system when nothing has yet", async () => {
    const h = harness();
    act(() => useAutotrackStore.setState({ environment: null }));

    await act(() => connectAutotrack());
    await h.advance(0);

    expect(state().environment?.os).toBeDefined();
    expect(state().status.code).toBe("connected");
  });
});

describe("the stream view", () => {
  it("never connects, even when the tracker would on start", async () => {
    const h = harness();
    window.history.replaceState(null, "", "/?view=obs");
    act(() => useAutotrackStore.setState({ connectOnStart: true }));

    render(<ObsView background={null} />);
    await act(() => connectAutotrack());
    await h.advance(1000);

    expect(h.transports).toHaveLength(0);
    expect(state().active).toBe(false);
  });
});

describe("the session's code", () => {
  afterEach(() => {
    vi.doUnmock("@/games/alttpr/autotrack/runtime");
    vi.resetModules();
  });

  it("is fetched only once the player connects, and once only", async () => {
    let fetches = 0;
    vi.resetModules();
    vi.doMock("@/games/alttpr/autotrack/runtime", async (importOriginal) => {
      fetches++;
      return importOriginal();
    });
    const store = await import("@/games/alttpr/stores/autotrackStore");
    const hook = await import("@/games/alttpr/hooks/useAutotrack");
    const h = harness();
    store.setAutotrackOptions({
      clock: new ManualClock(),
      permission: GRANTED,
      transport: () => new MemoryTransport(seedMemory({ race: false })),
      visibility: new FakeVisibility(),
    });
    const Fresh = () => {
      hook.useAutotrack();
      return null;
    };
    render(<Fresh />);
    await settle();
    expect(fetches).toBe(0);

    await act(() => store.connectAutotrack());
    act(() => store.disconnectAutotrack());
    await act(() => store.connectAutotrack());
    act(() => store.stopAutotrack());

    expect(fetches).toBe(1);
    expect(h.transports).toHaveLength(0);
  });

  it("says so when it cannot be fetched, and connects nothing", async () => {
    vi.resetModules();
    vi.doMock("@/games/alttpr/autotrack/runtime", () => {
      throw new Error("offline");
    });
    const store = await import("@/games/alttpr/stores/autotrackStore");

    await act(() => store.connectAutotrack());

    expect(store.useAutotrackStore.getState()).toMatchObject({
      active: false,
      unavailable: true,
    });
    act(() => store.disconnectAutotrack());
    expect(store.useAutotrackStore.getState().unavailable).toBe(false);
    // Fetched ahead of a click, a failure is silent
    expect(store.preloadAutotrack()).toBeUndefined();
    await act(() => settle());
  });

  it("says nothing of a failed fetch the player has already called off", async () => {
    vi.resetModules();
    vi.doMock("@/games/alttpr/autotrack/runtime", () => {
      throw new Error("offline");
    });
    const store = await import("@/games/alttpr/stores/autotrackStore");

    const connecting = store.connectAutotrack();
    act(() => store.disconnectAutotrack());
    await act(() => connecting);

    expect(store.useAutotrackStore.getState()).toMatchObject({
      active: false,
      unavailable: false,
    });
  });
});
describe("autotracking across the tracker's tabs", () => {
  let locks: FakeLocks;
  let uninstall: () => void;
  /** Another tab of the tracker, autotracking: it holds the lock. */
  let releaseOther: () => void;

  beforeEach(() => {
    locks = new FakeLocks();
    uninstall = locks.install();
  });

  afterEach(() => uninstall());

  const otherTabAutotracks = () => {
    void locks.request("alltp-tracker-autotrack", {}, () => {
      return new Promise<void>((release) => {
        releaseOther = release;
      });
    });
  };

  it("waits while another tab autotracks, then takes over", async () => {
    const h = harness();
    otherTabAutotracks();

    // It waits for the other tab, as long as that one autotracks
    const connecting = connectAutotrack();
    await h.advance(1000);

    expect(state()).toMatchObject({ active: true, elsewhere: true });
    expect(h.transports).toHaveLength(0);

    // The other tab closes
    releaseOther();
    await act(() => connecting);
    await h.advance(0);

    expect(state()).toMatchObject({ active: true, elsewhere: false });
    expect(state().status.code).toBe("connected");
    expect(h.transports).toHaveLength(1);
    expect(locks.isHeld).toBe(true);
  });

  it("stops waiting at the player's word", async () => {
    const h = harness();
    otherTabAutotracks();
    const connecting = connectAutotrack();
    await h.advance(0);
    expect(state().elsewhere).toBe(true);

    act(() => stopAutotrack());
    await act(() => connecting);
    releaseOther();
    await h.advance(1000);

    expect(state()).toMatchObject({ active: false, elsewhere: false });
    expect(h.transports).toHaveLength(0);
    expect(locks.isHeld).toBe(false);
  });

  it("holds the lock while it autotracks, and lets it go as it stops", async () => {
    const h = harness();
    await act(() => connectAutotrack());
    await h.advance(0);
    expect(locks.isHeld).toBe(true);
    expect(state().elsewhere).toBe(false);

    act(() => stopAutotrack());
    await act(() => settle());

    expect(locks.isHeld).toBe(false);
  });

  it("gives the lock back when stopped as it is granted", async () => {
    const h = harness();
    const connecting = connectAutotrack();
    act(() => stopAutotrack());
    await act(() => connecting);
    await h.advance(0);

    expect(h.transports).toHaveLength(0);
    expect(locks.isHeld).toBe(false);
  });
});
