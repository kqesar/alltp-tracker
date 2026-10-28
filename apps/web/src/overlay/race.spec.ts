import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type RaceSource, raceSourceOf } from "@/autotrack/raceMode";
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

/** Listeners kept apart, as two stores keep theirs. */
const listenerSet = () => {
  const listeners = new Set<() => void>();
  return {
    fire: () => {
      for (const listener of listeners) listener();
    },
    listeners,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/**
 * A run and a Race Mode the test changes, each firing its own listeners: a
 * Race Mode change reaches the publisher only through the race source.
 */
const fakes = () => {
  const run = listenerSet();
  const raceListeners = listenerSet();
  let reading = readingOf(0);
  let race = false;
  const source: OverlaySource = {
    read: () => reading,
    subscribe: run.subscribe,
  };
  const raceSource: RaceSource = {
    isOn: () => race,
    subscribe: raceListeners.subscribe,
  };
  return {
    find: () => {
      reading = readingOf(1);
      run.fire();
    },
    raceListeners: raceListeners.listeners,
    raceSource,
    runListeners: run.listeners,
    setRace: (on: boolean) => {
      race = on;
      raceListeners.fire();
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
    // It listens to the run and to Race Mode, each once
    expect(fake.runListeners.size).toBe(1);
    expect(fake.raceListeners.size).toBe(1);

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
    expect(fake.runListeners.size).toBe(0);
    expect(fake.raceListeners.size).toBe(0);
  });
});

describe("raceSourceOf", () => {
  beforeEach(() => {
    useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
  });

  it("answers as the store's Race Mode, failing closed, and calls only when that changes", () => {
    const race = raceSourceOf(useAutotrackStore);
    const listener = vi.fn();
    const stop = race.subscribe(listener);
    expect(race.isOn()).toBe(false);

    // A change that leaves the answer as it was calls nothing
    useAutotrackStore.setState({ elsewhere: false, seedFile: null });
    expect(listener).not.toHaveBeenCalled();

    useAutotrackStore.setState({ raceChoice: "on" });
    expect(race.isOn()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    // On already: Auto with autotracking set to connect stays on, unread
    useAutotrackStore.setState({ connectOnStart: true, raceChoice: "auto" });
    expect(race.isOn()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    useAutotrackStore.setState({ connectOnStart: false });
    expect(race.isOn()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);

    stop();
    useAutotrackStore.setState({ raceChoice: "on" });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("stays on through a Disconnect after a race was read, and calls when the race is ended", () => {
    const race = raceSourceOf(useAutotrackStore);
    const listener = vi.fn();
    race.subscribe(listener);

    // Read as a race's, then the player disconnects: reading, session and the
    // wish to connect are gone, the memory is not
    useAutotrackStore.setState({ raceSeen: true });
    expect(race.isOn()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    useAutotrackStore.setState({
      active: false,
      connectOnStart: false,
      reading: null,
    });
    expect(race.isOn()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    useAutotrackStore.getState().endRace();
    expect(race.isOn()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
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
    useSmAutotrackStore.setState({ raceChoice: "off" });
    expect(smSource.read().state.timer).not.toBeNull();
  });

  it("tells SMZ3's timer outside Race Mode only", () => {
    useSmz3Store.getState().startTimer(T0);
    expect(smz3Source.read().state.timer).not.toBeNull();
    smz3Autotrack.useStore.setState({ raceChoice: "on" });
    expect(smz3Source.read().state.timer).toBeNull();
  });
});
