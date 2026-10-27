// What Super Metroid's run tells the overlay API (docs/overlay-api.md): the
// items held, the seed's objectives, done or not, and the run timer (which
// shows the real or the game's time, whichever the player chose: the API
// gains no field). Nothing else of the run, and no go mode (the tracker has
// none for this game). A whitelist, as ALttPR's (games/alttpr/overlay.ts).

import { OBJECTIVES, SM_ITEMS } from "@alltp/pack-sm";
import { raceSourceOf } from "@/autotrack/raceMode";
import { useSmAutotrackStore } from "@/games/sm/autotrack/store";
import { type SmProgress, useSmStore } from "@/games/sm/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";
import { raceSafe } from "@/overlay/race";
import { overlayTimerOf } from "@/overlay/timer";
import type { RunTimer } from "@/utils/runTimer";

const OBJECTIVE_NAMES = new Map(OBJECTIVES.map((o) => [o.id, o.name]));

/** What the reading reads of the store: the run and its timer. */
export type SmRun = SmProgress & { readonly timer: RunTimer };

/** The run as the API tells it. Items go by the pack's ids, in its order. */
export const overlayReadingOf = (run: SmRun): OverlayReading => {
  const items = SM_ITEMS.map(({ id, max, name }) => ({
    id,
    level: run.items[id as keyof typeof run.items] ?? 0,
    max,
    name,
  }));
  const objectives = run.objectives.map((id) => ({
    done: run.done.includes(id),
    id,
    ms: null,
    name: OBJECTIVE_NAMES.get(id) ?? id,
  }));
  const timer = overlayTimerOf(run.timer);
  return {
    fresh:
      timer.state === "idle" &&
      items.every(({ level }) => level === 0) &&
      objectives.every(({ done }) => !done),
    state: { game: "sm", goMode: null, items, objectives, timer },
  };
};

/** The run as the API tells it: with no time in Race Mode (overlay/race.ts). */
export const overlaySource: OverlaySource = raceSafe(
  {
    read: () => overlayReadingOf(useSmStore.getState()),
    subscribe: (listener) => useSmStore.subscribe(listener),
  },
  raceSourceOf(useSmAutotrackStore),
);
