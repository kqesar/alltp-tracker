// What A Link to the Past's run tells the overlay API (docs/overlay-api.md):
// a whitelist, never the run. Race-safe by construction: the items on the
// board's grid, the bosses beaten, the timer and the go mode, and nothing a
// racer must keep from a stream (checks, chests, prizes, medallion
// requirements, entrances, settings, seed, keys, maps, compasses, shops).
// Adding to it is a decision about what streams may show, taken here and in
// the safety test, not a side effect of the store growing a field.

import { raceSourceOf } from "@/autotrack/raceMode";
import {
  type ItemState,
  items as initialItems,
  itemLabels,
  itemsMax,
} from "@/games/alttpr/data/items";
import { isHidden } from "@/games/alttpr/data/presets";
import { goModeStatusOf } from "@/games/alttpr/logic/missing";
import { splitName } from "@/games/alttpr/logic/runLog";
import type { Inputs } from "@/games/alttpr/logic/solution";
import type { Timeline } from "@/games/alttpr/logic/timeline";
import { useAutotrackStore } from "@/games/alttpr/stores/autotrackStore";
import { useGameStore } from "@/games/alttpr/stores/gameStore";
import type {
  OverlayGoMode,
  OverlayItem,
  OverlayObjective,
  OverlayReading,
  OverlaySource,
} from "@/overlay/protocol";
import { raceSafe } from "@/overlay/race";
import { overlayTimerOf } from "@/overlay/timer";
import type { RunTimer } from "@/utils/runTimer";

/**
 * The items, in the grid's order: the API's id, then the tracker's key in the
 * run. Where SMZ3 has the same item the id is SMZ3's (`lamp`, `halfMagic`,
 * `moonPearl`), so an overlay written for one game's Zelda items works for
 * the other's. A level is the tracker's: a count for the bottles, 0 to 4 for
 * the swords, and for the bow and the boomerang a mask of what is held (the
 * bow: 1 the silver arrows, 2 the bow; the boomerang: 1 the blue, 2 the red).
 */
export const OVERLAY_ITEMS: readonly (readonly [id: string, key: string])[] = [
  ["flute", "flute"],
  ["hookshot", "hookshot"],
  ["hammer", "hammer"],
  ["firerod", "firerod"],
  ["icerod", "icerod"],
  ["boomerang", "boomerang"],
  ["net", "net"],
  ["bow", "bow"],
  ["lamp", "lantern"],
  ["shield", "shield"],
  ["sword", "sword"],
  ["tunic", "tunic"],
  ["halfMagic", "magic"],
  ["boots", "boots"],
  ["shovel", "shovel"],
  ["book", "book"],
  ["quake", "quake"],
  ["bombos", "bombos"],
  ["ether", "ether"],
  ["powder", "powder"],
  ["glove", "glove"],
  ["bottle", "bottle"],
  ["somaria", "somaria"],
  ["byrna", "byrna"],
  ["mushroom", "mushroom"],
  ["cape", "cape"],
  ["mirror", "mirror"],
  ["moonPearl", "moonpearl"],
  ["flippers", "flippers"],
];

/**
 * The goals: the ten dungeon bosses, then Agahnim (Castle Tower) and Agahnim 2
 * (Ganon's Tower), as the Run tab's splits have them. The key is the
 * timeline's.
 */
export const OVERLAY_OBJECTIVES: readonly {
  readonly id: string;
  readonly item: string;
  readonly done: number;
  readonly key: string;
}[] = [
  ...Array.from({ length: 10 }, (_, index) => ({
    done: 2,
    id: `boss${index}`,
    item: `boss${index}`,
    key: `item:boss${index}:2`,
  })),
  { done: 1, id: "agahnim", item: "agahnim", key: "item:agahnim:1" },
  { done: 1, id: "agahnim2", item: "agahnim2", key: "item:agahnim2:1" },
];

/** The half magic is held or not; a quarter magic (2) reads as the half. */
const TOGGLES: ReadonlySet<string> = new Set(["magic"]);

/** The most a level reaches: the tracker's own range, 1 for a toggle. */
const maxOf = (key: string): number =>
  TOGGLES.has(key) ? 1 : (itemsMax[key] ?? 1);

const levelOf = (items: ItemState, key: string): number => {
  const value = items[key];
  if (typeof value === "boolean") return value ? 1 : 0;
  const level = value ?? 0;
  return TOGGLES.has(key) ? Math.min(level, 1) : level;
};

/** What the reading reads of a run: the slices the whitelist draws on. */
export type AlttprRun = Inputs & {
  readonly timer: RunTimer;
  readonly timeline: Timeline;
};

const overlayItems = (items: ItemState): OverlayItem[] =>
  OVERLAY_ITEMS.map(([id, key]) => ({
    id,
    level: levelOf(items, key),
    max: maxOf(key),
    name: itemLabels(key),
  }));

const overlayObjectives = (run: AlttprRun): OverlayObjective[] =>
  OVERLAY_OBJECTIVES.map(({ done, id, item, key }) => ({
    done: run.items[item] === done,
    id,
    ms: run.timeline[key]?.ms ?? null,
    name: splitName(key),
  }));

/**
 * Where the run stands against its go mode. Null for a goal without one (all
 * dungeons, a triforce hunt), a Mystery run whose goal is not known yet, and
 * a run whose logic is not worked out yet (a shuffled-entrance run until its
 * solver has loaded).
 */
const overlayGoMode = (run: AlttprRun): OverlayGoMode | null => {
  if (isHidden(run.settings, "goal")) return null;
  try {
    return goModeStatusOf(run)?.tri ?? null;
  } catch {
    return null;
  }
};

/** The start of a run: each item's level before anything is found. */
const startLevel = (key: string): number => {
  const value = initialItems[key];
  return typeof value === "boolean" ? 0 : (value ?? 0);
};

/**
 * The run as the API tells it. Exported for its safety test, which holds a
 * fully loaded run to what this reads.
 */
export const overlayReadingOf = (run: AlttprRun): OverlayReading => {
  const objectives = overlayObjectives(run);
  const timer = overlayTimerOf(run.timer);
  return {
    fresh:
      timer.state === "idle" &&
      objectives.every(({ done }) => !done) &&
      OVERLAY_ITEMS.every(
        ([, key]) => levelOf(run.items, key) === startLevel(key),
      ),
    state: {
      game: "alttpr",
      goMode: overlayGoMode(run),
      items: overlayItems(run.items),
      objectives,
      timer,
    },
  };
};

/** The run as the API tells it: with no time in Race Mode (overlay/race.ts). */
export const overlaySource: OverlaySource = raceSafe(
  {
    read: () => overlayReadingOf(useGameStore.getState()),
    subscribe: (listener) => useGameStore.subscribe(listener),
  },
  raceSourceOf(useAutotrackStore),
);
