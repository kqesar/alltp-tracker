// The Super Metroid run: what the player holds, the seed's objectives and
// those done, and the two settings that change the grid, and beside them the
// run timer (utils/runTimer.ts). One Zustand store, saved under its own key
// (each game keeps its run), with undo and redo. What the game says
// (autotracking) lands as news: no step of the history, and the timer is
// kept apart from the history, so undoing a find never rewinds the clock.

import {
  LOCATION_KEYS,
  OBJECTIVES,
  SM_ITEMS,
  type SmItemId,
} from "@alltp/pack-sm";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type History, historyActions } from "@/games/runHistory";
import { createSaveFormat } from "@/games/saveFormat";
import { SEED_ID } from "@/games/seedId";
import { stampSchema } from "@/games/stamp";
import {
  freshTimerSlice,
  restoreTimerSlice,
  type TimerActions,
  type TimerSlice,
  timerActions,
  timerSliceOf,
} from "@/games/timerSlice";
import { IDLE_TIMER } from "@/utils/runTimer";

/** Where the run is saved: apart from ALttPR's, so each game keeps its own. */
export const SM_STORAGE_KEY = "alltp-tracker-sm";

/** Bumped when SmProgress changes shape. */
export const SM_SAVE_VERSION = 1;

const ITEM_IDS = SM_ITEMS.map((item) => item.id) as [SmItemId, ...SmItemId[]];
const OBJECTIVE_IDS = OBJECTIVES.map((o) => o.id) as [string, ...string[]];
const MAX = new Map(SM_ITEMS.map((item) => [item.id, item.max]));

/**
 * A run's shape, the source of its type: a save file is data from outside
 * the page, and TypeScript's types vanish at runtime, so an import is checked
 * against this schema before it reaches the store. Without it, a file of
 * another game or a hand-edited count would land as is and break the grid.
 */
const progressSchema = z.object({
  done: z.array(z.enum(OBJECTIVE_IDS)),
  // When each location was found, by the log's `room_id:node_id`: only what
  // autotracking read (Map Rando's collected bits, never a Nothing location),
  // and none for a run tracked by hand; a save without it is empty
  found: z._default(z.partialRecord(z.enum(LOCATION_KEYS), stampSchema), {}),
  items: z.partialRecord(z.enum(ITEM_IDS), z.number().check(z.int(), z.gte(0))),
  objectives: z.array(z.enum(OBJECTIVE_IDS)),
  // The seed's name, null while unknown; a save without it is null
  seed: z._default(z.nullable(z.string().check(z.regex(SEED_ID))), null),
  splitSpeed: z.boolean(),
  wallJump: z.boolean(),
});

export type SmProgress = z.infer<typeof progressSchema>;

/** A fresh run: nothing held, the four bosses to beat, the game's settings. */
export const freshProgress = (): SmProgress => ({
  done: [],
  found: {},
  items: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<
    SmItemId,
    number
  >,
  objectives: ["kraid", "phantoon", "draygon", "ridley"],
  seed: null,
  splitSpeed: false,
  wallJump: false,
});

/**
 * A run whose items the save left out, from an older pool, held at 0.
 * Declared before the store, which restores a saved run as it is created.
 */
const completed = (progress: SmProgress): SmProgress => ({
  ...progress,
  items: { ...freshProgress().items, ...progress.items },
});

/**
 * What the store keeps beside the run, saved with it but never a step of the
 * history nor part of an export: the run timer (games/timerSlice.ts), and the
 * game clock's reading when it began.
 */
type TimerFields = TimerSlice & {
  /**
   * The RTA clock's frames when the run's timer was at 0, or null before it
   * is known: the clock counts since the SRAM was set up, not since a run
   * began, so the game's time is the frames since this one.
   */
  clockBase: number | null;
};

const freshTimerFields = (): TimerFields => ({
  ...freshTimerSlice(),
  clockBase: null,
});

