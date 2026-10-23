// What SMZ3's run tells the overlay API (docs/overlay-api.md): the items of
// both games the board's grid shows, and nothing else. Never the rewards
// (pendants, crystals, Super Metroid's boss tokens: a reward is what a boss
// holds, found when it is picked up, not a boss beaten), the keycards, the
// keys, what is checked or the settings. No objectives: the tracker does not
// record the bosses beaten in this game, and a reward would only pass for
// one. No timer or go mode either (the tracker has none for this game). A
// whitelist, as ALttPR's (games/alttpr/overlay.ts). The Zelda items go by
// ALttPR's overlay ids where the two share them.

import { ITEMS } from "@alltp/pack-smz3";
import { SM_CELLS, ZELDA_CELLS } from "@/games/smz3/data";
import { type Smz3Progress, useSmz3Store } from "@/games/smz3/store";
import type { OverlayReading, OverlaySource } from "@/overlay/protocol";

const MAX = new Map(ITEMS.map(({ id, max }) => [id, max]));

/** The run as the API tells it: Hyrule's items, then Zebes's. */
export const overlayReadingOf = (run: Smz3Progress): OverlayReading => {
  const items = [...ZELDA_CELLS, ...SM_CELLS].map(({ id, name }) => ({
    id,
    level: run.items[id] ?? 0,
    max: MAX.get(id) ?? 1,
    name,
  }));
  return {
    fresh: items.every(({ level }) => level === 0),
    state: {
      game: "smz3",
      goMode: null,
      items,
      objectives: [],
      timer: null,
    },
  };
};

export const overlaySource: OverlaySource = {
  read: () => overlayReadingOf(useSmz3Store.getState()),
  subscribe: (listener) => useSmz3Store.subscribe(listener),
};
