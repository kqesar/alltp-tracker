// The Super Metroid run: what the player holds, the seed's objectives and
// those done, and the two settings that change the grid. One Zustand store,
// saved under its own key (each game keeps its run), with undo and redo.
// What the game says (autotracking) lands as news: no step of the history.

import { OBJECTIVES, SM_ITEMS, type SmItemId } from "@alltp/pack-sm";
import * as z from "zod/mini";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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

/** Undo depth, as ALttPR's. */
const HISTORY_LIMIT = 200;

type SmState = SmProgress & {
  past: SmProgress[];
  future: SmProgress[];
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

const progressOf = (state: SmProgress): SmProgress => ({
  done: state.done,
  items: state.items,
  objectives: state.objectives,
  splitSpeed: state.splitSpeed,
  wallJump: state.wallJump,
});

export const useSmStore = create<SmState>()(
  persist<SmState, [], [], SmProgress>(
    (set, get) => {
      /** A change of the player's: one step of the history. */
      const record = (change: Partial<SmProgress>) =>
        set((state) => ({
          ...change,
          future: [],
          past: [...state.past, progressOf(state)].slice(-HISTORY_LIMIT),
        }));
      return {
        ...freshProgress(),
        applyGameNews: (change) => {
          const state = get();
          const now = change(progressOf(state));
          const rebase = (history: SmProgress[]) =>
            history.map((run) => {
              const changed = change(run);
              return changed === null ? run : { ...run, ...changed };
            });
          set({
            ...(now ?? {}),
            future: rebase(state.future),
            past: rebase(state.past),
          });
        },
        future: [],
        load: (progress) => record(progress),
        past: [],
        redo: () =>
          set((state) => {
            const [next, ...future] = state.future;
            if (next === undefined) return state;
            return {
              ...next,
              future,
              past: [...state.past, progressOf(state)],
            };
          }),
        reset: () => {
          const { objectives, splitSpeed, wallJump } = get();
          record({ ...freshProgress(), objectives, splitSpeed, wallJump });
        },
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
        undo: () =>
          set((state) => {
            const previous = state.past.at(-1);
            if (previous === undefined) return state;
            return {
              ...previous,
              future: [progressOf(state), ...state.future],
              past: state.past.slice(0, -1),
            };
          }),
      };
    },
    {
      // A saved run that is not one (another version's, a damaged one) is
      // dropped for a fresh run rather than half restored
      merge: (saved, current) => {
        const parsed = progressSchema.safeParse(saved);
        return parsed.success
          ? { ...current, ...completed(parsed.data) }
          : current;
      },
      name: SM_STORAGE_KEY,
      partialize: (state) => progressOf(state),
      storage: createJSONStorage(() => localStorage),
      version: SM_SAVE_VERSION,
    },
  ),
);

/**
 * The file an export writes: the run alone. It takes the store's state as it
 * is, so the run is picked out of it, never the undo history beside it.
 */
export const exportSave = (progress: SmProgress): string =>
  `${JSON.stringify(
    {
      format: "alltp-tracker-save",
      game: "sm",
      progress: progressOf(progress),
      version: SM_SAVE_VERSION,
    },
    null,
    2,
  )}\n`;

const saveSchema = z.object({
  format: z.literal("alltp-tracker-save"),
  game: z.string(),
  progress: z.unknown(),
  version: z.number(),
});

/** Why a file cannot be imported, in words the player can act on. */
export type ImportError =
  | "not-json"
  | "not-a-save"
  | "other-game"
  | "newer-version"
  | "invalid";

/** What each reason says to the player. */
export const IMPORT_ERRORS: Readonly<Record<ImportError, string>> = {
  invalid: "This save's run is not one the tracker can read.",
  "newer-version": "This save comes from a newer version of the tracker.",
  "not-a-save": "This file is not a tracker save.",
  "not-json": "This file is not a tracker save.",
  "other-game":
    "This save is for A Link to the Past: switch game to import it there.",
};

/**
 * A save file's run, or why not: not JSON, not a tracker save, another
 * game's (ALttPR's saves import on its own board), a version this one does
 * not know, or a run that is not one.
 */
export const parseSave = (
  text: string,
): { ok: true; progress: SmProgress } | { ok: false; error: ImportError } => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { error: "not-json", ok: false };
  }
  const save = saveSchema.safeParse(json);
  if (!save.success) return { error: "not-a-save", ok: false };
  if (save.data.game !== "sm") return { error: "other-game", ok: false };
  if (save.data.version > SM_SAVE_VERSION) {
    return { error: "newer-version", ok: false };
  }
  const progress = progressSchema.safeParse(save.data.progress);
  if (!progress.success) return { error: "invalid", ok: false };
  const items = Object.entries(progress.data.items).every(
    ([id, count]) => (count ?? 0) <= (MAX.get(id as SmItemId) ?? 0),
  );
  return items
    ? { ok: true, progress: completed(progress.data) }
    : { error: "invalid", ok: false };
};