type SmState = SmProgress &
  TimerFields &
  TimerActions &
  History<SmProgress> & {
    /** Set the run timer back to 0, stopped. */
    resetTimer: () => void;
    /** Note the RTA clock's frames at the timer's 0, or null to forget them. */
    setClockBase: (frames: number | null) => void;
    /** Step an item: +1 or -1, wrapping within 0 and its pool. */
    step: (id: SmItemId, direction: 1 | -1) => void;
    /** Mark an objective done, or not. */
    toggleDone: (id: string) => void;
    /** Set the seed's objectives; those no longer asked for are no longer done. */
    setObjectives: (ids: readonly string[]) => void;
    setOption: (option: "wallJump" | "splitSpeed", on: boolean) => void;
    /** A new game: nothing held or done, the seed's objectives and settings kept. */
    reset: () => void;
    undo: () => void;
    redo: () => void;
    /** Replace the run with a save's: one undo step. */
    load: (progress: SmProgress) => void;
    /**
     * Lay what the game says on the run and on every snapshot of its history:
     * no step, so undoing the player's change never undoes the game's.
     */
    applyGameNews: (
      change: (run: SmProgress) => Partial<SmProgress> | null,
    ) => void;
  };

/** Whether every count is within its item's pool. */
const withinPools = (progress: SmProgress) =>
  Object.entries(progress.items).every(
    ([id, count]) => (count ?? 0) <= (MAX.get(id as SmItemId) ?? 0),
  );

const progressOf = (state: SmProgress): SmProgress => ({
  done: state.done,
  found: state.found,
  items: state.items,
  objectives: state.objectives,
  seed: state.seed,
  splitSpeed: state.splitSpeed,
  wallJump: state.wallJump,
});

/** What the store saves: the run and its timer. */
type Persisted = SmProgress & TimerFields;

/** A saved clock base: a count of frames, or none. */
const restoreBase = (saved: unknown): number | null =>
  typeof saved === "number" && Number.isInteger(saved) && saved >= 0
    ? saved
    : null;

export const useSmStore = create<SmState>()(
  persist<SmState, [], [], Persisted>(
    (set, get) => {
      const { applyGameNews, record, redo, undo } = historyActions({
        get,
        progressOf,
        set,
      });
      return {
        ...freshProgress(),
        ...freshTimerFields(),
        ...timerActions(set),
        applyGameNews,
        future: [],
        load: (progress) => {
          record(progress);
          set({ clockBase: null, timer: IDLE_TIMER });
        },
        past: [],
        redo,
        reset: () => {
          const { objectives, splitSpeed, wallJump } = get();
          record({ ...freshProgress(), objectives, splitSpeed, wallJump });
          set({ clockBase: null, timer: IDLE_TIMER });
        },
        resetTimer: () => set({ clockBase: null, timer: IDLE_TIMER }),
        setClockBase: (clockBase) => set({ clockBase }),
        setObjectives: (ids) => {
          const objectives = [...new Set(ids)].filter((id) =>
            OBJECTIVE_IDS.includes(id),
          );
          record({
            done: get().done.filter((id) => objectives.includes(id)),
            objectives,
          });
        },
        setOption: (option, on) => {
          if (get()[option] !== on) record({ [option]: on });
        },
        step: (id, direction) => {
          const max = MAX.get(id) ?? 1;
          const value = get().items[id] ?? 0;
          const next = (value + direction + max + 1) % (max + 1);
          record({ items: { ...get().items, [id]: next } });
        },
        toggleDone: (id) => {
          const { done, objectives } = get();
          if (!objectives.includes(id)) return;
          record({
            done: done.includes(id)
              ? done.filter((d) => d !== id)
              : [...done, id],
          });
        },
        undo,
      };
    },
    {
      // A saved run that is not one (another version's, a damaged one, a
      // count beyond its pool) is dropped for a fresh run rather than half
      // restored, as an import refuses it
      merge: (saved, current) => {
        const parsed = progressSchema.safeParse(saved);
        if (!parsed.success || !withinPools(parsed.data)) return current;
        // A save made before the timer has none, a damaged one is no timer
        const extras =
          typeof saved === "object" && saved !== null
            ? (saved as { clockBase?: unknown })
            : {};
        return {
          ...current,
          ...completed(parsed.data),
          ...restoreTimerSlice(saved, current),
          clockBase: restoreBase(extras.clockBase),
        };
      },
      name: SM_STORAGE_KEY,
      partialize: (state) => ({
        ...progressOf(state),
        ...timerSliceOf(state),
        clockBase: state.clockBase,
      }),
      storage: createJSONStorage(() => localStorage),
      version: SM_SAVE_VERSION,
    },
  ),
);

export const { exportSave, IMPORT_ERRORS, parseSave } = createSaveFormat({
  complete: completed,
  game: "sm",
  progressOf,
  schema: progressSchema,
  version: SM_SAVE_VERSION,
  within: withinPools,
});
