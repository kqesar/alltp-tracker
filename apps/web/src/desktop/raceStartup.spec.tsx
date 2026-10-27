// The desktop app's stream starts with the app (desktop/streamTools.ts,
// `attachStream`), and with it the run's relay and the overlay API, before
// SNI has answered and before any reading has told the seed's race flag. On
// Auto, with autotracking set to connect as the tracker opens, they fail
// closed until a reading tells an open seed; a run tracked by hand keeps its
// behaviour.

import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLISH_DELAY_MS,
  type Publication,
  publishRun,
} from "@/follow/publish";
import { readingOf, seedMemory } from "@/games/alttpr/autotrack/fixtures";
import { RunPanel } from "@/games/alttpr/components/map/RunPanel";
import { alttpr } from "@/games/alttpr/module";
import { overlaySource } from "@/games/alttpr/overlay";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";

const T0 = Date.UTC(2026, 9, 18, 12, 0, 0);

/** A run with a place checked, its time on the timeline, the timer running. */
const playRun = () => {
  const store = useGameStore.getState();
  store.startTimer(T0);
  store.handleItemClick("hookshot");
  store.toggleChecks(["kings-tomb"]);
};

/** Publish the run as the desktop app's run feed does at start-up. */
const startRelay = () => {
  const sent: Publication[] = [];
  const relay = publishRun({
    game: "alttpr",
    race: alttpr.race,
    send: (publication) => sent.push(publication),
    store: useGameStore,
  });
  return { relay, sent };
};

beforeEach(() => {
  vi.useFakeTimers({ now: T0 });
  localStorage.clear();
  useGameStore.setState(useGameStore.getInitialState(), true);
  useAutotrackStore.setState(useAutotrackStore.getInitialState(), true);
});

describe("the desktop app at start-up, before a race flag is read", () => {
  it("relays the grid alone and tells no time while autotracking is about to read the seed", () => {
    // Auto, and autotracking set to connect as the tracker opens: SNI has
    // not answered yet
    useAutotrackStore.setState({ connectOnStart: true, raceChoice: "auto" });
    playRun();
    const { relay, sent } = startRelay();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.value).not.toContain("kings-tomb");
    expect(overlaySource.read().state.timer).toBeNull();
    render(<RunPanel />);
    expect(screen.queryByTestId("find-check:kings-tomb")).toBeNull();

    // A reading of an open seed: the run goes whole again
    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(seedMemory({ race: false })),
      }),
    );
    vi.advanceTimersByTime(PUBLISH_DELAY_MS);
    expect(sent.at(-1)?.value).toContain("kings-tomb");
    expect(overlaySource.read().state.timer).not.toBeNull();
    expect(screen.getByTestId("find-check:kings-tomb")).toBeInTheDocument();
    relay.stop();
  });

  it("keeps a race seed's cut once its flag is read", () => {
    useAutotrackStore.setState({ connectOnStart: true, raceChoice: "auto" });
    playRun();
    const { relay, sent } = startRelay();
    act(() =>
      useAutotrackStore.setState({
        reading: readingOf(seedMemory({ race: true }), { race: true }),
      }),
    );
    vi.advanceTimersByTime(PUBLISH_DELAY_MS);
    expect(sent.map(({ value }) => value).join()).not.toContain("kings-tomb");
    expect(overlaySource.read().state.timer).toBeNull();
    relay.stop();
  });

  it("leaves a run tracked by hand as it is", () => {
    playRun();
    const { relay, sent } = startRelay();
    expect(sent[0]?.value).toContain("kings-tomb");
    expect(overlaySource.read().state.timer).not.toBeNull();
    render(<RunPanel />);
    expect(screen.getByTestId("find-check:kings-tomb")).toBeInTheDocument();
    relay.stop();
  });
});
