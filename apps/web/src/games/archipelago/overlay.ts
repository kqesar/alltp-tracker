// What the Archipelago board tells the overlay API (docs/overlay-api.md): the
// items the slot received, by AP's names, with how many; for a world with a
// skin, every item its grid counts, held or not. Nothing else: no room,
// slot, player, location or hint, and never where the room is. A whitelist,
// as every game's (games/alttpr/overlay.ts).

import { type ApRun, useArchipelagoStore } from "@/games/archipelago/store";
import { namesOf, type Skin } from "@/games/archipelago/worlds/skin";
import { loadSkin, skinNow } from "@/games/archipelago/worlds/skins";
import type {
  OverlayItem,
  OverlayReading,
  OverlaySource,
} from "@/overlay/protocol";

/** The most of a name a world's pool holds, if its skin knows it. */
const capOf = (skin: Skin, name: string): number | undefined => {
  for (const cell of skin.cells) {
    if (cell.kind === "item" && Object.hasOwn(cell.caps, name)) {
      return cell.caps[name];
    }
    // A big key, a keycard: one each
    if (cell.kind === "keys" && cell.big === name) return 1;
    if (cell.kind === "cards" && namesOf(cell).includes(name)) return 1;
  }
  return undefined;
};

/**
 * The run as the API tells it. An item's id is its AP name, which the world's
 * name data keeps stable; its level is how many the slot holds. A world with
 * a skin lists every name its grid counts first, in the grid's order, held or
 * not, its `max` the world's pool where AP fixes it; then the rest, in the
 * order the first of each came. An open-ended count (packs, tanks, small
 * keys, any item of a world without a skin) has its count as `max`: AP
 * states no pool.
 * @param skin - The world's skin, if it has one and it has loaded
 */
export const overlayReadingOf = (
  run: Pick<ApRun, "items">,
  skin: Skin | null = null,
): OverlayReading => {
  const counts = new Map(run.items.map((item) => [item.name, item.count]));
  const entry = (name: string, level: number): OverlayItem => ({
    id: name,
    level,
    max: Math.max(level, skin === null ? 0 : (capOf(skin, name) ?? 0)),
    name,
  });
  const gridNames =
    skin === null ? [] : [...new Set(skin.cells.flatMap(namesOf))];
  const inGrid = new Set(gridNames);
  return {
    fresh: run.items.length === 0,
    state: {
      game: "archipelago",
      goMode: null,
      items: [
        ...gridNames.map((name) => entry(name, counts.get(name) ?? 0)),
        ...run.items
          .filter((item) => !inGrid.has(item.name))
          .map((item) => entry(item.name, item.count)),
      ],
      objectives: [],
      timer: null,
    },
  };
};

/** The run's world's skin, if this page has it. */
const currentSkin = () =>
  skinNow(useArchipelagoStore.getState().room?.game) ?? null;

export const overlaySource: OverlaySource = {
  read: () => overlayReadingOf(useArchipelagoStore.getState(), currentSkin()),
  subscribe: (listener) => {
    // A skin arrives as a chunk: once it has, the reading lists its grid
    let game: string | undefined;
    let live = true;
    const fetchSkin = () => {
      const next = useArchipelagoStore.getState().room?.game;
      if (next === game) return;
      game = next;
      if (skinNow(next) !== undefined) return;
      void loadSkin(next).then(() => {
        if (live) listener();
      });
    };
    fetchSkin();
    const unsubscribe = useArchipelagoStore.subscribe(() => {
      fetchSkin();
      listener();
    });
    return () => {
      live = false;
      unsubscribe();
    };
  },
};
