// The Super Metroid run: what the player holds, the seed's objectives and
// those done, and the two settings that change the grid, and beside them the
// run timer (utils/runTimer.ts). One Zustand store, saved under its own key
// (each game keeps its run), with undo and redo. What the game says
// (autotracking) lands as news: no step of the history, and the timer is
// kept apart from the history, so undoing a find never rewinds the clock.

import { OBJECTIVES, SM_ITEMS, type SmItemId } from "@alltp/pack-sm";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { type History, historyActions } from "@/games/runHistory";
import { createSaveFormat } from "@/games/saveFormat";
import {
  alignTimer,
  finishTimer,
  type GameClock,
  IDLE_TIMER,
  pauseTimer,
  type RunTimer,
  restoreTimer,
  startTimer,
  type TimerClock,
} from "@/utils/runTimer";

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
  items: z.partialRecord(z.enum(ITEM_IDS), z.number().check(z.int(), z.gte(0))),
  objectives: z.array(z.enum(OBJECTIVE_IDS)),
  splitSpeed: z.boolean(),
  wallJump: z.boolean(),
});

export type SmProgress = z.infer<typeof progressSchema>;

/** A fresh run: nothing held, the four bosses to beat, the game's settings. */
export const freshProgress = (): SmProgress => ({
  done: [],
  items: Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<
    SmItemId,
    number
  >,
  objectives: ["kraid", "phantoon", "draygon", "ridley"],
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
 * history nor part of an export: the run timer, whether the game starts and
 * stops it, the clock it shows, and the game clock's reading when it began.
 */
type TimerFields = {
  /** The run's timer, kept apart from the history. */
  timer: RunTimer;
  /** Whether the timer starts and stops with the game, autotracking. */
  autoTimer: boolean;
  /**
   * Which clock the timer shows: real time, as races time, or Map Rando's RTA
   * while autotracking reads it outside Race Mode. A save without it is real
   * time.
   */
  timerClock: TimerClock;
  /**
   * The RTA clock's frames when the run's timer was at 0, or null before it
   * is known: the clock counts since the SRAM was set up, not since a run
   * began, so the game's time is the frames since this one.
   */
  clockBase: number | null;
};

const freshTimerFields = (): TimerFields => ({
  autoTimer: true,
  clockBase: null,
  timer: IDLE_TIMER,
  timerClock: "real",
});

type SmState = SmProgress &
  TimerFields &
  History<SmProgress> & {
    /** Start the run timer, or go on from its pause, at `at` (now). */
    startTimer: (at?: number) => void;
    /** Pause the run timer at `at` (now). */
    pauseTimer: (at?: number) => void;
    /** Stop the run timer for good, the goal reached, at `at` (now). */
    finishTimer: (at?: number) => void;
    /** Set the run timer back to 0, stopped. */
    resetTimer: () => void;
    setAutoTimer: (on: boolean) => void;
    setTimerClock: (clock: TimerClock) => void;
    /** Note the RTA clock's frames at the timer's 0, or null to forget them. */
    setClockBase: (frames: number | null) => void;
    /**
     * Set the run timer on the game's clock as read at `at`; the timer is
     * left as it is, same object, when it is already there.
     */
    alignTimer: (clock: GameClock, at: number) => void;
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
  items: state.items,
  objectives: state.objectives,
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
        alignTimer: (clock, at) =>
          set((state) => {
            const timer = alignTimer(state.timer, clock, at);
            return timer === state.timer ? state : { timer };
          }),
        applyGameNews,
        finishTimer: (at = Date.now()) =>
          set((state) => ({ timer: finishTimer(state.timer, at) })),
        future: [],
        load: (progress) => {
          record(progress);
          set({ clockBase: null, timer: IDLE_TIMER });
        },
        past: [],
        pauseTimer: (at = Date.now()) =>
          set((state) => ({ timer: pauseTimer(state.timer, at) })),
        redo,
        reset: () => {
          const { objectives, splitSpeed, wallJump } = get();
          record({ ...freshProgress(), objectives, splitSpeed, wallJump });
          set({ clockBase: null, timer: IDLE_TIMER });
        },
        resetTimer: () => set({ clockBase: null, timer: IDLE_TIMER }),
        setAutoTimer: (autoTimer) => set({ autoTimer }),
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
        setTimerClock: (timerClock) => set({ timerClock }),
        startTimer: (at = Date.now()) =>
          set((state) => ({ timer: startTimer(state.timer, at) })),
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
        // The timer fields are not part of the run's schema: a save made
        // before the timer has none, a damaged one is no timer
        const extras =
          typeof saved === "object" && saved !== null
            ? (saved as Partial<Record<keyof TimerFields, unknown>>)
            : {};
        return {
          ...current,
          ...completed(parsed.data),
          autoTimer:
            typeof extras.autoTimer === "boolean"
              ? extras.autoTimer
              : current.autoTimer,
          clockBase: restoreBase(extras.clockBase),
          timer: restoreTimer(extras.timer),
          timerClock:
            extras.timerClock === "game" || extras.timerClock === "real"
              ? extras.timerClock
              : current.timerClock,
        };
      },
      name: SM_STORAGE_KEY,
      partialize: (state) => ({
        ...progressOf(state),
        autoTimer: state.autoTimer,
        clockBase: state.clockBase,
        timer: state.timer,
        timerClock: state.timerClock,
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
