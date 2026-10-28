// The SMZ3 run: what the player holds in both games, the locations checked,
// the run's settings and what the player knows of the medallion pads. One
// Zustand store, saved under its own key (each game keeps its run), with
// undo and redo, as Super Metroid's (games/sm/store.ts), and beside them the
// run timer (utils/runTimer.ts), kept apart from the history so undoing a find
// never rewinds the clock. What the game says (autotracking) lands as news.

import {
  DEFAULT_SETTINGS,
  ITEMS,
  MEDALLIONS,
  REGION_MODULES,
  type Smz3Settings,
} from "@alltp/pack-smz3";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { boardRestored, runReplaced } from "@/autotrack/raceMode";
import { type History, historyActions } from "@/games/runHistory";
import { createSaveFormat } from "@/games/saveFormat";
import { SEED_ID } from "@/games/seedId";
import {
  freshTimerSlice,
  restoreTimerSlice,
  type TimerActions,
  type TimerSlice,
  timerActions,
  timerSliceOf,
} from "@/games/timerSlice";
import { IDLE_TIMER } from "@/utils/runTimer";

/** Where the run is saved: apart from the other games', so each keeps its own. */
export const SMZ3_STORAGE_KEY = "alltp-tracker-smz3";

/** Bumped when Smz3Progress changes shape. */
export const SMZ3_SAVE_VERSION = 1;

const ITEM_IDS = ITEMS.map((item) => item.id) as [string, ...string[]];
const MAX = new Map(ITEMS.map((item) => [item.id, item.max]));
export const LOCATION_IDS = REGION_MODULES.flatMap((m) =>
  m.region.locations.map((l) => l.id),
) as [string, ...string[]];

const pad = z.enum(["unknown", ...MEDALLIONS]);
const count = (max: number) => z.number().check(z.int(), z.gte(0), z.lte(max));

/**
 * A run's shape, the source of its type: a save file is data from outside
 * the page, and TypeScript's types vanish at runtime, so an import is
 * checked against this schema before it reaches the store. Without it, a
 * file of another game or a hand-edited count would land as is and break
 * the board or the logic.
 */
const progressSchema = z.object({
  checked: z.array(z.enum(LOCATION_IDS)),
  items: z.partialRecord(z.enum(ITEM_IDS), count(40)),
  pads: z.object({ mire: pad, turtleRock: pad }),
  // The seed's guid, null while unknown; a save without it is null
  seed: z._default(z.nullable(z.string().check(z.regex(SEED_ID))), null),
  settings: z.object({
    ganonCrystals: count(7),
    keysanity: z.boolean(),
    smLogic: z.enum(["normal", "hard"]),
    tourianBosses: count(4),
    towerCrystals: count(7),
  }),
});

export type Smz3Progress = z.infer<typeof progressSchema>;
export type Smz3Pads = Smz3Progress["pads"];

/** A fresh run of a run type: nothing held or checked, the pads unknown. */
export const freshProgress = (
  settings: Smz3Settings = DEFAULT_SETTINGS,
): Smz3Progress => ({
  checked: [],
  items: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])),
  pads: { mire: "unknown", turtleRock: "unknown" },
  seed: null,
  settings,
});

/**
 * A run whose items the save left out, from an older pool, held at 0.
 * Declared before the store, which restores a saved run as it is created.
 */
const completed = (progress: Smz3Progress): Smz3Progress => ({
  ...progress,
  items: { ...freshProgress().items, ...progress.items },
});

/** Whether every count is within its item's pool. */
const withinPools = (progress: Smz3Progress) =>
  Object.entries(progress.items).every(
    ([id, value]) => (value ?? 0) <= (MAX.get(id) ?? 0),
  );

/** What the store saves: the run and its timer. */
type Persisted = Smz3Progress & TimerSlice;

