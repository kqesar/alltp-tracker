// The overlay API in Race Mode (docs/overlay-api.md, "Race Mode"): the same
// whitelist, with no time in it. The race rules (ALTTPR Auto-tracker Rules
// v2.0) let a tracker log when the game starts and ends and when each item
// was found, but "Anything allowed under this section is not allowed to
// integrate with any other part of other trackers unless explicitly stated":
// a stream tool is other software, so in Race Mode it gets no time at all.
// The items, the goals done and the go mode go on.

import type { RaceSource } from "@/autotrack/raceMode";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

/**
 * A reading with no time: no timer (as a game without one has), and no goal
 * dated. Events built from it carry none either (`diffOverlay` dates them by
 * the state's timer): an item's `ms` is null, and no timer event is sent.
 */
export const withoutTimes = (reading: OverlayReading): OverlayReading => ({
  ...reading,
  state: {
    ...reading.state,
    objectives: reading.state.objectives.map((objective) => ({
      ...objective,
      ms: null,
    })),
    timer: null,
  },
});

/**
 * A game's overlay source that tells no time while its Race Mode is on, and
 * publishes again when Race Mode comes or goes.
 * @param source - The game's whitelist
 * @param race - The game's Race Mode
 */
export const raceSafe = (
  source: OverlaySource,
  race: RaceSource,
): OverlaySource => ({
  read: () => {
    const reading = source.read();
    return race.isOn() ? withoutTimes(reading) : reading;
  },
  subscribe: (listener) => {
    const stopRun = source.subscribe(listener);
    const stopRace = race.subscribe(listener);
    return () => {
      stopRun();
      stopRace();
    };
  },
});
