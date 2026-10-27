// What SMZ3's run tells the overlay API (docs/overlay-api.md): the items of
// both games the board's grid shows, and nothing else. Never the rewards
// (pendants, crystals, Super Metroid's boss tokens: a reward is what a boss
// holds, found when it is picked up, not a boss beaten), the keycards, the
// keys, what is checked or the settings. No objectives: the tracker does not
// record the bosses beaten in this game, and a reward would only pass for
// one. The run timer is data, showing the real or the game's time whichever
// the player chose (the API gains no field); no go mode (the tracker has none
// for this game). A whitelist, as ALttPR's (games/alttpr/overlay.ts). The
// Zelda items go by ALttPR's overlay ids where the two share them.

import { ITEMS } from "@alltp/pack-smz3";
import { raceSourceOf } from "@/autotrack/raceMode";
import { smz3Autotrack } from "@/games/smz3/autotrack/store";
import { SM_CELLS, ZELDA_CELLS } from "@/games/smz3/data";
import { type Smz3Progress, useSmz3Store } from "@/games/smz3/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";
import { raceSafe } from "@/overlay/race";
import { overlayTimerOf } from "@/overlay/timer";
import type { RunTimer } from "@/utils/runTimer";

const MAX = new Map(ITEMS.map(({ id, max }) => [id, max]));

/** What the reading reads of the store: the run and its timer. */
export type Smz3Run = Smz3Progress & { readonly timer: RunTimer };

/** The run as the API tells it: Hyrule's items, then Zebes's. */
export const overlayReadingOf = (run: Smz3Run): OverlayReading => {
  const items = [...ZELDA_CELLS, ...SM_CELLS].map(({ id, name }) => ({
    id,
    level: run.items[id] ?? 0,
    max: MAX.get(id) ?? 1,
    name,
  }));
  const timer = overlayTimerOf(run.timer);
  return {
    fresh: timer.state === "idle" && items.every(({ level }) => level === 0),
    state: {
      game: "smz3",
      goMode: null,
      items,
      objectives: [],
      timer,
    },
  };
};

/** The run as the API tells it: with no time in Race Mode (overlay/race.ts). */
export const overlaySource: OverlaySource = raceSafe(
  {
    read: () => overlayReadingOf(useSmz3Store.getState()),
    subscribe: (listener) => useSmz3Store.subscribe(listener),
  },
  raceSourceOf(smz3Autotrack.useStore),
);