type Smz3State = Smz3Progress &
  TimerSlice &
  TimerActions &
  History<Smz3Progress> & {
    /** Set the run timer back to 0, stopped. */
    resetTimer: () => void;
    /** Step an item: +1 or -1, wrapping within 0 and its pool. */
    step: (id: string, direction: 1 | -1) => void;
    /** Check the locations, or none of them once all are. */
    toggleChecks: (ids: readonly string[]) => void;
    /** Change the run's settings; what it holds and checked stays. */
    setSettings: (change: Partial<Smz3Settings>) => void;
    /** What the player knows a medallion pad wants. */
    setPad: (which: keyof Smz3Pads, medallion: Smz3Pads["mire"]) => void;
    /** A new game: nothing held or checked, the settings kept, the pads unknown. */
    reset: () => void;
    undo: () => void;
    redo: () => void;
    /** Replace the run with a save's: one undo step. */
    load: (progress: Smz3Progress) => void;
    /**
     * Lay what the game says on the run and on every snapshot of its history:
     * no step, so undoing the player's change never undoes the game's.
     */
    applyGameNews: (
      change: (run: Smz3Progress) => Partial<Smz3Progress> | null,
    ) => void;
  };

const progressOf = (state: Smz3Progress): Smz3Progress => ({
  checked: state.checked,
  items: state.items,
  pads: state.pads,
  seed: state.seed,
  settings: state.settings,
});

export const useSmz3Store = create<Smz3State>()(
  persist<Smz3State, [], [], Persisted>(
    (set, get) => {
      const {
        applyGameNews,
        record,
        redo,
        undo: undoStep,
      } = historyActions({
        get,
        progressOf,
        set,
      });
      return {
        ...freshProgress(),
        ...freshTimerSlice(),
        ...timerActions(set),
        applyGameNews,
        future: [],
        load: (progress) => {
          record(progress);
          set({ timer: IDLE_TIMER });
          runReplaced("smz3", get().past);
        },
        past: [],
        redo,
        reset: () => {
          record(freshProgress(get().settings));
          set({ timer: IDLE_TIMER });
          runReplaced("smz3", get().past);
        },
        resetTimer: () => set({ timer: IDLE_TIMER }),
        setPad: (which, medallion) => {
          if (get().pads[which] !== medallion) {
            record({ pads: { ...get().pads, [which]: medallion } });
          }
        },
        setSettings: (change) => {
          const settings = { ...get().settings, ...change };
          const same = (Object.keys(settings) as (keyof Smz3Settings)[]).every(
            (key) => settings[key] === get().settings[key],
          );
          if (!same) record({ settings });
        },
        step: (id, direction) => {
          const max = MAX.get(id) ?? 1;
          const value = get().items[id] ?? 0;
          const next = (value + direction + max + 1) % (max + 1);
          record({ items: { ...get().items, [id]: next } });
        },
        toggleChecks: (ids) => {
          const checked = new Set(get().checked);
          const all = ids.every((id) => checked.has(id));
          for (const id of ids) {
            if (all) checked.delete(id);
            else checked.add(id);
          }
          record({ checked: [...checked] });
        },
        undo: () => {
          const previous = get().past.at(-1);
          undoStep();
          if (previous) boardRestored("smz3", previous);
        },
      };
    },
    {
      // A saved run that is not one (another version's, a damaged one) is
      // dropped for a fresh run rather than half restored
      merge: (saved, current) => {
        const parsed = progressSchema.safeParse(saved);
        return parsed.success && withinPools(parsed.data)
          ? {
              ...current,
              ...completed(parsed.data),
              ...restoreTimerSlice(saved, current),
            }
          : current;
      },
      name: SMZ3_STORAGE_KEY,
      partialize: (state) => ({
        ...progressOf(state),
        ...timerSliceOf(state),
      }),
      storage: createJSONStorage(() => localStorage),
      version: SMZ3_SAVE_VERSION,
    },
  ),
);

export const { exportSave, IMPORT_ERRORS, parseSave } = createSaveFormat({
  complete: completed,
  game: "smz3",
  progressOf,
  schema: progressSchema,
  version: SMZ3_SAVE_VERSION,
  within: withinPools,
});
