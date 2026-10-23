// What Super Metroid's run tells the overlay API (docs/overlay-api.md): the
// items held and the seed's objectives, done or not. Nothing else of the run,
// and no timer or go mode (the tracker has none for this game). A whitelist,
// as ALttPR's (games/alttpr/overlay.ts).

import { OBJECTIVES, SM_ITEMS } from "@alltp/pack-sm";
import { type SmProgress, useSmStore } from "@/games/sm/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

const OBJECTIVE_NAMES = new Map(OBJECTIVES.map((o) => [o.id, o.name]));

/** The run as the API tells it. Items go by the pack's ids, in its order. */
export const overlayReadingOf = (run: SmProgress): OverlayReading => {
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
  return {
    fresh:
      items.every(({ level }) => level === 0) &&
      objectives.every(({ done }) => !done),
    state: { game: "sm", goMode: null, items, objectives, timer: null },
  };
};

export const overlaySource: OverlaySource = {
  read: () => overlayReadingOf(useSmStore.getState()),
  subscribe: (listener) => useSmStore.subscribe(listener),
};
