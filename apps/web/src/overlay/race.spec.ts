import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RaceSource } from "@/autotrack/raceMode";
import { overlaySource as alttprSource } from "@/games/alttpr/overlay";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { overlaySource as smSource } from "@/games/sm/overlay";
import { useSmStore } from "@/games/sm/store";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { overlaySource as smz3Source } from "@/games/smz3/overlay";
import { useSmz3Store } from "@/games/smz3/store";
import type {
  OverlayPublication,
  OverlayReading,
  OverlaySource,
} from "@/overlay/protocol";
import { OVERLAY_DELAY_MS, publishOverlay } from "@/overlay/publish";
import { raceSafe, withoutTimes } from "@/overlay/race";

const T0 = 1_000_000;

/** A run with a timer running since T0 and a boss beaten 60 s in. */
const readingOf = (hookshot: number): OverlayReading => ({
  fresh: false,
  state: {
    game: "alttpr",
    goMode: "no",
    items: [{ id: "hookshot", level: hookshot, max: 1, name: "Hookshot" }],
    objectives: [{ done: true, id: "boss0", ms: 60_000, name: "Eastern" }],
    timer: { elapsedMs: 0, startedAt: T0, state: "running" },
  },
});

/** A run and a Race Mode the test changes, firing listeners as stores do. */
const fakes = () => {
  const listeners = new Set<() => void>();
  let reading = readingOf(0);
  let race = false;
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const fire = () => {
    for (const listener of listeners) listener();
  };
  const source: OverlaySource = { read: () => reading, subscribe };
  const raceSource: RaceSource = { isOn: () => race, subscribe };
  return {
    find: () => {
      reading = readingOf(1);
      fire();
    },
    listeners,
    raceSource,
    setRace: (on: boolean) => {
      race = on;
      fire();
    },
    source,
  };
};

describe("the overlay API in Race Mode", () => {
  let sent: OverlayPublication[];
  const send = (publication: OverlayPublication) => sent.push(publication);
  const last = () => {
    const publication = sent.at(-1);
    if (publication === undefined) throw new Error("nothing sent");
    return {
      events: JSON.parse(publication.events),
      state: JSON.parse(publication.state),
    };
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: T0 });
    sent = [];
  });
  afterEach(() => vi.useRealTimers());

  it("tells no time: no timer, no goal dated", () => {
    const { state } = withoutTimes(readingOf(1));
    expect(state.timer).toBeNull();
    expect(state.objectives).toEqual([
      { done: true, id: "boss0", ms: null, name: "Eastern" },
    ]);
    // The items, the goals done and the go mode go on
    expect(state.items[0]?.level).toBe(1);
    expect(state.goMode).toBe("no");
  });

  it("dates no find while the run timer runs, and sends again as Race Mode comes and goes", () => {
    const fake = fakes();
    const stop = publishOverlay({
      now: () => T0 + 90_000,
      send,
      source: raceSafe(fake.source, fake.raceSource),
    });
    expect(last().state.timer).toMatchObject({ state: "running" });

    fake.setRace(true);
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);
    expect(last().state.timer).toBeNull();
    expect(last().state.objectives[0].ms).toBeNull();
    // Race Mode coming is no event of the run
    expect(last().events).toEqual([]);

    fake.find();
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);
    expect(last().events).toEqual([
      {
        id: "hookshot",
        level: 1,
        ms: null,
        name: "Hookshot",
        previous: 0,
        type: "item",
      },
    ]);

    fake.setRace(false);
    vi.advanceTimersByTime(OVERLAY_DELAY_MS);
    expect(last().state.timer).toMatchObject({ state: "running" });
    stop();
    expect(fake.listeners.size).toBe(0);
  });
});

describe("each game's overlay source", () => {
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState(useGameStore.getInitialState(), true);
    useAutotrackStore.setState({ raceChoice: "auto", reading: null });
    useSmStore.setState(useSmStore.getInitialState(), true);
    useSmAutotrackStore.setState(useSmAutotrackStore.getInitialState(), true);
    useSmz3Store.setState(useSmz3Store.getInitialState(), true);
    smz3Autotrack.useStore.setState(
      smz3Autotrack.useStore.getInitialState(),
      true,
    );
  });

  it("tells A Link to the Past's timer outside Race Mode only", () => {
    useGameStore.getState().startTimer(T0);
    expect(alttprSource.read().state.timer).not.toBeNull();
    useAutotrackStore.setState({ raceChoice: "on" });
    expect(alttprSource.read().state.timer).toBeNull();
  });

  it("tells Super Metroid's timer only once Race Mode, on by default, is off", () => {
    useSmStore.getState().startTimer(T0);
    expect(smSource.read().state.timer).toBeNull();
    useSmAutotrackStore.setState({ raceChoice: "auto" });
    expect(smSource.read().state.timer).not.toBeNull();
  });

  it("tells SMZ3's timer outside Race Mode only", () => {
    useSmz3Store.getState().startTimer(T0);
    expect(smz3Source.read().state.timer).not.toBeNull();
    smz3Autotrack.useStore.setState({ raceChoice: "on" });
    expect(smz3Source.read().state.timer).toBeNull();
  });
});
