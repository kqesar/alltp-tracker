// What the Archipelago board tells the overlay API (docs/overlay-api.md): the
// items the slot received, by AP's names, with how many. Nothing else: no
// room, slot, player, location or hint, and never where the room is. A
// whitelist, as every game's (games/alttpr/overlay.ts).

import { type ApRun, useArchipelagoStore } from "@/games/archipelago/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

/**
 * The run as the API tells it. An item's id is its AP name, which the world's
 * name data keeps stable; its level is how many the slot holds, and its max
 * the same (AP states no pool).
 */
export const overlayReadingOf = (
  run: Pick<ApRun, "items">,
): OverlayReading => ({
  fresh: run.items.length === 0,
  state: {
    game: "archipelago",
    goMode: null,
    items: run.items.map(({ count, name }) => ({
      id: name,
      level: count,
      max: count,
      name,
    })),
    objectives: [],
    timer: null,
  },
});

export const overlaySource: OverlaySource = {
  read: () => overlayReadingOf(useArchipelagoStore.getState()),
  subscribe: (listener) => useArchipelagoStore.subscribe(listener),
};
